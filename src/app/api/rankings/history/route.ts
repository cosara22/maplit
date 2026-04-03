import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";
import { isValidPeriod, getPeriodDays } from "@/lib/period";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_HISTORY_RECORDS = 1000;

// GET /api/rankings/history — 順位推移データ
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    const { searchParams } = request.nextUrl;
    const locationId = searchParams.get("locationId");
    const keywordId = searchParams.get("keywordId");
    const period = searchParams.get("period") ?? "30d";

    // locationIdバリデーション
    const locValidation = validateLocationId(locationId);
    if (locValidation) return locValidation;

    const locationResult = await requireLocation(db, locationId!);
    if (locationResult instanceof NextResponse) return locationResult;

    // keywordIdバリデーション
    if (!keywordId) {
      return NextResponse.json(
        { error: "keywordIdは必須です", code: "MISSING_KEYWORD_ID" },
        { status: 400 }
      );
    }
    if (!UUID_REGEX.test(keywordId)) {
      return NextResponse.json(
        { error: "keywordIdの形式が不正です", code: "INVALID_KEYWORD_ID" },
        { status: 400 }
      );
    }

    // 期間バリデーション
    if (!isValidPeriod(period)) {
      return NextResponse.json(
        { error: "periodが不正です", code: "INVALID_PERIOD" },
        { status: 400 }
      );
    }

    // キーワードの存在確認
    const keyword = await db.keyword.findFirst({
      where: { id: keywordId, locationId: locationId! },
    });
    if (!keyword) {
      return NextResponse.json(
        { error: "キーワードが見つかりません", code: "KEYWORD_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 期間フィルタ
    const days = getPeriodDays(period);
    const dateFilter = days
      ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
      : undefined;

    const history = await db.ranking.findMany({
      where: {
        locationId: locationId!,
        keyword: keyword.keyword,
        ...(dateFilter ? { measuredAt: dateFilter } : {}),
      },
      orderBy: { measuredAt: "asc" },
      select: {
        rankPosition: true,
        measuredAt: true,
      },
      take: MAX_HISTORY_RECORDS,
    });

    return NextResponse.json({
      keyword: keyword.keyword,
      keywordId: keyword.id,
      history: history.map((h) => ({
        position: h.rankPosition,
        date: h.measuredAt,
      })),
    });
  } catch (error) {
    logApiError("rankings-history", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
