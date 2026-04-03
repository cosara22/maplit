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
const mockFindMany = vi.fn();
const mockDb = {
  performanceMetric: {
    findMany: mockFindMany,
  },
};

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";
const BOM = "\uFEFF";
const HEADER =
  "期間開始,期間終了,検索数,閲覧数,ルートリクエスト,通話クリック率(%),電話（メイン）,通話ボタン,ウェブサイト,合計アクション";

function createRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/export/performance");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("GET /api/export/performance", () => {
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
    mockFindMany.mockResolvedValue([]);
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

  // IT-CSV-01: パフォーマンスCSV出力
  it("IT-CSV-01: Content-Type が text/csv で返る", async () => {
    mockFindMany.mockResolvedValue([
      {
        periodStart: new Date("2026-03-01"),
        periodEnd: new Date("2026-03-31"),
        searchCount: 800,
        viewCount: 600,
        directionRequests: 50,
        callClickRate: 4.0,
        phoneCalls: 8,
        callButtonClicks: 30,
        websiteClicks: 15,
        totalActions: 103,
      },
    ]);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID, period: "30d" })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("performance_30d_");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const body = await res.text();
    const lines = body.replace(BOM, "").trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe("2026-03-01,2026-03-31,800,600,50,4,8,30,15,103");
  });

  // IT-CSV-02: CSVにBOM付きUTF-8ヘッダーがある
  it("IT-CSV-02: BOM付きUTF-8で出力される", async () => {
    mockFindMany.mockResolvedValue([
      {
        periodStart: new Date("2026-03-01"),
        periodEnd: new Date("2026-03-31"),
        searchCount: 100,
        viewCount: 200,
        directionRequests: 10,
        callClickRate: 1.5,
        phoneCalls: 3,
        callButtonClicks: 5,
        websiteClicks: 2,
        totalActions: 20,
      },
    ]);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID })
    );
    // Response.text()はBOMを自動除去するため、rawバイトで検証
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);

    // UTF-8 BOM: EF BB BF
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
  });

  // IT-CSV-03: データなしの場合ヘッダーのみ出力
  it("IT-CSV-03: データなしの場合ヘッダーのみ出力される", async () => {
    mockFindMany.mockResolvedValue([]);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID })
    );
    const body = await res.text();
    const lines = body.replace(BOM, "").trimEnd().split("\n");

    expect(res.status).toBe(200);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(HEADER);
  });

  it("期間パラメータが正しくフィルタに適用される", async () => {
    mockFindMany.mockResolvedValue([]);

    await GET(
      createRequest({ locationId: TEST_LOCATION_ID, period: "all" })
    );

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty("periodStart");
  });

  it("null値がある場合0にフォールバックする", async () => {
    mockFindMany.mockResolvedValue([
      {
        periodStart: null,
        periodEnd: null,
        searchCount: null,
        viewCount: null,
        directionRequests: null,
        callClickRate: null,
        phoneCalls: null,
        callButtonClicks: null,
        websiteClicks: null,
        totalActions: null,
      },
    ]);

    const res = await GET(
      createRequest({ locationId: TEST_LOCATION_ID })
    );
    const body = await res.text();
    const lines = body.replace(BOM, "").trimEnd().split("\n");

    expect(lines[1]).toBe(",,0,0,0,0,0,0,0,0");
  });
});
