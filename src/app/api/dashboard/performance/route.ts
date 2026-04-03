import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTenantClient } from "@/lib/prisma-tenant";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 期間パラメータから日数を計算
function getPeriodDays(period: string): number | null {
  switch (period) {
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
    case "all":
      return null;
    default:
      return 30;
  }
}

// GET /api/dashboard/performance?locationId=xxx&period=30d
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "認証が必要です", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const locationId = request.nextUrl.searchParams.get("locationId");
    if (!locationId || typeof locationId !== "string") {
      return NextResponse.json(
        { error: "locationIdは必須です", code: "MISSING_LOCATION_ID" },
        { status: 400 }
      );
    }
    if (!UUID_REGEX.test(locationId)) {
      return NextResponse.json(
        { error: "locationIdの形式が不正です", code: "INVALID_LOCATION_ID" },
        { status: 400 }
      );
    }

    const period = request.nextUrl.searchParams.get("period") || "30d";
    const db = createTenantClient(session.user.tenantId);

    // ロケーション存在確認
    const location = await db.location.findFirst({
      where: { id: locationId },
    });
    if (!location) {
      return NextResponse.json(
        { error: "店舗が見つかりません", code: "LOCATION_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 期間フィルタ構築
    const days = getPeriodDays(period);
    const dateFilter = days
      ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
      : undefined;

    // パフォーマンスメトリクスを集計
    const metrics = await db.performanceMetric.findMany({
      where: {
        locationId,
        ...(dateFilter ? { periodStart: dateFilter } : {}),
      },
      orderBy: { periodStart: "desc" },
    });

    // 集計
    const aggregated = metrics.reduce(
      (acc, m) => ({
        searchCount: acc.searchCount + m.searchCount,
        viewCount: acc.viewCount + m.viewCount,
        directionRequests: acc.directionRequests + m.directionRequests,
        phoneCalls: acc.phoneCalls + m.phoneCalls,
        callButtonClicks: acc.callButtonClicks + m.callButtonClicks,
        websiteClicks: acc.websiteClicks + m.websiteClicks,
        totalActions: acc.totalActions + m.totalActions,
        callClickRateSum: acc.callClickRateSum + m.callClickRate,
        count: acc.count + 1,
      }),
      {
        searchCount: 0,
        viewCount: 0,
        directionRequests: 0,
        phoneCalls: 0,
        callButtonClicks: 0,
        websiteClicks: 0,
        totalActions: 0,
        callClickRateSum: 0,
        count: 0,
      }
    );

    // 検索キーワード集計（最新メトリクスから取得）
    const latestMetric = metrics[0];
    const searchKeywords = latestMetric?.searchKeywords ?? [];

    // 期間終了日
    const periodEnd = latestMetric?.periodEnd ?? new Date();

    return NextResponse.json({
      searchCount: aggregated.searchCount,
      viewCount: aggregated.viewCount,
      directionRequests: aggregated.directionRequests,
      callClickRate:
        aggregated.count > 0
          ? Math.round((aggregated.callClickRateSum / aggregated.count) * 100) /
            100
          : 0,
      phoneCalls: aggregated.phoneCalls,
      callButtonClicks: aggregated.callButtonClicks,
      websiteClicks: aggregated.websiteClicks,
      totalActions: aggregated.totalActions,
      periodEnd,
      searchKeywords,
    });
  } catch (error) {
    console.error("[performance] GET error:", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
