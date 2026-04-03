import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";
import { calculateAioScore } from "@/lib/aio-score";
import { isOpenAiError } from "@/lib/openai";

// バッチ処理の上限（1リクエストあたり）
const BATCH_LIMIT = 10;

// POST /api/reviews/aio-score
// 指定店舗のAIOスコア未算出の口コミに対してスコアを一括算出・保存する
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    // リクエストボディからlocationIdを取得
    let body: { locationId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "リクエストボディが不正です", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const locationId = body.locationId;
    const validationError = validateLocationId(locationId);
    if (validationError) return validationError;

    const locationResult = await requireLocation(db, locationId!);
    if (locationResult instanceof NextResponse) return locationResult;

    // AIOスコア未算出の口コミを取得（コメントありのもののみ）
    const reviews = await db.review.findMany({
      where: {
        locationId: locationId!,
        aioScore: null,
        comment: { not: null },
      },
      select: {
        id: true,
        comment: true,
      },
      take: BATCH_LIMIT,
      orderBy: { reviewedAt: "desc" },
    });

    if (reviews.length === 0) {
      return NextResponse.json({
        calculated: 0,
        remaining: 0,
      });
    }

    // 順次算出（OpenAI APIのレート制限を考慮）
    let calculated = 0;
    for (const review of reviews) {
      try {
        const result = await calculateAioScore(review.comment);
        await db.review.update({
          where: { id: review.id },
          data: { aioScore: result.score },
        });
        calculated++;
      } catch (error) {
        logApiError("aio-score-calculate", error);
        // 個別の算出エラーは続行
      }
    }

    // 残りの未算出件数を取得
    const remaining = await db.review.count({
      where: {
        locationId: locationId!,
        aioScore: null,
        comment: { not: null },
      },
    });

    return NextResponse.json({ calculated, remaining });
  } catch (error) {
    logApiError("aio-score", error);
    if (isOpenAiError(error)) {
      return NextResponse.json(
        { error: "AIOスコアの算出に失敗しました", code: "AI_SERVICE_ERROR" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
