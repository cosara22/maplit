import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

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

vi.mock("@/lib/period", () => ({
  isValidPeriod: (v: string) => ["7d", "30d", "90d", "1y", "all"].includes(v),
  getPeriodDays: (p: string) => {
    const map: Record<string, number | null> = {
      "7d": 7, "30d": 30, "90d": 90, "1y": 365, all: null,
    };
    return map[p] ?? null;
  },
}));

const mockKeywordFindFirst = vi.fn();
const mockRankingFindMany = vi.fn();
const mockDb = {
  keyword: { findFirst: mockKeywordFindFirst },
  ranking: { findMany: mockRankingFindMany },
};

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";
const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000020";
const TEST_KEYWORD_ID = "00000000-0000-0000-0000-000000000030";

function makeUrl(params: Record<string, string>) {
  const sp = new URLSearchParams(params);
  return new NextRequest(`http://localhost/api/rankings/history?${sp}`);
}

describe("GET /api/rankings/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockValidateLocationId.mockReturnValue(null);
    mockRequireLocation.mockResolvedValue({ id: TEST_LOCATION_ID });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await GET(
      makeUrl({ locationId: TEST_LOCATION_ID, keywordId: TEST_KEYWORD_ID })
    );
    expect(res.status).toBe(401);
  });

  it("keywordIdが無い場合400を返す", async () => {
    const res = await GET(
      makeUrl({ locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("MISSING_KEYWORD_ID");
  });

  it("keywordIdの形式が不正な場合400を返す", async () => {
    const res = await GET(
      makeUrl({ locationId: TEST_LOCATION_ID, keywordId: "invalid" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_KEYWORD_ID");
  });

  it("不正なperiodの場合400を返す", async () => {
    const res = await GET(
      makeUrl({
        locationId: TEST_LOCATION_ID,
        keywordId: TEST_KEYWORD_ID,
        period: "999d",
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_PERIOD");
  });

  it("キーワードが見つからない場合404を返す", async () => {
    mockKeywordFindFirst.mockResolvedValue(null);
    const res = await GET(
      makeUrl({ locationId: TEST_LOCATION_ID, keywordId: TEST_KEYWORD_ID })
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("KEYWORD_NOT_FOUND");
  });

  it("順位推移データを返す", async () => {
    mockKeywordFindFirst.mockResolvedValue({
      id: TEST_KEYWORD_ID,
      keyword: "薬局",
    });
    mockRankingFindMany.mockResolvedValue([
      { rankPosition: 5, measuredAt: new Date("2026-04-01") },
      { rankPosition: 3, measuredAt: new Date("2026-04-02") },
      { rankPosition: 2, measuredAt: new Date("2026-04-03") },
    ]);

    const res = await GET(
      makeUrl({ locationId: TEST_LOCATION_ID, keywordId: TEST_KEYWORD_ID })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.keyword).toBe("薬局");
    expect(data.keywordId).toBe(TEST_KEYWORD_ID);
    expect(data.history).toHaveLength(3);
    expect(data.history[0].position).toBe(5);
    expect(data.history[2].position).toBe(2);
  });

  it("データがない場合空配列を返す", async () => {
    mockKeywordFindFirst.mockResolvedValue({
      id: TEST_KEYWORD_ID,
      keyword: "薬局",
    });
    mockRankingFindMany.mockResolvedValue([]);

    const res = await GET(
      makeUrl({ locationId: TEST_LOCATION_ID, keywordId: TEST_KEYWORD_ID })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.history).toHaveLength(0);
  });
});
