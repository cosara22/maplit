import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "./route";

const mockRequireAuth = vi.fn();
vi.mock("@/lib/api-helpers", () => ({
  requireAuth: () => mockRequireAuth(),
  isErrorResponse: (r: unknown) => r instanceof NextResponse,
  logApiError: vi.fn(),
}));

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockDb = {
  ngWord: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    count: mockCount,
    create: mockCreate,
  },
};

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

describe("GET /api/ng-words", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("NGワード一覧を返す", async () => {
    mockFindMany.mockResolvedValue([
      { id: "1", word: "競合店名", createdAt: "2026-04-01" },
      { id: "2", word: "値下げ", createdAt: "2026-04-02" },
    ]);
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ngWords).toHaveLength(2);
    expect(data.ngWords[0].word).toBe("競合店名");
  });
});

describe("POST /api/ng-words", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockFindFirst.mockResolvedValue(null);
    mockCount.mockResolvedValue(0);
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await POST(
      new NextRequest("http://localhost/api/ng-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: "テスト" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("wordが空の場合400を返す", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/ng-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: "" }),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("MISSING_WORD");
  });

  it("100文字超の場合400を返す", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/ng-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: "あ".repeat(101) }),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("WORD_TOO_LONG");
  });

  it("重複する場合409を返す", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing", word: "競合店名" });
    const res = await POST(
      new NextRequest("http://localhost/api/ng-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: "競合店名" }),
      })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("DUPLICATE_WORD");
  });

  it("上限100件の場合400を返す", async () => {
    mockCount.mockResolvedValue(100);
    const res = await POST(
      new NextRequest("http://localhost/api/ng-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: "新ワード" }),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("LIMIT_EXCEEDED");
  });

  it("正常に追加される", async () => {
    mockCreate.mockResolvedValue({
      id: "new-id",
      word: "競合店名",
      createdAt: "2026-04-04",
    });
    const res = await POST(
      new NextRequest("http://localhost/api/ng-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: "  競合店名  " }),
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.ngWord.word).toBe("競合店名");
    expect(mockCreate).toHaveBeenCalledWith({
      data: { word: "競合店名", tenantId: TEST_TENANT_ID },
      select: { id: true, word: true, createdAt: true },
    });
  });
});
