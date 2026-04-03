import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
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

// モック: openai
const mockGenerateReviewReply = vi.fn();
vi.mock("@/lib/openai", () => ({
  generateReviewReply: (...args: unknown[]) =>
    mockGenerateReviewReply(...args),
}));

// モック: Prismaメソッド
const mockAiReplySettingsFindUnique = vi.fn();
const mockNgWordFindMany = vi.fn();
const mockReviewReplyCreate = vi.fn();
const mockReviewReplyFindFirst = vi.fn();
const mockDb = {
  aiReplySettings: { findUnique: mockAiReplySettingsFindUnique },
  ngWord: { findMany: mockNgWordFindMany },
  reviewReply: {
    create: mockReviewReplyCreate,
    findFirst: mockReviewReplyFindFirst,
  },
};

const TEST_REVIEW_ID = "00000000-0000-0000-0000-000000000001";
const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000002";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

const mockReview = {
  id: TEST_REVIEW_ID,
  locationId: TEST_LOCATION_ID,
  rating: 5,
  comment: "とても良い薬局です",
  location: {
    id: TEST_LOCATION_ID,
    name: "シング薬局",
    category: "調剤薬局",
  },
};

describe("POST /api/reviews/[id]/ai-reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      tenantId: TEST_TENANT_ID,
      db: mockDb,
    });
    mockRequireReview.mockResolvedValue(mockReview);
    mockAiReplySettingsFindUnique.mockResolvedValue({
      replyKeywords: ["処方箋"],
      replyTone: "polite",
      replyStyleInstructions: "丁寧に",
    });
    mockNgWordFindMany.mockResolvedValue([{ word: "最悪" }]);
    mockReviewReplyFindFirst.mockResolvedValue(null);
    mockGenerateReviewReply.mockResolvedValue({
      generatedReply: "口コミありがとうございます。",
      tokensUsed: { input: 100, output: 50 },
      ngWordsDetected: false,
    });
    mockReviewReplyCreate.mockResolvedValue({ id: "rr-001" });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("不正なreviewIdの場合400を返す", async () => {
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "invalid-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("存在しないレビューの場合404を返す", async () => {
    mockRequireReview.mockResolvedValue(
      NextResponse.json(
        { error: "口コミが見つかりません" },
        { status: 404 }
      )
    );

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("正常にAI返信を生成する", async () => {
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.generatedReply).toBe("口コミありがとうございます。");
    expect(data.tokensUsed).toEqual({ input: 100, output: 50 });
  });

  it("生成後にdraftステータスでReviewReplyを保存する", async () => {
    await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });

    expect(mockReviewReplyCreate).toHaveBeenCalledWith({
      data: {
        reviewId: TEST_REVIEW_ID,
        aiGeneratedText: "口コミありがとうございます。",
        status: "draft",
      },
    });
  });

  it("既存draftがある場合はキャッシュを返す", async () => {
    mockReviewReplyFindFirst.mockResolvedValue({
      id: "rr-existing",
      aiGeneratedText: "既存のドラフト返信",
      status: "draft",
    });

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.generatedReply).toBe("既存のドラフト返信");
    expect(data.cached).toBe(true);
    // OpenAI APIは呼ばれない
    expect(mockGenerateReviewReply).not.toHaveBeenCalled();
  });

  it("AiReplySettingsが未設定の場合デフォルト値で生成する", async () => {
    mockAiReplySettingsFindUnique.mockResolvedValue(null);

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: TEST_REVIEW_ID }),
    });
    expect(res.status).toBe(200);

    expect(mockGenerateReviewReply).toHaveBeenCalledWith(
      expect.objectContaining({
        replyKeywords: [],
        replyTone: "polite",
        replyStyleInstructions: "",
      })
    );
  });
});
