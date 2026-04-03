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
const mockReviewAggregate = vi.fn();
const mockReviewGroupBy = vi.fn();
const mockReviewCount = vi.fn();
const mockDb = {
  review: {
    aggregate: mockReviewAggregate,
    groupBy: mockReviewGroupBy,
    count: mockReviewCount,
  },
};

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

function createRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/dashboard/review-summary");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("GET /api/dashboard/review-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockRequireLocation.mockResolvedValue({ id: TEST_LOCATION_ID });
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
    const res = await GET(createRequest({ locationId: "invalid" }));
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

  it("レビューが無い場合ゼロ値を返す", async () => {
    mockReviewAggregate.mockResolvedValue({
      _count: 0,
      _avg: { rating: null },
    });
    mockReviewGroupBy.mockResolvedValue([]);
    mockReviewCount.mockResolvedValue(0);

    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalReviews).toBe(0);
    expect(data.averageRating).toBe(0);
    expect(data.replyRate).toBe(0);
    expect(data.unrepliedCount).toBe(0);
    expect(data.ratingDistribution).toEqual({
      "5": 0,
      "4": 0,
      "3": 0,
      "2": 0,
      "1": 0,
    });
  });

  it("レビューを正しく集計する", async () => {
    mockReviewAggregate.mockResolvedValue({
      _count: 3,
      _avg: { rating: 4.666666666666667 },
    });
    mockReviewGroupBy.mockResolvedValue([
      { rating: 5, _count: 2 },
      { rating: 4, _count: 1 },
    ]);
    mockReviewCount.mockResolvedValue(1);

    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalReviews).toBe(3);
    expect(data.averageRating).toBe(4.7);
    expect(data.replyRate).toBe(33);
    expect(data.unrepliedCount).toBe(2);
    expect(data.ratingDistribution).toEqual({
      "5": 2,
      "4": 1,
      "3": 0,
      "2": 0,
      "1": 0,
    });
  });

  it("全レビューに返信済みの場合replyRate 100%", async () => {
    mockReviewAggregate.mockResolvedValue({
      _count: 2,
      _avg: { rating: 4.0 },
    });
    mockReviewGroupBy.mockResolvedValue([
      { rating: 5, _count: 1 },
      { rating: 3, _count: 1 },
    ]);
    mockReviewCount.mockResolvedValue(2);

    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(data.replyRate).toBe(100);
    expect(data.unrepliedCount).toBe(0);
  });
});
