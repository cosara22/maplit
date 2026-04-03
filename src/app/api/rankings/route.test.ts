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

const mockKeywordFindMany = vi.fn();
const mockRankingFindFirst = vi.fn();
const mockDb = {
  keyword: { findMany: mockKeywordFindMany },
  ranking: { findFirst: mockRankingFindFirst },
};

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";
const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000020";

describe("GET /api/rankings", () => {
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
      new NextRequest(`http://localhost/api/rankings?locationId=${TEST_LOCATION_ID}`)
    );
    expect(res.status).toBe(401);
  });

  it("locationIdが無い場合400を返す", async () => {
    mockValidateLocationId.mockReturnValue(
      NextResponse.json({ error: "locationIdは必須です" }, { status: 400 })
    );
    const res = await GET(
      new NextRequest("http://localhost/api/rankings")
    );
    expect(res.status).toBe(400);
  });

  it("店舗が見つからない場合404を返す", async () => {
    mockRequireLocation.mockResolvedValue(
      NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 })
    );
    const res = await GET(
      new NextRequest(`http://localhost/api/rankings?locationId=${TEST_LOCATION_ID}`)
    );
    expect(res.status).toBe(404);
  });

  it("キーワード一覧と最新順位を返す", async () => {
    mockKeywordFindMany.mockResolvedValue([
      { id: "kw1", keyword: "薬局", createdAt: "2026-04-01" },
      { id: "kw2", keyword: "ドラッグストア", createdAt: "2026-04-02" },
    ]);
    // findFirstはキーワードと条件で分岐
    mockRankingFindFirst.mockImplementation(async (args: { where: { keyword: string; measuredAt?: unknown } }) => {
      if (args.where.keyword === "薬局" && !args.where.measuredAt) {
        // ���局の最新順位
        return { rankPosition: 3, measuredAt: new Date("2026-04-04") };
      }
      if (args.where.keyword === "薬局" && args.where.measuredAt) {
        // 薬局の前回順位
        return { rankPosition: 5 };
      }
      // ドラッグストアは未計測
      return null;
    });

    const res = await GET(
      new NextRequest(`http://localhost/api/rankings?locationId=${TEST_LOCATION_ID}`)
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.keywords).toHaveLength(2);
    expect(data.keywords[0].keyword).toBe("薬局");
    expect(data.keywords[0].latestRank).toBe(3);
    expect(data.keywords[0].previousRank).toBe(5);
    expect(data.keywords[1].latestRank).toBeNull();
  });

  it("キーワードが空の場合は空配列を返す", async () => {
    mockKeywordFindMany.mockResolvedValue([]);

    const res = await GET(
      new NextRequest(`http://localhost/api/rankings?locationId=${TEST_LOCATION_ID}`)
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.keywords).toHaveLength(0);
  });
});
