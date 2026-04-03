import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { PUT } from "./route";

// モック: api-helpers
const mockRequireAuth = vi.fn();
const mockRequireReview = vi.fn();
vi.mock("@/lib/api-helpers", () => ({
  requireAuth: () => mockRequireAuth(),
  isErrorResponse: (r: unknown) => r instanceof NextResponse,
  validateReviewId: (id: string | null) => {
    if (!id)
      return NextResponse.json(
        { error: "reviewIdは必須です" },
        { status: 400 }
      );
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return NextResponse.json(
        { error: "reviewIdの形式が不正です" },
        { status: 400 }
      );
    return null;
  },
  requireReview: () => mockRequireReview(),
  logApiError: vi.fn(),
}));

// モック: Prismaメソッド
const mockReviewUpdate = vi.fn();
const mockDb = {
  review: { update: mockReviewUpdate },
};

const TEST_REVIEW_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

describe("PUT /api/reviews/[id]/model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      tenantId: TEST_TENANT_ID,
      db: mockDb,
    });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );

    const res = await PUT(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("存在しないレビューの場合404を返す", async () => {
    mockRequireReview.mockResolvedValue(
      NextResponse.json(
        { error: "口コミが見つかりません" },
        { status: 404 }
      )
    );

    const res = await PUT(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("false → true にトグルする", async () => {
    mockRequireReview.mockResolvedValue({
      id: TEST_REVIEW_ID,
      isModelReview: false,
      location: { id: "loc-001" },
    });
    mockReviewUpdate.mockResolvedValue({
      id: TEST_REVIEW_ID,
      isModelReview: true,
    });

    const res = await PUT(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.isModelReview).toBe(true);

    expect(mockReviewUpdate).toHaveBeenCalledWith({
      where: { id: TEST_REVIEW_ID },
      data: { isModelReview: true },
    });
  });

  it("true → false にトグルする", async () => {
    mockRequireReview.mockResolvedValue({
      id: TEST_REVIEW_ID,
      isModelReview: true,
      location: { id: "loc-001" },
    });
    mockReviewUpdate.mockResolvedValue({
      id: TEST_REVIEW_ID,
      isModelReview: false,
    });

    const res = await PUT(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    const data = await res.json();
    expect(data.isModelReview).toBe(false);
  });
});
