import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// モック: auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// モック: prisma-tenant
const mockLocationFindFirst = vi.fn();
const mockReviewFindMany = vi.fn();
vi.mock("@/lib/prisma-tenant", () => ({
  createTenantClient: () => ({
    location: { findFirst: mockLocationFindFirst },
    review: { findMany: mockReviewFindMany },
  }),
}));

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
  });

  it("未認証の場合401を返す", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(401);
  });

  it("locationId未指定の場合400を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    const res = await GET(createRequest({}));
    expect(res.status).toBe(400);
  });

  it("locationIdがUUID形式でない場合400を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    const res = await GET(createRequest({ locationId: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("存在しない店舗の場合404を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue(null);
    const res = await GET(
      createRequest({
        locationId: "00000000-0000-0000-0000-000000000099",
      })
    );
    expect(res.status).toBe(404);
  });

  it("レビューが無い場合ゼロ値を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockReviewFindMany.mockResolvedValue([]);

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
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockReviewFindMany.mockResolvedValue([
      { rating: 5, replies: [{ id: "r1" }] },
      { rating: 5, replies: [] },
      { rating: 4, replies: [] },
    ]);

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
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockReviewFindMany.mockResolvedValue([
      { rating: 5, replies: [{ id: "r1" }] },
      { rating: 3, replies: [{ id: "r2" }] },
    ]);

    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(data.replyRate).toBe(100);
    expect(data.unrepliedCount).toBe(0);
  });
});
