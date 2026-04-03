import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  validateLocationId,
  requireLocation,
  logApiError,
} from "@/lib/api-helpers";

// GET /api/reviews/ai-settings?locationId=xxx
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

    const settings = await db.aiReplySettings.findFirst({
      where: { locationId: locationId! },
    });

    return NextResponse.json({
      replyKeywords: settings?.replyKeywords ?? [],
      replyStyleInstructions: settings?.replyStyleInstructions ?? "",
      replyTone: settings?.replyTone ?? "polite",
    });
  } catch (error) {
    logApiError("ai-settings-get", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/reviews/ai-settings
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "不正なJSONです", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const { locationId, replyKeywords, replyStyleInstructions, replyTone } =
      body as {
        locationId?: string;
        replyKeywords?: string[];
        replyStyleInstructions?: string;
        replyTone?: string;
      };

    const validationError = validateLocationId(locationId);
    if (validationError) return validationError;

    const locationResult = await requireLocation(db, locationId!);
    if (locationResult instanceof NextResponse) return locationResult;

    // replyKeywordsバリデーション
    if (replyKeywords !== undefined) {
      if (
        !Array.isArray(replyKeywords) ||
        !replyKeywords.every((k) => typeof k === "string")
      ) {
        return NextResponse.json(
          { error: "replyKeywordsは文字列配列である必要があります", code: "INVALID_KEYWORDS" },
          { status: 400 }
        );
      }
      if (replyKeywords.length > 50 || replyKeywords.some((k) => k.length > 100)) {
        return NextResponse.json(
          { error: "キーワードの数または長さが上限を超えています", code: "KEYWORDS_TOO_LONG" },
          { status: 400 }
        );
      }
    }

    // replyStyleInstructionsバリデーション
    if (replyStyleInstructions !== undefined && replyStyleInstructions.length > 2000) {
      return NextResponse.json(
        { error: "返信スタイル指示は2000文字以内にしてください", code: "INSTRUCTIONS_TOO_LONG" },
        { status: 400 }
      );
    }

    // replyToneバリデーション
    const validTones = ["polite", "friendly", "formal"];
    if (replyTone && !validTones.includes(replyTone)) {
      return NextResponse.json(
        { error: "不正なreplyTone値です", code: "INVALID_REPLY_TONE" },
        { status: 400 }
      );
    }

    // upsert: 既存なら更新、なければ新規作成
    const settings = await db.aiReplySettings.upsert({
      where: { locationId: locationId! },
      create: {
        locationId: locationId!,
        replyKeywords: replyKeywords ?? [],
        replyStyleInstructions: replyStyleInstructions ?? "",
        replyTone: replyTone ?? "polite",
      },
      update: {
        ...(replyKeywords !== undefined && { replyKeywords }),
        ...(replyStyleInstructions !== undefined && { replyStyleInstructions }),
        ...(replyTone !== undefined && { replyTone }),
      },
    });

    return NextResponse.json({
      replyKeywords: settings.replyKeywords,
      replyStyleInstructions: settings.replyStyleInstructions,
      replyTone: settings.replyTone,
    });
  } catch (error) {
    logApiError("ai-settings-put", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
