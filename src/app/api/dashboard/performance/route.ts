import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";
import { isValidPeriod, getPeriodDays } from "@/lib/period";

// GET /api/dashboard/performance?locationId=xxx&period=30d
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    const locationId = request.nextUrl.searchParams.get("locationId");
    const validationError = validateLocationId(locationId);
    if (validationError) return validationError;

    const locationResult = await requireLocation(db, locationId!);
    if (locationResult instanceof NextResponse) return locationResult;

    const periodRaw = request.nextUrl.searchParams.get("period") || "30d";
    if (!isValidPeriod(periodRaw)) {
      return NextResponse.json(
        { error: "期間パラメータが不正です", code: "INVALID_PERIOD" },
        { status: 400 }
      );
    }

    // 期間フィルタ構築
    const days = getPeriodDays(periodRaw);
    const dateFilter = days
      ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
      : undefined;

    const where = {
      locationId: locationId!,
      ...(dateFilter ? { periodStart: dateFilter } : {}),
    };

    // 集計クエリ（全件ロード回避）
    const [aggregated, latestMetric] = await Promise.all([
      db.performanceMetric.aggregate({
        where,
        _sum: {
          searchCount: true,
          viewCount: true,
          directionRequests: true,
          phoneCalls: true,
          callButtonClicks: true,
          websiteClicks: true,
          totalActions: true,
        },
        _avg: {
          callClickRate: true,
        },
        _count: true,
      }),
      // 最新メトリクスからキーワードと期間終了日を取得
      db.performanceMetric.findFirst({
        where,
        orderBy: { periodStart: "desc" },
        select: { searchKeywords: true, periodEnd: true },
      }),
    ]);

    const sum = aggregated._sum;
    const callClickRate =
      aggregated._count > 0
        ? Math.round((aggregated._avg.callClickRate ?? 0) * 100) / 100
        : 0;

    return NextResponse.json({
      searchCount: sum.searchCount ?? 0,
      viewCount: sum.viewCount ?? 0,
      directionRequests: sum.directionRequests ?? 0,
      callClickRate,
      phoneCalls: sum.phoneCalls ?? 0,
      callButtonClicks: sum.callButtonClicks ?? 0,
      websiteClicks: sum.websiteClicks ?? 0,
      totalActions: sum.totalActions ?? 0,
      periodEnd: latestMetric?.periodEnd ?? new Date(),
      searchKeywords: latestMetric?.searchKeywords ?? [],
    });
  } catch (error) {
    logApiError("performance", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
