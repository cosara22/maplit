import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";

// GET /api/dashboard/review-summary?locationId=xxx
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

    // Prisma aggregateで集計（全件メモリロード回避）
    const [stats, ratingGroups, repliedCount] = await Promise.all([
      db.review.aggregate({
        where: { locationId: locationId! },
        _count: true,
        _avg: { rating: true },
      }),
      db.review.groupBy({
        by: ["rating"],
        where: { locationId: locationId! },
        _count: true,
      }),
      db.review.count({
        where: {
          locationId: locationId!,
          replies: { some: {} },
        },
      }),
    ]);

    const totalReviews = stats._count;
    const averageRating =
      totalReviews > 0 ? Math.round((stats._avg.rating ?? 0) * 10) / 10 : 0;
    const replyRate =
      totalReviews > 0 ? Math.round((repliedCount / totalReviews) * 100) : 0;
    const unrepliedCount = totalReviews - repliedCount;

    // 星分布
    const ratingDistribution: Record<string, number> = {
      "5": 0,
      "4": 0,
      "3": 0,
      "2": 0,
      "1": 0,
    };
    for (const group of ratingGroups) {
      const key = String(Math.min(5, Math.max(1, group.rating)));
      ratingDistribution[key] += group._count;
    }

    return NextResponse.json({
      totalReviews,
      averageRating,
      replyRate,
      unrepliedCount,
      ratingDistribution,
    });
  } catch (error) {
    logApiError("review-summary", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
