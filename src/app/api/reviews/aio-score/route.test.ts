import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

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

// モック: aio-score
const mockCalculateAioScore = vi.fn();
vi.mock("@/lib/aio-score", () => ({
  calculateAioScore: (...args: unknown[]) => mockCalculateAioScore(...args),
}));

// モック: Prismaメソッド
const mockReviewFindMany = vi.fn();
const mockReviewUpdate = vi.fn();
const mockReviewCount = vi.fn();
const mockDb = {
  review: {
    findMany: mockReviewFindMany,
    update: mockReviewUpdate,
    count: mockReviewCount,
  },
};

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/reviews/aio-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reviews/aio-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      tenantId: TEST_TENANT_ID,
      db: mockDb,
    });
    mockRequireLocation.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockReviewFindMany.mockResolvedValue([]);
    mockReviewCount.mockResolvedValue(0);
    mockCalculateAioScore.mockResolvedValue({ score: 3, reason: "テスト" });
    mockReviewUpdate.mockResolvedValue({});
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const req = createRequest({ locationId: TEST_LOCATION_ID });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("locationIdが未指定の場合400を返す", async () => {
    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("locationIdの形式が不正な場合400を返す", async () => {
    const req = createRequest({ locationId: "invalid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("店舗が見つからない場合404を返す", async () => {
    mockRequireLocation.mockResolvedValue(
      NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 })
    );
    const req = createRequest({ locationId: TEST_LOCATION_ID });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("不正なJSON本文の場合400を返す", async () => {
    const req = new NextRequest("http://localhost/api/reviews/aio-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_BODY");
  });

  it("未算出の口コミがない場合 calculated: 0 を返す", async () => {
    mockReviewFindMany.mockResolvedValue([]);
    const req = createRequest({ locationId: TEST_LOCATION_ID });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.calculated).toBe(0);
    expect(data.remaining).toBe(0);
  });

  it("未算出の口コミに対してスコアを算出・保存する", async () => {
    const reviews = [
      { id: "r-001", comment: "とても良い薬局です" },
      { id: "r-002", comment: "親切な薬剤師さんでした" },
    ];
    mockReviewFindMany.mockResolvedValue(reviews);
    mockCalculateAioScore
      .mockResolvedValueOnce({ score: 4, reason: "具体的" })
      .mockResolvedValueOnce({ score: 3, reason: "普通" });
    mockReviewCount.mockResolvedValue(0);

    const req = createRequest({ locationId: TEST_LOCATION_ID });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.calculated).toBe(2);
    expect(data.remaining).toBe(0);

    // calculateAioScoreが各口コミのコメントで呼ばれたことを確認
    expect(mockCalculateAioScore).toHaveBeenCalledWith("とても良い薬局です");
    expect(mockCalculateAioScore).toHaveBeenCalledWith(
      "親切な薬剤師さんでした"
    );

    // DBのupdateが各口コミに対して呼ばれたことを確認
    expect(mockReviewUpdate).toHaveBeenCalledWith({
      where: { id: "r-001" },
      data: { aioScore: 4 },
    });
    expect(mockReviewUpdate).toHaveBeenCalledWith({
      where: { id: "r-002" },
      data: { aioScore: 3 },
    });
  });

  it("個別の算出エラーがあっても他の口コミは処理を続行する", async () => {
    const reviews = [
      { id: "r-001", comment: "良い薬局" },
      { id: "r-002", comment: "エラーテスト" },
      { id: "r-003", comment: "普通の薬局" },
    ];
    mockReviewFindMany.mockResolvedValue(reviews);
    mockCalculateAioScore
      .mockResolvedValueOnce({ score: 4, reason: "OK" })
      .mockRejectedValueOnce(new Error("API Error"))
      .mockResolvedValueOnce({ score: 2, reason: "短い" });
    mockReviewCount.mockResolvedValue(0);

    const req = createRequest({ locationId: TEST_LOCATION_ID });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    // エラーの1件を除いて2件算出成功
    expect(data.calculated).toBe(2);
    expect(mockReviewUpdate).toHaveBeenCalledTimes(2);
  });

  it("残りの未算出件数を返す", async () => {
    const reviews = [{ id: "r-001", comment: "テスト" }];
    mockReviewFindMany.mockResolvedValue(reviews);
    mockReviewCount.mockResolvedValue(5);

    const req = createRequest({ locationId: TEST_LOCATION_ID });
    const res = await POST(req);
    const data = await res.json();
    expect(data.calculated).toBe(1);
    expect(data.remaining).toBe(5);
  });
});
