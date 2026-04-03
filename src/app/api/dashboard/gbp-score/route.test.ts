import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

// モック: auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// モック: prisma-tenant
const mockFindFirst = vi.fn();
const mockUpsert = vi.fn();
vi.mock("@/lib/prisma-tenant", () => ({
  createTenantClient: () => ({
    location: { findFirst: mockFindFirst },
    gbpScore: { upsert: mockUpsert },
  }),
}));

// テスト用ロケーションデータ
const fullLocation = {
  id: "loc-001",
  tenantId: "tenant-001",
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
  });

  it("未認証の場合401を返す", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(createGetRequest({ locationId: "loc-001" }));
    expect(res.status).toBe(401);
  });

  it("locationId未指定の場合400を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: "tenant-001" },
    });
    const res = await GET(createGetRequest({}));
    expect(res.status).toBe(400);
  });

  it("存在しない店舗の場合404を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: "tenant-001" },
    });
    mockFindFirst.mockResolvedValue(null);
    const res = await GET(createGetRequest({ locationId: "unknown" }));
    expect(res.status).toBe(404);
  });

  it("保存済みスコアがある場合そのまま返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: "tenant-001" },
    });
    const savedScore = {
      totalScore: 80,
      scoreBreakdown: { basicInfo: { score: 35, maxScore: 35 } },
      missingItems: ["ビジネスの説明"],
      calculatedAt: new Date("2026-04-01"),
    };
    mockFindFirst.mockResolvedValue({ ...fullLocation, gbpScore: savedScore });

    const res = await GET(createGetRequest({ locationId: "loc-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.totalScore).toBe(80);
    expect(data.maxScore).toBe(100);
  });

  it("保存済みスコアがない場合リアルタイム算出する", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: "tenant-001" },
    });
    mockFindFirst.mockResolvedValue({ ...fullLocation, gbpScore: null });

    const res = await GET(createGetRequest({ locationId: "loc-001" }));
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
  });

  it("未認証の場合401を返す", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(createPostRequest({ locationId: "loc-001" }));
    expect(res.status).toBe(401);
  });

  it("locationId未指定の場合400を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: "tenant-001" },
    });
    const res = await POST(createPostRequest({}));
    expect(res.status).toBe(400);
  });

  it("スコアを計算してDBに保存する", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: "tenant-001" },
    });
    mockFindFirst.mockResolvedValue(fullLocation);
    mockUpsert.mockImplementation(({ create }) => ({
      ...create,
      id: "score-001",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const res = await POST(createPostRequest({ locationId: "loc-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.totalScore).toBe(100);
    expect(data.missingItems).toEqual([]);
    expect(mockUpsert).toHaveBeenCalledOnce();
  });
});
