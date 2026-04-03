import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// モック: auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// モック: next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("REDIRECT");
  },
}));

// モック: prisma-tenant
const mockLocationFindFirst = vi.fn();
vi.mock("@/lib/prisma-tenant", () => ({
  createTenantClient: () => ({
    location: { findFirst: mockLocationFindFirst },
  }),
}));

// モック: ReviewsContent
vi.mock("@/components/reviews/reviews-content", () => ({
  ReviewsContent: ({ locationId }: { locationId: string }) => (
    <div data-testid="reviews-content">Reviews ({locationId})</div>
  ),
}));

import ReviewsPage from "./page";

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000010";

describe("ReviewsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合/loginにリダイレクトする", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(ReviewsPage()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("店舗が無い場合メッセージを表示する", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue(null);

    const result = await ReviewsPage();
    render(result);

    expect(
      screen.getByText(
        "店舗が登録されていません。GBP初期設定から店舗を追加してください。"
      )
    ).toBeInTheDocument();
  });

  it("店舗がある場合ReviewsContentを表示する", async () => {
    mockAuth.mockResolvedValue({
      user: { tenantId: TEST_TENANT_ID },
    });
    mockLocationFindFirst.mockResolvedValue({
      id: "loc-001",
      name: "テスト薬局",
    });

    const result = await ReviewsPage();
    render(result);

    expect(screen.getByTestId("reviews-content")).toBeInTheDocument();
    expect(screen.getByText("Reviews (loc-001)")).toBeInTheDocument();
  });
});
