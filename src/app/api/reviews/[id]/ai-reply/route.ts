import { NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateReviewId,
  requireReview,
  logApiError,
} from "@/lib/api-helpers";
import { generateReviewReply } from "@/lib/openai";

export async function POST(
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

    // 口コミ取得（locationリレーション込み）
    const review = await requireReview(db, reviewId);
    if (review instanceof NextResponse) return review;

    // AI返信設定を取得
    const aiSettings = await db.aiReplySettings.findUnique({
      where: { locationId: review.locationId },
    });

    // テナントのNGワード一覧を取得
    const ngWords = await db.ngWord.findMany({
      select: { word: true },
    });

    // AI返信を生成
    const result = await generateReviewReply({
      locationName: review.location.name,
      category: review.location.category,
      replyKeywords: Array.isArray(aiSettings?.replyKeywords)
        ? (aiSettings.replyKeywords as string[])
        : [],
      replyTone: aiSettings?.replyTone ?? "polite",
      replyStyleInstructions: aiSettings?.replyStyleInstructions ?? "",
      ngWords: ngWords.map((nw) => nw.word),
      rating: review.rating,
      comment: review.comment ?? "",
    });

    // ReviewReplyにdraftとして保存
    await db.reviewReply.create({
      data: {
        reviewId: review.id,
        aiGeneratedText: result.generatedReply,
        status: "draft",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logApiError("reviews/[id]/ai-reply", error);

    // OpenAI APIエラーの判別
    if (
      error instanceof Error &&
      (error.message.includes("API") || error.message.includes("openai"))
    ) {
      return NextResponse.json(
        { error: "AI返信の生成に失敗しました", code: "AI_SERVICE_ERROR" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
