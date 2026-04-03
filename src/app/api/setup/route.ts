import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";
import { calculateGbpScore } from "@/lib/gbp-score";

// Location編集可能フィールドのホワイトリスト
const EDITABLE_FIELDS = [
  "businessDescription",
  "category",
  "subcategories",
  "phone",
  "website",
  "address",
  "businessHours",
  "logoUrl",
  "coverUrl",
  "photos",
] as const;

// 文字数制限
const LIMITS = {
  businessDescription: 2000,
  category: 100,
  phone: 20,
  website: 500,
  address: 500,
  logoUrl: 500,
  coverUrl: 500,
} as const;

// GET /api/setup?locationId=xxx — 現在のLocation情報を取得
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    const locationId = request.nextUrl.searchParams.get("locationId");
    const validationError = validateLocationId(locationId);
    if (validationError) return validationError;

    const location = await requireLocation(db, locationId!);
    if (location instanceof NextResponse) return location;

    // スコアをリアルタイム算出
    const score = calculateGbpScore(location);

    return NextResponse.json({
      location: {
        id: location.id,
        name: location.name,
        address: location.address,
        phone: location.phone,
        website: location.website,
        category: location.category,
        businessDescription: location.businessDescription,
        subcategories: location.subcategories,
        businessHours: location.businessHours,
        logoUrl: location.logoUrl,
        coverUrl: location.coverUrl,
        photos: location.photos,
      },
      score,
    });
  } catch (error) {
    logApiError("setup-get", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// バリデーション: 文字列フィールドの長さチェック
function validateStringField(
  key: string,
  value: unknown
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return `${key}は文字列である必要があります`;
  const limit = LIMITS[key as keyof typeof LIMITS];
  if (limit && value.length > limit) {
    return `${key}は${limit}文字以内で入力してください`;
  }
  return null;
}

// バリデーション: JSON配列フィールド
function validateJsonArray(
  key: string,
  value: unknown,
  maxItems: number
): string | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return `${key}は配列である必要があります`;
  if (value.length > maxItems) return `${key}は${maxItems}件以内にしてください`;
  return null;
}

// PUT /api/setup — Location情報を更新しスコアを再計算
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "リクエストボディが不正です", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const locationId = body.locationId as string | undefined;
    const validationError = validateLocationId(locationId);
    if (validationError) return validationError;

    const location = await requireLocation(db, locationId!);
    if (location instanceof NextResponse) return location;

    // ホワイトリスト以外のフィールドを除外
    const updateData: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "更新するフィールドがありません", code: "NO_FIELDS" },
        { status: 400 }
      );
    }

    // 文字列フィールドのバリデーション
    for (const key of [
      "businessDescription",
      "category",
      "phone",
      "website",
      "address",
      "logoUrl",
      "coverUrl",
    ] as const) {
      if (key in updateData) {
        const err = validateStringField(key, updateData[key]);
        if (err)
          return NextResponse.json(
            { error: err, code: "VALIDATION_ERROR" },
            { status: 400 }
          );
      }
    }

    // JSON配列フィールドのバリデーション
    if ("subcategories" in updateData) {
      const err = validateJsonArray("subcategories", updateData.subcategories, 20);
      if (err)
        return NextResponse.json(
          { error: err, code: "VALIDATION_ERROR" },
          { status: 400 }
        );
    }
    if ("photos" in updateData) {
      const err = validateJsonArray("photos", updateData.photos, 50);
      if (err)
        return NextResponse.json(
          { error: err, code: "VALIDATION_ERROR" },
          { status: 400 }
        );
    }
    if ("businessHours" in updateData) {
      const val = updateData.businessHours;
      if (val !== null && typeof val !== "object") {
        return NextResponse.json(
          { error: "businessHoursはオブジェクトである必要があります", code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }
    }

    // DB更新
    const updated = await db.location.update({
      where: { id: locationId! },
      data: updateData,
    });

    // スコア再計算
    const score = calculateGbpScore(updated);

    // GbpScoreレコードもupsert
    await db.gbpScore.upsert({
      where: { locationId: locationId! },
      update: {
        totalScore: score.totalScore,
        scoreBreakdown: JSON.parse(JSON.stringify(score.scoreBreakdown)),
        missingItems: score.missingItems,
        calculatedAt: new Date(),
      },
      create: {
        locationId: locationId!,
        totalScore: score.totalScore,
        scoreBreakdown: JSON.parse(JSON.stringify(score.scoreBreakdown)),
        missingItems: score.missingItems,
        calculatedAt: new Date(),
      },
    });

    return NextResponse.json({
      location: {
        id: updated.id,
        name: updated.name,
        address: updated.address,
        phone: updated.phone,
        website: updated.website,
        category: updated.category,
        businessDescription: updated.businessDescription,
        subcategories: updated.subcategories,
        businessHours: updated.businessHours,
        logoUrl: updated.logoUrl,
        coverUrl: updated.coverUrl,
        photos: updated.photos,
      },
      score,
    });
  } catch (error) {
    logApiError("setup-put", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
