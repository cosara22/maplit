import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";
import { calculateGbpScore } from "@/lib/gbp-score";

// GET /api/dashboard/gbp-score?locationId=xxx
// 保存済みのGBPスコアを取得（なければリアルタイム算出）
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

    // 保存済みスコアを別途取得
    const savedScore = await db.gbpScore.findFirst({
      where: { locationId: locationId! },
    });
    if (savedScore) {
      return NextResponse.json({
        totalScore: savedScore.totalScore,
        maxScore: 100,
        scoreBreakdown: savedScore.scoreBreakdown,
        missingItems: savedScore.missingItems,
        calculatedAt: savedScore.calculatedAt,
      });
    }

    // なければリアルタイム算出
    const result = calculateGbpScore(locationResult);
    return NextResponse.json({
      totalScore: result.totalScore,
      maxScore: 100,
      scoreBreakdown: result.scoreBreakdown,
      missingItems: result.missingItems,
      calculatedAt: null,
    });
  } catch (error) {
    logApiError("gbp-score GET", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/dashboard/gbp-score
// GBPスコアを再計算してDBに保存
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

    const locationId =
      typeof body.locationId === "string" ? body.locationId : null;
    const validationError = validateLocationId(locationId);
    if (validationError) return validationError;

    const location = await requireLocation(db, locationId!);
    if (location instanceof NextResponse) return location;

    const result = calculateGbpScore(location);
    const now = new Date();

    // Prisma 7のJson型互換のためJSON変換
    const scoreBreakdownJson = JSON.parse(JSON.stringify(result.scoreBreakdown));
    const missingItemsJson = JSON.parse(JSON.stringify(result.missingItems));

    // upsert: 既存レコードがあれば更新、なければ作成
    const gbpScore = await db.gbpScore.upsert({
      where: { locationId: locationId! },
      create: {
        locationId: locationId!,
        totalScore: result.totalScore,
        scoreBreakdown: scoreBreakdownJson,
        missingItems: missingItemsJson,
        calculatedAt: now,
      },
      update: {
        totalScore: result.totalScore,
        scoreBreakdown: scoreBreakdownJson,
        missingItems: missingItemsJson,
        calculatedAt: now,
      },
    });

    return NextResponse.json({
      totalScore: gbpScore.totalScore,
      maxScore: 100,
      scoreBreakdown: gbpScore.scoreBreakdown,
      missingItems: gbpScore.missingItems,
      calculatedAt: gbpScore.calculatedAt,
    });
  } catch (error) {
    logApiError("gbp-score POST", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
