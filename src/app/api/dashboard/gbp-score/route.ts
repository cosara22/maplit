import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTenantClient } from "@/lib/prisma-tenant";
import { calculateGbpScore } from "@/lib/gbp-score";

// GET /api/dashboard/gbp-score?locationId=xxx
// 保存済みのGBPスコアを取得（なければリアルタイム算出）
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: "認証が必要です", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json(
      { error: "locationIdは必須です", code: "MISSING_LOCATION_ID" },
      { status: 400 }
    );
  }

  const db = createTenantClient(session.user.tenantId);

  // ロケーション取得（テナント分離済み）
  const location = await db.location.findFirst({
    where: { id: locationId },
    include: { gbpScore: true },
  });

  if (!location) {
    return NextResponse.json(
      { error: "店舗が見つかりません", code: "LOCATION_NOT_FOUND" },
      { status: 404 }
    );
  }

  // 保存済みスコアがあればそれを返す
  if (location.gbpScore) {
    return NextResponse.json({
      totalScore: location.gbpScore.totalScore,
      maxScore: 100,
      scoreBreakdown: location.gbpScore.scoreBreakdown,
      missingItems: location.gbpScore.missingItems,
      calculatedAt: location.gbpScore.calculatedAt,
    });
  }

  // なければリアルタイム算出
  const result = calculateGbpScore(location);
  return NextResponse.json({
    totalScore: result.totalScore,
    maxScore: 100,
    scoreBreakdown: result.scoreBreakdown,
    missingItems: result.missingItems,
    calculatedAt: null,
  });
}

// POST /api/dashboard/gbp-score
// GBPスコアを再計算してDBに保存
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: "認証が必要です", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let body: { locationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストボディが不正です", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const { locationId } = body;
  if (!locationId) {
    return NextResponse.json(
      { error: "locationIdは必須です", code: "MISSING_LOCATION_ID" },
      { status: 400 }
    );
  }

  const db = createTenantClient(session.user.tenantId);

  const location = await db.location.findFirst({
    where: { id: locationId },
  });

  if (!location) {
    return NextResponse.json(
      { error: "店舗が見つかりません", code: "LOCATION_NOT_FOUND" },
      { status: 404 }
    );
  }

  const result = calculateGbpScore(location);
  const now = new Date();

  // upsert: 既存レコードがあれば更新、なければ作成
  const gbpScore = await db.gbpScore.upsert({
    where: { locationId },
    create: {
      locationId,
      totalScore: result.totalScore,
      scoreBreakdown: result.scoreBreakdown,
      missingItems: result.missingItems,
      calculatedAt: now,
    },
    update: {
      totalScore: result.totalScore,
      scoreBreakdown: result.scoreBreakdown,
      missingItems: result.missingItems,
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
}
