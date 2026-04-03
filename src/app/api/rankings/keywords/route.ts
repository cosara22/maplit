import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";

const MAX_KEYWORDS_PER_LOCATION = 20;
const MAX_KEYWORD_LENGTH = 100;

// POST /api/rankings/keywords — キーワード登録
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    let body: { keyword?: unknown; locationId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "リクエストボディが不正です", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { keyword, locationId } = body;

    // locationIdバリデーション
    const locValidation = validateLocationId(locationId as string);
    if (locValidation) return locValidation;

    const locationResult = await requireLocation(db, locationId as string);
    if (locationResult instanceof NextResponse) return locationResult;

    // keywordバリデーション
    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: "キーワードは必須です", code: "MISSING_KEYWORD" },
        { status: 400 }
      );
    }

    const trimmed = keyword.trim();

    if (trimmed.length > MAX_KEYWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `キーワードは${MAX_KEYWORD_LENGTH}文字以内で入力してください`,
          code: "KEYWORD_TOO_LONG",
        },
        { status: 400 }
      );
    }

    // 重複チェック
    const existing = await db.keyword.findFirst({
      where: { locationId: locationId as string, keyword: trimmed },
    });
    if (existing) {
      return NextResponse.json(
        { error: "このキーワードは既に登録されています", code: "DUPLICATE_KEYWORD" },
        { status: 409 }
      );
    }

    // 上限チェック
    const count = await db.keyword.count({
      where: { locationId: locationId as string, isActive: true },
    });
    if (count >= MAX_KEYWORDS_PER_LOCATION) {
      return NextResponse.json(
        {
          error: `キーワードは1店舗あたり${MAX_KEYWORDS_PER_LOCATION}件まで登録できます`,
          code: "LIMIT_EXCEEDED",
        },
        { status: 400 }
      );
    }

    const created = await db.keyword.create({
      data: {
        locationId: locationId as string,
        keyword: trimmed,
      },
      select: {
        id: true,
        keyword: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ keyword: created }, { status: 201 });
  } catch (error) {
    logApiError("rankings-keywords-post", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
