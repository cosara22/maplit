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
const mockAggregate = vi.fn();
const mockFindFirst = vi.fn();
const mockDb = {
  performanceMetric: {
    aggregate: mockAggregate,
    findFirst: mockFindFirst,
  },
};

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

function createRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/dashboard/performance");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("GET /api/dashboard/performance", () => {
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
    const res = await GET(createRequest({ locationId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("不正なperiodパラメータの場合400を返す", async () => {
    mockAggregate.mockResolvedValue({
      _sum: {
        searchCount: 0, viewCount: 0, directionRequests: 0,
        phoneCalls: 0, callButtonClicks: 0, websiteClicks: 0, totalActions: 0,
      },
      _avg: { callClickRate: null },
      _count: 0,
    });
    mockFindFirst.mockResolvedValue(null);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, period: "invalid" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_PERIOD");
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

  it("メトリクスが無い場合はゼロ値を返す", async () => {
    mockAggregate.mockResolvedValue({
      _sum: {
        searchCount: null,
        viewCount: null,
        directionRequests: null,
        phoneCalls: null,
        callButtonClicks: null,
        websiteClicks: null,
        totalActions: null,
      },
      _avg: { callClickRate: null },
      _count: 0,
    });
    mockFindFirst.mockResolvedValue(null);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, period: "30d" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.searchCount).toBe(0);
    expect(data.viewCount).toBe(0);
    expect(data.directionRequests).toBe(0);
    expect(data.callClickRate).toBe(0);
    expect(data.searchKeywords).toEqual([]);
  });

  it("メトリクスを正しく集計する", async () => {
    mockAggregate.mockResolvedValue({
      _sum: {
        searchCount: 800,
        viewCount: 600,
        directionRequests: 50,
        phoneCalls: 8,
        callButtonClicks: 30,
        websiteClicks: 15,
        totalActions: 103,
      },
      _avg: { callClickRate: 4.0 },
      _count: 2,
    });
    mockFindFirst.mockResolvedValue({
      searchKeywords: [{ keyword: "薬局", count: 5000, isTracked: false }],
      periodEnd: new Date("2026-03-31"),
    });

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, period: "30d" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.searchCount).toBe(800);
    expect(data.viewCount).toBe(600);
    expect(data.directionRequests).toBe(50);
    expect(data.callClickRate).toBe(4);
    expect(data.phoneCalls).toBe(8);
    expect(data.callButtonClicks).toBe(30);
    expect(data.websiteClicks).toBe(15);
    expect(data.totalActions).toBe(103);
    expect(data.searchKeywords).toEqual([
      { keyword: "薬局", count: 5000, isTracked: false },
    ]);
  });

  it("期間パラメータ'all'でフィルタなし取得する", async () => {
    mockAggregate.mockResolvedValue({
      _sum: {
        searchCount: 0, viewCount: 0, directionRequests: 0,
        phoneCalls: 0, callButtonClicks: 0, websiteClicks: 0, totalActions: 0,
      },
      _avg: { callClickRate: null },
      _count: 0,
    });
    mockFindFirst.mockResolvedValue(null);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, period: "all" })
    );
    expect(res.status).toBe(200);

    const callArgs = mockAggregate.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty("periodStart");
  });

  it("期間パラメータ未指定でデフォルト30dになる", async () => {
    mockAggregate.mockResolvedValue({
      _sum: {
        searchCount: 0, viewCount: 0, directionRequests: 0,
        phoneCalls: 0, callButtonClicks: 0, websiteClicks: 0, totalActions: 0,
      },
      _avg: { callClickRate: null },
      _count: 0,
    });
    mockFindFirst.mockResolvedValue(null);

    const res = await GET(createRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(200);

    const callArgs = mockAggregate.mock.calls[0][0];
    expect(callArgs.where).toHaveProperty("periodStart");
  });
});
