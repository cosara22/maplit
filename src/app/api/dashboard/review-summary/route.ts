import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTenantClient } from "@/lib/prisma-tenant";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/dashboard/review-summary?locationId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "認証が必要です", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const locationId = request.nextUrl.searchParams.get("locationId");
    if (!locationId || typeof locationId !== "string") {
      return NextResponse.json(
        { error: "locationIdは必須です", code: "MISSING_LOCATION_ID" },
        { status: 400 }
      );
    }
    if (!UUID_REGEX.test(locationId)) {
      return NextResponse.json(
        { error: "locationIdの形式が不正です", code: "INVALID_LOCATION_ID" },
        { status: 400 }
      );
    }

    const db = createTenantClient(session.user.tenantId);

    // ロケーション存在確認
    const location = await db.location.findFirst({
      where: { id: locationId },
    });
    if (!location) {
      return NextResponse.json(
        { error: "店舗が見つかりません", code: "LOCATION_NOT_FOUND" },
        { status: 404 }
      );
    }

    // レビュー一覧取得
    const reviews = await db.review.findMany({
      where: { locationId },
      include: { replies: true },
    });

    const totalReviews = reviews.length;

    // 平均評価
    const averageRating =
      totalReviews > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10
          ) / 10
        : 0;

    // 返信率（replies配列が空でないものをカウント）
    const repliedCount = reviews.filter((r) => r.replies.length > 0).length;
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
    for (const review of reviews) {
      const key = String(Math.min(5, Math.max(1, review.rating)));
      ratingDistribution[key]++;
    }

    return NextResponse.json({
      totalReviews,
      averageRating,
      replyRate,
      unrepliedCount,
      ratingDistribution,
    });
  } catch (error) {
    console.error("[review-summary] GET error:", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
