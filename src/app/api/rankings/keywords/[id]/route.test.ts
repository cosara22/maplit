import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { DELETE } from "./route";

const mockRequireAuth = vi.fn();
vi.mock("@/lib/api-helpers", () => ({
  requireAuth: () => mockRequireAuth(),
  isErrorResponse: (r: unknown) => r instanceof NextResponse,
  logApiError: vi.fn(),
}));

const mockFindFirst = vi.fn();
const mockDelete = vi.fn();
const mockDb = {
  keyword: {
    findFirst: mockFindFirst,
    delete: mockDelete,
  },
};

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";
const TEST_KEYWORD_ID = "00000000-0000-0000-0000-000000000030";

function callDelete(id: string) {
  return DELETE(
    new NextRequest(`http://localhost/api/rankings/keywords/${id}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("DELETE /api/rankings/keywords/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await callDelete(TEST_KEYWORD_ID);
    expect(res.status).toBe(401);
  });

  it("IDの形式が不正な場合400を返す", async () => {
    const res = await callDelete("invalid-id");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_ID");
  });

  it("キーワードが見つからない場合404を返す", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await callDelete(TEST_KEYWORD_ID);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("KEYWORD_NOT_FOUND");
  });

  it("正常にキーワードが削除される", async () => {
    mockFindFirst.mockResolvedValue({
      id: TEST_KEYWORD_ID,
      keyword: "薬局",
      location: { id: "loc-id", tenantId: TEST_TENANT_ID },
    });
    mockDelete.mockResolvedValue({});

    const res = await callDelete(TEST_KEYWORD_ID);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: TEST_KEYWORD_ID } });
  });
});
