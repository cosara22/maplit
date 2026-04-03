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

const mockFindFirst = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockDb = {
  keyword: {
    findFirst: mockFindFirst,
    count: mockCount,
    create: mockCreate,
  },
};

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";
const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000020";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/rankings/keywords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/rankings/keywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
    mockValidateLocationId.mockReturnValue(null);
    mockRequireLocation.mockResolvedValue({ id: TEST_LOCATION_ID });
    mockFindFirst.mockResolvedValue(null);
    mockCount.mockResolvedValue(0);
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await POST(
      makeRequest({ keyword: "薬局", locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(401);
  });

  it("keywordが空の場合400を返す", async () => {
    const res = await POST(
      makeRequest({ keyword: "", locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("MISSING_KEYWORD");
  });

  it("100文字超の場合400を返す", async () => {
    const res = await POST(
      makeRequest({ keyword: "あ".repeat(101), locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("KEYWORD_TOO_LONG");
  });

  it("重複する場合409を返す", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing", keyword: "薬局" });
    const res = await POST(
      makeRequest({ keyword: "薬局", locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("DUPLICATE_KEYWORD");
  });

  it("上限20件の場合400を返す", async () => {
    mockCount.mockResolvedValue(20);
    const res = await POST(
      makeRequest({ keyword: "新キーワード", locationId: TEST_LOCATION_ID })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("LIMIT_EXCEEDED");
  });

  it("正常にキーワードが追加される", async () => {
    mockCreate.mockResolvedValue({
      id: "new-id",
      keyword: "薬局",
      createdAt: "2026-04-04",
    });
    const res = await POST(
      makeRequest({ keyword: "  薬局  ", locationId: TEST_LOCATION_ID })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.keyword.keyword).toBe("薬局");
    expect(mockCreate).toHaveBeenCalledWith({
      data: { locationId: TEST_LOCATION_ID, keyword: "薬局" },
      select: { id: true, keyword: true, createdAt: true },
    });
  });
});
