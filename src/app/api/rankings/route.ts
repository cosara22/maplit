import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";

// GET /api/rankings — キーワード一覧 + 各キーワードの最新順位
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

    // アクティブなキーワード一覧を取得
    const keywords = await db.keyword.findMany({
      where: { locationId: locationId!, isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        keyword: true,
        createdAt: true,
      },
    });

    // 各キーワードの最新順位を取得
    const keywordsWithRank = await Promise.all(
      keywords.map(async (kw) => {
        const latestRanking = await db.ranking.findFirst({
          where: {
            locationId: locationId!,
            keyword: kw.keyword,
          },
          orderBy: { measuredAt: "desc" },
          select: {
            rankPosition: true,
            measuredAt: true,
          },
        });

        // 前回の順位（前日比計算用）
        let previousRank: number | null = null;
        if (latestRanking) {
          const previousRanking = await db.ranking.findFirst({
            where: {
              locationId: locationId!,
              keyword: kw.keyword,
              measuredAt: { lt: latestRanking.measuredAt },
            },
            orderBy: { measuredAt: "desc" },
            select: { rankPosition: true },
          });
          previousRank = previousRanking?.rankPosition ?? null;
        }

        return {
          ...kw,
          latestRank: latestRanking?.rankPosition ?? null,
          latestMeasuredAt: latestRanking?.measuredAt ?? null,
          previousRank,
        };
      })
    );

    return NextResponse.json({ keywords: keywordsWithRank });
  } catch (error) {
    logApiError("rankings-get", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
