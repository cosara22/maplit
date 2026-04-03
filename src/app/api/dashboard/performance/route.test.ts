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
const mockMetricFindMany = vi.fn();
vi.mock("@/lib/prisma-tenant", () => ({
  createTenantClient: () => ({
    location: { findFirst: mockLocationFindFirst },
    performanceMetric: { findMany: mockMetricFindMany },
  }),
}));

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
    const res = await GET(createRequest({ locationId: "not-a-uuid" }));
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

  it("メトリクスが無い場合はゼロ値を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockMetricFindMany.mockResolvedValue([]);

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
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockMetricFindMany.mockResolvedValue([
      {
        searchCount: 500,
        viewCount: 400,
        directionRequests: 30,
        callClickRate: 4.5,
        phoneCalls: 5,
        callButtonClicks: 20,
        websiteClicks: 10,
        totalActions: 65,
        periodEnd: new Date("2026-03-31"),
        searchKeywords: [
          { keyword: "薬局", count: 5000, isTracked: false },
        ],
      },
      {
        searchCount: 300,
        viewCount: 200,
        directionRequests: 20,
        callClickRate: 3.5,
        phoneCalls: 3,
        callButtonClicks: 10,
        websiteClicks: 5,
        totalActions: 38,
        periodEnd: new Date("2026-03-15"),
        searchKeywords: [],
      },
    ]);

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
    // 最新メトリクスのキーワードを返す
    expect(data.searchKeywords).toEqual([
      { keyword: "薬局", count: 5000, isTracked: false },
    ]);
  });

  it("期間パラメータ'all'でフィルタなし取得する", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockMetricFindMany.mockResolvedValue([]);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, period: "all" })
    );
    expect(res.status).toBe(200);

    // findManyにperiodStartフィルタが含まれないことを確認
    const callArgs = mockMetricFindMany.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty("periodStart");
  });

  it("期間パラメータ未指定でデフォルト30dになる", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockMetricFindMany.mockResolvedValue([]);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(200);

    // findManyにperiodStartフィルタが含まれることを確認
    const callArgs = mockMetricFindMany.mock.calls[0][0];
    expect(callArgs.where).toHaveProperty("periodStart");
  });
});
