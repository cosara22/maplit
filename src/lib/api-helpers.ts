import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTenantClient, TenantPrismaClient } from "@/lib/prisma-tenant";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 認証チェック結果 */
interface AuthResult {
  tenantId: string;
  db: TenantPrismaClient;
}

/**
 * 認証を検証し、テナントスコープ付きDBクライアントを返す。
 * 未認証の場合はNextResponseを返す。
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: "認証が必要です", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  return {
    tenantId: session.user.tenantId,
    db: createTenantClient(session.user.tenantId),
  };
}

/** requireAuthの結果がエラーレスポンスかどうか判定 */
export function isErrorResponse(
  result: AuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * locationIdのバリデーション。
 * 不正な場合はNextResponseを返し、正常な場合はnullを返す。
 */
export function validateLocationId(
  locationId: string | null | undefined
): NextResponse | null {
  if (!locationId) {
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
  return null;
}

/**
 * ロケーションの存在とテナント所有権を検証。
 * 見つからない場合はNextResponseを返す。
 */
export async function requireLocation(
  db: TenantPrismaClient,
  locationId: string,
  include?: Record<string, boolean>
) {
  const location = await db.location.findFirst({
    where: { id: locationId },
    ...(include ? { include } : {}),
  });
  if (!location) {
    return NextResponse.json(
      { error: "店舗が見つかりません", code: "LOCATION_NOT_FOUND" },
      { status: 404 }
    );
  }
  return location;
}

/**
 * reviewIdのバリデーション。
 * 不正な場合はNextResponseを返し、正常な場合はnullを返す。
 */
export function validateReviewId(
  reviewId: string | null | undefined
): NextResponse | null {
  if (!reviewId) {
    return NextResponse.json(
      { error: "reviewIdは必須です", code: "MISSING_REVIEW_ID" },
      { status: 400 }
    );
  }
  if (!UUID_REGEX.test(reviewId)) {
    return NextResponse.json(
      { error: "reviewIdの形式が不正です", code: "INVALID_REVIEW_ID" },
      { status: 400 }
    );
  }
  return null;
}

/**
 * 口コミの存在とテナント所有権を検証（locationリレーション込み）。
 * 見つからない場合はNextResponseを返す。
 */
export async function requireReview(
  db: TenantPrismaClient,
  reviewId: string,
  include?: Record<string, boolean | object>
) {
  const review = await db.review.findFirst({
    where: { id: reviewId },
    include: {
      location: true,
      ...include,
    },
  });
  if (!review) {
    return NextResponse.json(
      { error: "口コミが見つかりません", code: "REVIEW_NOT_FOUND" },
      { status: 404 }
    );
  }
  return review;
}

/**
 * APIエラーログ（本番環境ではスタックトレースを除外）
 */
export function logApiError(tag: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const name = error instanceof Error ? error.name : undefined;
  console.error(`[${tag}] error:`, { message, name });
}
