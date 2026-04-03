import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  logApiError,
} from "@/lib/api-helpers";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /api/rankings/keywords/:id — キーワード削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { db } = authResult;

    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "IDの形式が不正です", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    // キーワードの存在確認（テナント分離はlocation経由で自動）
    const keyword = await db.keyword.findFirst({
      where: { id },
      include: { location: true },
    });

    if (!keyword) {
      return NextResponse.json(
        { error: "キーワードが見つかりません", code: "KEYWORD_NOT_FOUND" },
        { status: 404 }
      );
    }

    await db.keyword.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError("rankings-keywords-delete", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
