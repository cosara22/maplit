import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";
import { isValidPeriod, getPeriodDays, MAX_METRICS } from "@/lib/period";
import {
  generatePerformanceCsv,
  PerformanceRow,
} from "@/lib/csv-export";

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

    // メトリクスを取得（個別行をCSV出力するため findMany を使用）
    const metrics = await db.performanceMetric.findMany({
      where,
      orderBy: { periodStart: "desc" as const },
      take: MAX_METRICS,
      select: {
        periodStart: true,
        periodEnd: true,
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
      periodStart: m.periodStart
        ? new Date(m.periodStart).toISOString().slice(0, 10)
        : "",
      periodEnd: m.periodEnd
        ? new Date(m.periodEnd).toISOString().slice(0, 10)
        : "",
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
    const today = new Date().toISOString().slice(0, 10);
    const filename = `performance_${periodRaw}_${today}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
