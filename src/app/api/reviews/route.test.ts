import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

// モック: api-helpers
const mockRequireAuth = vi.fn();
const mockRequireLocation = vi.fn();
vi.mock("@/lib/api-helpers", () => ({
  requireAuth: () => mockRequireAuth(),
  isErrorResponse: (r: unknown) => r instanceof NextResponse,
  validateLocationId: (id: string | null) => {
    if (!id)
      return NextResponse.json(
        { error: "locationIdは必須です" },
        { status: 400 }
      );
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return NextResponse.json(
        { error: "locationIdの形式が不正です" },
        { status: 400 }
      );
    return null;
  },
  requireLocation: () => mockRequireLocation(),
  logApiError: vi.fn(),
}));

// モック: Prismaメソッド
const mockReviewCount = vi.fn();
const mockReviewFindMany = vi.fn();
const mockDb = {
  review: {
    count: mockReviewCount,
    findMany: mockReviewFindMany,
  },
};

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

function createRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/reviews");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

const mockReview = {
  id: "r-001",
  reviewerName: "テスト太郎",
  reviewerPhotoUrl: null,
  rating: 5,
  comment: "とても良い薬局です",
  translatedComment: null,
  language: "ja",
  aioScore: 3,
  replyRecommended: true,
  isModelReview: false,
  reviewedAt: new Date("2023-09-30"),
  replies: [],
};

describe("GET /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockRequireLocation.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockReviewCount.mockResolvedValue(0);
    mockReviewFindMany.mockResolvedValue([]);
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(401);
  });

  it("locationId未指定の場合400を返す", async () => {
    const res = await GET(createRequest({}));
    expect(res.status).toBe(400);
  });

  it("locationIdがUUID形式でない場合400を返す", async () => {
    const res = await GET(createRequest({ locationId: "invalid-id" }));
    expect(res.status).toBe(400);
  });

  it("存在しない店舗の場合404を返す", async () => {
    mockRequireLocation.mockResolvedValue(
      NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 })
    );
    const res = await GET(
      createRequest({ locationId: "00000000-0000-0000-0000-000000000099" })
    );
    expect(res.status).toBe(404);
  });

  it("口コミがない場合空配列を返す", async () => {
    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reviews).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.page).toBe(1);
    expect(data.totalPages).toBe(0);
  });

  it("口コミ一覧を正しく返す", async () => {
    mockReviewCount.mockResolvedValue(1);
    mockReviewFindMany.mockResolvedValue([mockReview]);

    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reviews).toHaveLength(1);
    expect(data.reviews[0].reviewerName).toBe("テスト太郎");
    expect(data.reviews[0].rating).toBe(5);
    expect(data.reviews[0].comment).toBe("とても良い薬局です");
    expect(data.reviews[0].aioScore).toBe(3);
    expect(data.reviews[0].reply).toBeNull();
    expect(data.total).toBe(1);
  });

  it("返信付きの口コミを正しく返す", async () => {
    const reviewWithReply = {
      ...mockReview,
      replies: [
        {
          id: "rr-001",
          replyText: "ありがとうございます",
          aiGeneratedText: null,
          status: "posted",
          repliedAt: new Date("2023-10-01"),
          createdAt: new Date("2023-10-01"),
        },
      ],
    };
    mockReviewCount.mockResolvedValue(1);
    mockReviewFindMany.mockResolvedValue([reviewWithReply]);

    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(data.reviews[0].reply).not.toBeNull();
    expect(data.reviews[0].reply.replyText).toBe("ありがとうございます");
    expect(data.reviews[0].reply.status).toBe("posted");
  });

  it("不正なフィルタ値の場合400を返す", async () => {
    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, filter: "invalid_filter" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_FILTER");
  });

  it("不正なソート値の場合400を返す", async () => {
    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, sort: "invalid_sort" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_SORT");
  });

  it("ページネーションが正しく動作する", async () => {
    mockReviewCount.mockResolvedValue(45);
    mockReviewFindMany.mockResolvedValue([]);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, page: "2", limit: "20" })
    );
    const data = await res.json();

    expect(data.page).toBe(2);
    expect(data.totalPages).toBe(3);
    expect(data.total).toBe(45);
  });

  it("フィルタ'unreplied'でwhere条件が構築される", async () => {
    mockReviewCount.mockResolvedValue(0);
    mockReviewFindMany.mockResolvedValue([]);

    await GET(
      createRequest({ locationId: TEST_LOCATION_ID, filter: "unreplied" })
    );

    // countとfindManyにreplies条件が含まれることを確認
    expect(mockReviewCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          replies: { none: {} },
        }),
      })
    );
  });

  it("内部エラーの場合500を返す", async () => {
    mockReviewCount.mockRejectedValue(new Error("DB接続エラー"));

    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe("INTERNAL_ERROR");
  });
});
