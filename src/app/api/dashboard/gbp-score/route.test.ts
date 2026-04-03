import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "./route";

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
  requireLocation: (...args: unknown[]) => mockRequireLocation(...args),
  logApiError: vi.fn(),
}));

const mockUpsert = vi.fn();
const mockGbpScoreFindFirst = vi.fn();
const mockDb = {
  location: { findFirst: vi.fn() },
  gbpScore: { upsert: mockUpsert, findFirst: mockGbpScoreFindFirst },
};

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

// テスト用ロケーションデータ
const fullLocation = {
  id: TEST_LOCATION_ID,
  tenantId: TEST_TENANT_ID,
  name: "しん薬局",
  address: "東京都渋谷区神南1-2-3",
  phone: "03-1234-5678",
  website: "https://shin-pharmacy.example.com",
  category: "薬局",
  businessDescription: "あ".repeat(200),
  subcategories: ["調剤薬局"],
  businessHours: { monday: { open: "09:00", close: "18:00" } },
  logoUrl: "https://example.com/logo.png",
  coverUrl: "https://example.com/cover.jpg",
  photos: ["p1.jpg", "p2.jpg", "p3.jpg"],
  gbpScore: null,
};

function createGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/dashboard/gbp-score");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/dashboard/gbp-score", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/dashboard/gbp-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await GET(createGetRequest({ locationId: TEST_LOCATION_ID }));
    expect(res.status).toBe(401);
  });

  it("locationId未指定の場合400を返す", async () => {
    const res = await GET(createGetRequest({}));
    expect(res.status).toBe(400);
  });

  it("存在しない店舗の場合404を返す", async () => {
    mockRequireLocation.mockResolvedValue(
      NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 })
    );
    const res = await GET(
      createGetRequest({ locationId: "00000000-0000-0000-0000-000000000099" })
    );
    expect(res.status).toBe(404);
  });

  it("保存済みスコアがある場合そのまま返す", async () => {
    mockRequireLocation.mockResolvedValue(fullLocation);
    mockGbpScoreFindFirst.mockResolvedValue({
      totalScore: 80,
      scoreBreakdown: { basicInfo: { score: 35, maxScore: 35 } },
      missingItems: ["ビジネスの説明"],
      calculatedAt: new Date("2026-04-01"),
    });

    const res = await GET(createGetRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.totalScore).toBe(80);
    expect(data.maxScore).toBe(100);
  });

  it("保存済みスコアがない場合リアルタイム算出する", async () => {
    mockRequireLocation.mockResolvedValue(fullLocation);
    mockGbpScoreFindFirst.mockResolvedValue(null);

    const res = await GET(createGetRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.totalScore).toBe(100);
    expect(data.missingItems).toEqual([]);
    expect(data.calculatedAt).toBeNull();
  });
});

describe("POST /api/dashboard/gbp-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await POST(
      createPostRequest({ locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(401);
  });

  it("locationId未指定の場合400を返す", async () => {
    const res = await POST(createPostRequest({}));
    expect(res.status).toBe(400);
  });

  it("存在しない店舗の場合404を返す", async () => {
    mockRequireLocation.mockResolvedValue(
      NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 })
    );
    const res = await POST(
      createPostRequest({ locationId: "00000000-0000-0000-0000-000000000099" })
    );
    expect(res.status).toBe(404);
  });

  it("不正なJSONの場合400を返す", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/gbp-score", {
      method: "POST",
      body: "invalid-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("locationIdが数値の場合400を返す", async () => {
    const res = await POST(createPostRequest({ locationId: 12345 }));
    expect(res.status).toBe(400);
  });

  it("locationIdがUUID形式でない場合400を返す", async () => {
    const res = await POST(
      createPostRequest({ locationId: "not-a-uuid" })
    );
    expect(res.status).toBe(400);
  });

  it("スコアを計算してDBに保存する", async () => {
    mockRequireLocation.mockResolvedValue(fullLocation);
    mockUpsert.mockImplementation(({ create }) => ({
      ...create,
      id: "score-001",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const res = await POST(
      createPostRequest({ locationId: TEST_LOCATION_ID })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.totalScore).toBe(100);
    expect(data.missingItems).toEqual([]);
    expect(mockUpsert).toHaveBeenCalledOnce();
  });
});
