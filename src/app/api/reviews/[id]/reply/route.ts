import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateReviewId,
  requireReview,
  logApiError,
} from "@/lib/api-helpers";
import { postReplyToGbp } from "@/lib/gbp-api";

const MAX_REPLY_LENGTH = 1000;

export async function POST(
  request: NextRequest,
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

    // リクエストボディのバリデーション
    let body: { replyText?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "リクエストボディが不正です", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { replyText } = body;
    if (
      !replyText ||
      typeof replyText !== "string" ||
      replyText.trim() === ""
    ) {
      return NextResponse.json(
        { error: "replyTextは必須です", code: "MISSING_REPLY_TEXT" },
        { status: 400 }
      );
    }
    if (replyText.length > MAX_REPLY_LENGTH) {
      return NextResponse.json(
        {
          error: `replyTextは${MAX_REPLY_LENGTH}文字以内にしてください`,
          code: "REPLY_TEXT_TOO_LONG",
        },
        { status: 400 }
      );
    }

    // 口コミ取得（locationリレーション込み）
    const review = await requireReview(db, reviewId);
    if (review instanceof NextResponse) return review;

    // GBP APIに返信を投稿
    const gbpResult = await postReplyToGbp(
      review.location.gbpAccountId,
      review.location.gbpLocationId,
      review.gbpReviewId,
      replyText.trim()
    );

    // ReviewReplyを保存
    const reply = await db.reviewReply.create({
      data: {
        reviewId: review.id,
        replyText: replyText.trim(),
        status: gbpResult.success ? "posted" : "failed",
        repliedAt: gbpResult.success ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: gbpResult.success,
      reply: {
        id: reply.id,
        replyText: reply.replyText,
        status: reply.status,
        repliedAt: reply.repliedAt,
      },
    });
  } catch (error) {
    logApiError("reviews/[id]/reply", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
