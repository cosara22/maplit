import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  logApiError,
} from "@/lib/api-helpers";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /api/ng-words/:id — NGワード削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    const { id } = await params;

    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "IDの形式が不正です", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    const ngWord = await db.ngWord.findFirst({
      where: { id },
    });
    if (!ngWord) {
      return NextResponse.json(
        { error: "NGワードが見つかりません", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await db.ngWord.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError("ng-words-delete", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
