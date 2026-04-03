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
  ngWord: {
    findFirst: mockFindFirst,
    delete: mockDelete,
  },
};

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";
const TEST_NG_WORD_ID = "00000000-0000-0000-0000-000000000001";

function createDeleteRequest(id: string) {
  return new NextRequest(`http://localhost/api/ng-words/${id}`, {
    method: "DELETE",
  });
}

describe("DELETE /api/ng-words/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ tenantId: TEST_TENANT_ID, db: mockDb });
  });

  it("未認証の場合401を返す", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    );
    const res = await DELETE(createDeleteRequest(TEST_NG_WORD_ID), {
      params: Promise.resolve({ id: TEST_NG_WORD_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("IDがUUID形式でない場合400を返す", async () => {
    const res = await DELETE(createDeleteRequest("invalid"), {
      params: Promise.resolve({ id: "invalid" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_ID");
  });

  it("存在しないIDの場合404を返す", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await DELETE(createDeleteRequest(TEST_NG_WORD_ID), {
      params: Promise.resolve({ id: TEST_NG_WORD_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("正常に削除される", async () => {
    mockFindFirst.mockResolvedValue({ id: TEST_NG_WORD_ID, word: "競合店名" });
    mockDelete.mockResolvedValue({});
    const res = await DELETE(createDeleteRequest(TEST_NG_WORD_ID), {
      params: Promise.resolve({ id: TEST_NG_WORD_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: TEST_NG_WORD_ID } });
  });
});
