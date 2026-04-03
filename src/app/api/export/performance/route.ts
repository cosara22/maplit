import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";
import {
  generatePerformanceCsv,
  PerformanceRow,
} from "@/lib/csv-export";

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

// 結果件数の上限（メモリ保護）
const MAX_METRICS = 1000;

// GET /api/export/performance?locationId=xxx&period=30d
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

    const period = request.nextUrl.searchParams.get("period") || "30d";

    // 期間フィルタ構築
    const days = getPeriodDays(period);
    const dateFilter = days
      ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
      : undefined;

    const where = {
      locationId: locationId!,
      ...(dateFilter ? { periodStart: dateFilter } : {}),
    };

    // メトリクスを取得（個別行をCSV出力するため findMany を使用）
    const metrics = await db.performanceMetric.findMany({
      where,
      orderBy: { periodStart: "desc" as const },
      take: MAX_METRICS,
      select: {
        searchCount: true,
        viewCount: true,
        directionRequests: true,
        callClickRate: true,
        phoneCalls: true,
        callButtonClicks: true,
        websiteClicks: true,
        totalActions: true,
      },
    });

    const rows: PerformanceRow[] = metrics.map((m) => ({
      searchCount: m.searchCount ?? 0,
      viewCount: m.viewCount ?? 0,
      directionRequests: m.directionRequests ?? 0,
      callClickRate: m.callClickRate ?? 0,
      phoneCalls: m.phoneCalls ?? 0,
      callButtonClicks: m.callButtonClicks ?? 0,
      websiteClicks: m.websiteClicks ?? 0,
      totalActions: m.totalActions ?? 0,
    }));

    const csv = generatePerformanceCsv(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="performance.csv"',
      },
    });
  } catch (error) {
    logApiError("export-performance", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
