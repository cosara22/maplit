import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, PUT } from "./route";

// モック: api-helpers
const mockRequireAuth = vi.fn();
const mockRequireLocation = vi.fn();
vi.mock("@/lib/api-helpers", () => ({
  requireAuth: () => mockRequireAuth(),
  isErrorResponse: (r: unknown) => r instanceof NextResponse,
  validateLocationId: (id: string | null | undefined) => {
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

// モック: gbp-score
vi.mock("@/lib/gbp-score", () => ({
  calculateGbpScore: vi.fn().mockReturnValue({
    totalScore: 65,
    scoreBreakdown: {
      basicInfo: { score: 35, maxScore: 35 },
      description: { score: 10, maxScore: 20 },
      subcategories: { score: 10, maxScore: 10 },
      photos: { score: 0, maxScore: 25 },
      businessHours: { score: 10, maxScore: 10 },
    },
    missingItems: ["ビジネスの説明（200文字以上）", "ロゴ", "カバー写真", "写真"],
  }),
}));

// モック: Prismaメソッド
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockDb = {
  location: {
    update: mockUpdate,
  },
  gbpScore: {
    upsert: mockUpsert,
  },
};

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

const mockLocation = {
  id: TEST_LOCATION_ID,
  name: "sing薬局 馬込",
  address: "東京都大田区南馬込5-40-1",
  phone: "03-3771-3914",
  website: "https://example.com",
  category: "薬局",
  businessDescription: "地域に根ざした薬局です。",
  subcategories: ["調剤薬局"],
  businessHours: { mon: "9:00-18:00" },
  logoUrl: null,
  coverUrl: null,
  photos: [],
};

function createGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/setup");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

function createPutRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/setup", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockRequireLocation.mockResolvedValue(mockLocation);
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

  it("正常にLocation情報とスコアを返す", async () => {
    const res = await GET(
      createGetRequest({ locationId: TEST_LOCATION_ID })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.location.name).toBe("sing薬局 馬込");
    expect(data.location.phone).toBe("03-3771-3914");
    expect(data.score.totalScore).toBe(65);
    expect(data.score.missingItems).toContain("ロゴ");
  });
});

describe("PUT /api/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockRequireLocation.mockResolvedValue(mockLocation);
    mockUpdate.mockResolvedValue({ ...mockLocation, businessDescription: "更新後" });
    mockUpsert.mockResolvedValue({});
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await PUT(
      createPutRequest({ locationId: TEST_LOCATION_ID, businessDescription: "test" })
    );
    expect(res.status).toBe(401);
  });

  it("locationId未指定の場合400を返す", async () => {
    const res = await PUT(createPutRequest({ businessDescription: "test" }));
    expect(res.status).toBe(400);
  });

  it("更新フィールドなしの場合400を返す", async () => {
    const res = await PUT(
      createPutRequest({ locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("NO_FIELDS");
  });

  it("businessDescriptionが2000文字超の場合400を返す", async () => {
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        businessDescription: "あ".repeat(2001),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("subcategoriesが配列でない場合400を返す", async () => {
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        subcategories: "not-array",
      })
    );
    expect(res.status).toBe(400);
  });

  it("正常にLocationを更新しスコアを再計算する", async () => {
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        businessDescription: "更新後の説明文",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toBeDefined();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: TEST_LOCATION_ID },
      data: { businessDescription: "更新後の説明文" },
    });
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("ホワイトリスト外のフィールドは無視される", async () => {
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        businessDescription: "テスト",
        name: "悪意ある変更",
        tenantId: "別テナント",
      })
    );

    expect(res.status).toBe(200);
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("name");
    expect(updateCall.data).not.toHaveProperty("tenantId");
    expect(updateCall.data).toHaveProperty("businessDescription");
  });

  it("不正なJSONボディの場合400を返す", async () => {
    const req = new NextRequest("http://localhost/api/setup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_BODY");
  });
});
