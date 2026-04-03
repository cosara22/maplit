import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

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

// モック: gbp-api
const mockPostReplyToGbp = vi.fn();
vi.mock("@/lib/gbp-api", () => ({
  postReplyToGbp: (...args: unknown[]) => mockPostReplyToGbp(...args),
}));

// モック: Prismaメソッド
const mockReviewReplyCreate = vi.fn();
const mockDb = {
  reviewReply: { create: mockReviewReplyCreate },
};

const TEST_REVIEW_ID = "00000000-0000-0000-0000-000000000001";
const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000002";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

const mockReview = {
  id: TEST_REVIEW_ID,
  locationId: TEST_LOCATION_ID,
  gbpReviewId: "gbp-review-001",
  location: {
    id: TEST_LOCATION_ID,
    gbpAccountId: "gbp-account-001",
    gbpLocationId: "gbp-location-001",
  },
};

function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/reviews/xxx/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reviews/[id]/reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      tenantId: TEST_TENANT_ID,
      db: mockDb,
    });
    mockRequireReview.mockResolvedValue(mockReview);
    mockPostReplyToGbp.mockResolvedValue({ success: true });
    mockReviewReplyCreate.mockResolvedValue({
      id: "rr-001",
      replyText: "ありがとうございます",
      status: "posted",
      repliedAt: new Date(),
    });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );

    const res = await POST(createRequest({ replyText: "テスト" }), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("replyTextが未指定の場合400を返す", async () => {
    const res = await POST(createRequest({}), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("MISSING_REPLY_TEXT");
  });

  it("replyTextが1000文字超の場合400を返す", async () => {
    const res = await POST(
      createRequest({ replyText: "あ".repeat(1001) }),
      { params: Promise.resolve({ id: TEST_REVIEW_ID }) }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("REPLY_TEXT_TOO_LONG");
  });

  it("存在しないレビューの場合404を返す", async () => {
    mockRequireReview.mockResolvedValue(
      NextResponse.json(
        { error: "口コミが見つかりません" },
        { status: 404 }
      )
    );

    const res = await POST(createRequest({ replyText: "テスト" }), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("正常に返信を投稿する", async () => {
    const res = await POST(
      createRequest({ replyText: "ありがとうございます" }),
      { params: Promise.resolve({ id: TEST_REVIEW_ID }) }
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.reply.status).toBe("posted");
  });

  it("GBP API投稿を呼び出す", async () => {
    await POST(
      createRequest({ replyText: "ありがとうございます" }),
      { params: Promise.resolve({ id: TEST_REVIEW_ID }) }
    );

    expect(mockPostReplyToGbp).toHaveBeenCalledWith(
      "gbp-account-001",
      "gbp-location-001",
      "gbp-review-001",
      "ありがとうございます"
    );
  });

  it("GBP APIがエラーの場合failedステータスで保存する", async () => {
    mockPostReplyToGbp.mockResolvedValue({
      success: false,
      error: "GBP API error",
    });
    mockReviewReplyCreate.mockResolvedValue({
      id: "rr-001",
      replyText: "ありがとうございます",
      status: "failed",
      repliedAt: null,
    });

    const res = await POST(
      createRequest({ replyText: "ありがとうございます" }),
      { params: Promise.resolve({ id: TEST_REVIEW_ID }) }
    );
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.reply.status).toBe("failed");
  });
});
