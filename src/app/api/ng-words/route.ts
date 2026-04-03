import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  logApiError,
} from "@/lib/api-helpers";

const MAX_NG_WORDS = 100;
const MAX_WORD_LENGTH = 100;

// GET /api/ng-words — NGワード一覧取得
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    const ngWords = await db.ngWord.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, word: true, createdAt: true },
    });

    return NextResponse.json({ ngWords });
  } catch (error) {
    logApiError("ng-words-get", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/ng-words — NGワード追加
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db, tenantId } = authResult;

    let body: { word?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "リクエストボディが不正です", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { word } = body;
    if (!word || typeof word !== "string" || word.trim().length === 0) {
      return NextResponse.json(
        { error: "wordは必須です", code: "MISSING_WORD" },
        { status: 400 }
      );
    }

    const trimmed = word.trim();

    if (trimmed.length > MAX_WORD_LENGTH) {
      return NextResponse.json(
        { error: `NGワードは${MAX_WORD_LENGTH}文字以内で入力してください`, code: "WORD_TOO_LONG" },
        { status: 400 }
      );
    }

    // 重複チェック
    const existing = await db.ngWord.findFirst({
      where: { word: trimmed },
    });
    if (existing) {
      return NextResponse.json(
        { error: "このNGワードは既に登録されています", code: "DUPLICATE_WORD" },
        { status: 409 }
      );
    }

    // 上限チェック
    const count = await db.ngWord.count();
    if (count >= MAX_NG_WORDS) {
      return NextResponse.json(
        { error: `NGワードは${MAX_NG_WORDS}件まで登録できます`, code: "LIMIT_EXCEEDED" },
        { status: 400 }
      );
    }

    const ngWord = await db.ngWord.create({
      data: { word: trimmed, tenantId },
      select: { id: true, word: true, createdAt: true },
    });

    return NextResponse.json({ ngWord }, { status: 201 });
  } catch (error) {
    logApiError("ng-words-post", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
