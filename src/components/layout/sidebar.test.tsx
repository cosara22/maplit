import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./sidebar";

// next-auth/react のモック
const mockSignOut = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// next/navigation のモック
let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/";
  });

  it("ロゴとテナント名が表示される", () => {
    render(<Sidebar tenantName="テスト薬局" />);

    expect(screen.getByText("MapLit")).toBeInTheDocument();
    expect(screen.getByText("テスト薬局")).toBeInTheDocument();
  });

  it("8つのナビゲーション項目が表示される", () => {
    render(<Sidebar tenantName="テスト薬局" />);

    expect(screen.getByText("ダッシュボード")).toBeInTheDocument();
    expect(screen.getByText("GBP設定")).toBeInTheDocument();
    expect(screen.getByText("アンケート")).toBeInTheDocument();
    expect(screen.getByText("口コミ")).toBeInTheDocument();
    expect(screen.getByText("NGワード")).toBeInTheDocument();
    expect(screen.getByText("分析")).toBeInTheDocument();
    expect(screen.getByText("サイテーション")).toBeInTheDocument();
    expect(screen.getByText("設定")).toBeInTheDocument();
  });

  it("アクティブなメニュー項目がハイライトされる", () => {
    mockPathname = "/reviews";
    render(<Sidebar tenantName="テスト薬局" />);

    const activeLink = screen.getByText("口コミ").closest("a");
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveClass("border-[#6366f1]");
  });

  it("ダッシュボード（/）がアクティブのとき正しくハイライトされる", () => {
    mockPathname = "/";
    render(<Sidebar tenantName="テスト薬局" />);

    const dashboardLink = screen.getByText("ダッシュボード").closest("a");
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("サブページでも親メニューがアクティブになる", () => {
    mockPathname = "/reviews/123";
    render(<Sidebar tenantName="テスト薬局" />);

    const reviewsLink = screen.getByText("口コミ").closest("a");
    expect(reviewsLink).toHaveAttribute("aria-current", "page");
  });

  it("ログアウトボタンが表示される", () => {
    render(<Sidebar tenantName="テスト薬局" />);

    expect(screen.getByText("ログアウト")).toBeInTheDocument();
  });

  it("ログアウトボタンをクリックするとsignOutが呼ばれる", async () => {
    const user = userEvent.setup();
    mockSignOut.mockResolvedValue(undefined);

    render(<Sidebar tenantName="テスト薬局" />);

    await user.click(screen.getByText("ログアウト"));

    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });

  it("ナビゲーション項目クリック時にonNavigateが呼ばれる", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<Sidebar tenantName="テスト薬局" onNavigate={onNavigate} />);

    await user.click(screen.getByText("口コミ"));

    expect(onNavigate).toHaveBeenCalled();
  });

  it("各ナビゲーション項目が正しいhrefを持つ", () => {
    render(<Sidebar tenantName="テスト薬局" />);

    const expectedLinks = [
      { label: "ダッシュボード", href: "/" },
      { label: "GBP設定", href: "/setup" },
      { label: "アンケート", href: "/surveys" },
      { label: "口コミ", href: "/reviews" },
      { label: "NGワード", href: "/ng-words" },
      { label: "分析", href: "/rank-analytics" },
      { label: "サイテーション", href: "/citations" },
      { label: "設定", href: "/settings" },
    ];

    for (const { label, href } of expectedLinks) {
      const link = screen.getByText(label).closest("a");
      expect(link).toHaveAttribute("href", href);
    }
  });
});
