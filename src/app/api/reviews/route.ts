import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";

// フィルタ定数
const VALID_FILTERS = [
  "all",
  "unreplied",
  "replied",
  "high_rating",
  "low_rating",
  "high_aio",
] as const;

const VALID_SORTS = [
  "newest",
  "oldest",
  "rating_high",
  "rating_low",
  "aio_high",
] as const;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /api/reviews?locationId=xxx&filter=all&sort=newest&search=&period=&page=1&limit=20
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    const params = request.nextUrl.searchParams;
    const locationId = params.get("locationId");
    const validationError = validateLocationId(locationId);
    if (validationError) return validationError;

    const locationResult = await requireLocation(db, locationId!);
    if (locationResult instanceof NextResponse) return locationResult;

    // パラメータ解析
    const filter = params.get("filter") ?? "all";
    const sort = params.get("sort") ?? "newest";
    const search = (params.get("search") ?? "").slice(0, 200);
    const period = params.get("period") ?? "";
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    // フィルタ・ソートバリデーション
    if (!VALID_FILTERS.includes(filter as (typeof VALID_FILTERS)[number])) {
      return NextResponse.json(
        { error: "不正なフィルタ値です", code: "INVALID_FILTER" },
        { status: 400 }
      );
    }
    if (!VALID_SORTS.includes(sort as (typeof VALID_SORTS)[number])) {
      return NextResponse.json(
        { error: "不正なソート値です", code: "INVALID_SORT" },
        { status: 400 }
      );
    }

    // WHERE条件を構築
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { locationId: locationId! };

    // フィルタ条件
    switch (filter) {
      case "unreplied":
        where.replies = { none: {} };
        break;
      case "replied":
        where.replies = { some: {} };
        break;
      case "high_rating":
        where.rating = { gte: 4 };
        break;
      case "low_rating":
        where.rating = { lte: 3 };
        break;
      case "high_aio":
        where.aioScore = { gte: 4 };
        break;
    }

    // テキスト検索
    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { reviewerName: { contains: search, mode: "insensitive" } },
      ];
    }

    // 期間フィルタ
    if (period) {
      const now = new Date();
      let startDate: Date | null = null;
      switch (period) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
      if (startDate) {
        where.reviewedAt = { gte: startDate };
      }
    }

    // ソート条件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any;
    switch (sort) {
      case "newest":
        orderBy = { reviewedAt: "desc" };
        break;
      case "oldest":
        orderBy = { reviewedAt: "asc" };
        break;
      case "rating_high":
        orderBy = { rating: "desc" };
        break;
      case "rating_low":
        orderBy = { rating: "asc" };
        break;
      case "aio_high":
        orderBy = { aioScore: "desc" };
        break;
      default:
        orderBy = { reviewedAt: "desc" };
    }

    // 並列実行: 件数取得 + データ取得
    const [total, reviews] = await Promise.all([
      db.review.count({ where }),
      db.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          replies: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // レスポンス整形
    const formattedReviews = reviews.map((review) => {
      const latestReply = review.replies[0] ?? null;
      return {
        id: review.id,
        reviewerName: review.reviewerName,
        reviewerPhotoUrl: review.reviewerPhotoUrl,
        rating: review.rating,
        comment: review.comment,
        translatedComment: review.translatedComment,
        language: review.language,
        aioScore: review.aioScore,
        replyRecommended: review.replyRecommended,
        isModelReview: review.isModelReview,
        reviewedAt: review.reviewedAt,
        reply: latestReply
          ? {
              id: latestReply.id,
              replyText: latestReply.replyText,
              aiGeneratedText: latestReply.aiGeneratedText,
              status: latestReply.status,
              repliedAt: latestReply.repliedAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      reviews: formattedReviews,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    logApiError("reviews", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
