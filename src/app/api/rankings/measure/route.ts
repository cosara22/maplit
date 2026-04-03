import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";
import {
  isSerpApiConfigured,
  measureMultipleKeywords,
} from "@/lib/serpapi";

// POST /api/rankings/measure — 手動計測トリガー
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    let body: { locationId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "リクエストボディが不正です", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { locationId } = body;
    const locValidation = validateLocationId(locationId as string);
    if (locValidation) return locValidation;

    const location = await requireLocation(db, locationId as string);
    if (location instanceof NextResponse) return location;

    // SerpAPIキー確認
    if (!isSerpApiConfigured()) {
      return NextResponse.json(
        { error: "SerpAPIキーが設定されていません", code: "SERPAPI_NOT_CONFIGURED" },
        { status: 400 }
      );
    }

    // 座標確認
    if (!location.latitude || !location.longitude) {
      return NextResponse.json(
        {
          error: "店舗の緯度・経度が設定されていません。GBP設定画面で住所を登録してください。",
          code: "MISSING_COORDINATES",
        },
        { status: 400 }
      );
    }

    // GBP Place ID確認
    if (!location.gbpLocationId) {
      return NextResponse.json(
        {
          error: "GBPロケーションIDが設定されていません。GBP設定画面で登録してください。",
          code: "MISSING_GBP_LOCATION_ID",
        },
        { status: 400 }
      );
    }

    // アクティブなキーワードを取得
    const keywords = await db.keyword.findMany({
      where: { locationId: locationId as string, isActive: true },
      select: { keyword: true },
    });

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "計測対象のキーワードがありません", code: "NO_KEYWORDS" },
        { status: 400 }
      );
    }

    // SerpAPIで順位計測
    const { results, errors } = await measureMultipleKeywords(
      keywords.map((k) => k.keyword),
      Number(location.latitude),
      Number(location.longitude),
      location.gbpLocationId
    );

    // 計測結果をDBに保存（1日1レコード、同日の再計��は上書き）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const result of results) {
      await db.ranking.upsert({
        where: {
          locationId_keyword_measuredAt: {
            locationId: locationId as string,
            keyword: result.keyword,
            measuredAt: today,
          },
        },
        update: {
          rankPosition: result.rankPosition,
          latitude: result.latitude,
          longitude: result.longitude,
        },
        create: {
          locationId: locationId as string,
          keyword: result.keyword,
          rankPosition: result.rankPosition,
          latitude: result.latitude,
          longitude: result.longitude,
          measuredAt: today,
        },
      });
    }

    return NextResponse.json({
      measured: results.length,
      errors: errors.length,
      results: results.map((r) => ({
        keyword: r.keyword,
        position: r.rankPosition,
      })),
      ...(errors.length > 0 ? { errorDetails: errors } : {}),
    });
  } catch (error) {
    logApiError("rankings-measure", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
