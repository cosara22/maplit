import { NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateReviewId,
  requireReview,
  logApiError,
} from "@/lib/api-helpers";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 認証チェック
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    // reviewId バリデーション
    const { id: reviewId } = await params;
    const idError = validateReviewId(reviewId);
    if (idError) return idError;

    // 口コミ取得
    const review = await requireReview(db, reviewId);
    if (review instanceof NextResponse) return review;

    // isModelReview をトグル
    const updated = await db.review.update({
      where: { id: review.id },
      data: { isModelReview: !review.isModelReview },
    });

    return NextResponse.json({
      id: updated.id,
      isModelReview: updated.isModelReview,
    });
  } catch (error) {
    logApiError("reviews/[id]/model", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
