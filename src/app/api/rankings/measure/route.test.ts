import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

const mockRequireAuth = vi.fn();
const mockValidateLocationId = vi.fn();
const mockRequireLocation = vi.fn();
vi.mock("@/lib/api-helpers", () => ({
  requireAuth: () => mockRequireAuth(),
  isErrorResponse: (r: unknown) => r instanceof NextResponse,
  validateLocationId: (id: string | null) => mockValidateLocationId(id),
  requireLocation: (db: unknown, id: string) => mockRequireLocation(db, id),
  logApiError: vi.fn(),
}));

const mockIsSerpApiConfigured = vi.fn();
const mockMeasureMultipleKeywords = vi.fn();
vi.mock("@/lib/serpapi", () => ({
  isSerpApiConfigured: () => mockIsSerpApiConfigured(),
  measureMultipleKeywords: (...args: unknown[]) =>
    mockMeasureMultipleKeywords(...args),
}));

const mockTransaction = vi.fn();
const mockRankingUpsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    ranking: {
      upsert: (...args: unknown[]) => mockRankingUpsert(...args),
    },
  },
}));

// PrismaClientのインポートエラー防止
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: vi.fn(),
}));
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));

const mockKeywordFindMany = vi.fn();
const mockRankingFindFirst = vi.fn();
const mockDb = {
  keyword: { findMany: mockKeywordFindMany },
  ranking: { findFirst: mockRankingFindFirst },
};

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";
const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000020";

const FULL_LOCATION = {
  id: TEST_LOCATION_ID,
  tenantId: TEST_TENANT_ID,
  latitude: 35.6762,
  longitude: 139.6503,
  gbpLocationId: "ChIJ_place123",
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/rankings/measure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/rankings/measure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockValidateLocationId.mockReturnValue(null);
    mockRequireLocation.mockResolvedValue(FULL_LOCATION);
    mockIsSerpApiConfigured.mockReturnValue(true);
    mockRankingFindFirst.mockResolvedValue(null); // レート制限なし
    mockTransaction.mockResolvedValue([]);
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await POST(makeRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(401);
  });

  it("SerpAPIキー未設定の場合400を返す", async () => {
    mockIsSerpApiConfigured.mockReturnValue(false);
    const res = await POST(makeRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("SERPAPI_NOT_CONFIGURED");
  });

  it("座標未設定の場合400を返す", async () => {
    mockRequireLocation.mockResolvedValue({
      ...FULL_LOCATION,
      latitude: null,
      longitude: null,
    });
    const res = await POST(makeRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("MISSING_COORDINATES");
  });

  it("GBP Location ID未設定の場合400を返す", async () => {
    mockRequireLocation.mockResolvedValue({
      ...FULL_LOCATION,
      gbpLocationId: null,
    });
    const res = await POST(makeRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("MISSING_GBP_LOCATION_ID");
  });

  it("キーワードが0件の場合400を返す", async () => {
    mockKeywordFindMany.mockResolvedValue([]);
    const res = await POST(makeRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("NO_KEYWORDS");
  });

  it("レート制限（1時間以内の再計測）で429を返す", async () => {
    mockRankingFindFirst.mockResolvedValue({
      createdAt: new Date(), // 直前に計測済み
    });
    const res = await POST(makeRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.code).toBe("RATE_LIMITED");
  });

  it("正常に計測してDB保存される", async () => {
    // レート制限: 2時間前に計測済み（通過する）
    mockRankingFindFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });
    mockKeywordFindMany.mockResolvedValue([
      { keyword: "薬局" },
      { keyword: "ドラッグストア" },
    ]);
    mockMeasureMultipleKeywords.mockResolvedValue({
      results: [
        { keyword: "薬局", rankPosition: 3, latitude: 35.6762, longitude: 139.6503 },
        { keyword: "ドラッグストア", rankPosition: null, latitude: 35.6762, longitude: 139.6503 },
      ],
      errors: [],
    });

    const res = await POST(makeRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.measured).toBe(2);
    expect(data.errors).toBe(0);
    expect(data.results[0].keyword).toBe("薬局");
    expect(data.results[0].position).toBe(3);
    expect(data.results[1].position).toBeNull();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("部分エラー時にerrorDetailsを返す", async () => {
    mockRankingFindFirst.mockResolvedValue(null);
    mockKeywordFindMany.mockResolvedValue([
      { keyword: "薬局" },
      { keyword: "ドラッグストア" },
    ]);
    mockMeasureMultipleKeywords.mockResolvedValue({
      results: [
        { keyword: "薬局", rankPosition: 1, latitude: 35.6762, longitude: 139.6503 },
      ],
      errors: [
        { keyword: "ドラッグストア", error: "SerpAPI リクエスト失敗" },
      ],
    });

    const res = await POST(makeRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.measured).toBe(1);
    expect(data.errors).toBe(1);
    expect(data.errorDetails).toHaveLength(1);
    expect(data.errorDetails[0].keyword).toBe("ドラッグストア");
  });
});
