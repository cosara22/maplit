import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, PUT } from "./route";

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
const mockAiReplySettingsFindFirst = vi.fn();
const mockAiReplySettingsUpsert = vi.fn();
const mockDb = {
  aiReplySettings: {
    findFirst: mockAiReplySettingsFindFirst,
    upsert: mockAiReplySettingsUpsert,
  },
};

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

function createGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/reviews/ai-settings");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

function createPutRequest(body: unknown) {
  return new NextRequest("http://localhost/api/reviews/ai-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/reviews/ai-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockRequireLocation.mockResolvedValue({ id: TEST_LOCATION_ID });
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

  it("設定が存在しない場合デフォルト値を返す", async () => {
    mockAiReplySettingsFindFirst.mockResolvedValue(null);

    const res = await GET(createGetRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.replyKeywords).toEqual([]);
    expect(data.replyStyleInstructions).toBe("");
    expect(data.replyTone).toBe("polite");
  });

  it("設定が存在する場合その値を返す", async () => {
    mockAiReplySettingsFindFirst.mockResolvedValue({
      replyKeywords: ["ありがとう", "お薬"],
      replyStyleInstructions: "丁寧に返信してください",
      replyTone: "friendly",
    });

    const res = await GET(createGetRequest({ locationId: TEST_LOCATION_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.replyKeywords).toEqual(["ありがとう", "お薬"]);
    expect(data.replyStyleInstructions).toBe("丁寧に返信してください");
    expect(data.replyTone).toBe("friendly");
  });
});

describe("PUT /api/reviews/ai-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockRequireLocation.mockResolvedValue({ id: TEST_LOCATION_ID });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        replyKeywords: [],
      })
    );
    expect(res.status).toBe(401);
  });

  it("locationId未指定の場合400を返す", async () => {
    const res = await PUT(createPutRequest({ replyKeywords: [] }));
    expect(res.status).toBe(400);
  });

  it("不正なreplyToneの場合400を返す", async () => {
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        replyTone: "invalid_tone",
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_REPLY_TONE");
  });

  it("設定を正しく保存する", async () => {
    const savedSettings = {
      replyKeywords: ["感謝", "お薬"],
      replyStyleInstructions: "丁寧に返信",
      replyTone: "polite",
    };
    mockAiReplySettingsUpsert.mockResolvedValue(savedSettings);

    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        replyKeywords: ["感謝", "お薬"],
        replyStyleInstructions: "丁寧に返信",
        replyTone: "polite",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.replyKeywords).toEqual(["感謝", "お薬"]);
    expect(data.replyStyleInstructions).toBe("丁寧に返信");
  });

  it("不正なJSONの場合400を返す", async () => {
    const req = new NextRequest("http://localhost/api/reviews/ai-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "invalid json{",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_JSON");
  });

  it("replyKeywordsが文字列配列でない場合400を返す", async () => {
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        replyKeywords: [123, { nested: true }],
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_KEYWORDS");
  });

  it("replyKeywordsが50件を超える場合400を返す", async () => {
    const tooManyKeywords = Array.from({ length: 51 }, (_, i) => `kw${i}`);
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        replyKeywords: tooManyKeywords,
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("KEYWORDS_TOO_LONG");
  });

  it("replyStyleInstructionsが2000文字を超える場合400を返す", async () => {
    const res = await PUT(
      createPutRequest({
        locationId: TEST_LOCATION_ID,
        replyStyleInstructions: "あ".repeat(2001),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INSTRUCTIONS_TOO_LONG");
  });
});
