import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardShell } from "./dashboard-shell";

// next-auth/react のモック
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// next/navigation のモック
let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("DashboardShell", () => {
  beforeEach(() => {
    mockPathname = "/";
  });

  it("サイドバーとトップバーとメインコンテンツが表示される", () => {
    render(
      <DashboardShell tenantName="テスト薬局">
        <div>テストコンテンツ</div>
      </DashboardShell>,
    );

    // サイドバー内のテナント名
    expect(screen.getByText("テスト薬局")).toBeInTheDocument();
    // トップバーのタイトル
    expect(
      screen.getByRole("heading", { name: "ダッシュボード" }),
    ).toBeInTheDocument();
    // メインコンテンツ
    expect(screen.getByText("テストコンテンツ")).toBeInTheDocument();
  });

  it("パスに応じたページタイトルが表示される", () => {
    mockPathname = "/reviews";
    render(
      <DashboardShell tenantName="テスト薬局">
        <div>口コミ一覧</div>
      </DashboardShell>,
    );

    expect(
      screen.getByRole("heading", { name: "Google口コミ" }),
    ).toBeInTheDocument();
  });

  it("サブページでも親のタイトルが表示される", () => {
    mockPathname = "/surveys/new";
    render(
      <DashboardShell tenantName="テスト薬局">
        <div>新規アンケート</div>
      </DashboardShell>,
    );

    expect(
      screen.getByRole("heading", { name: "アンケート管理" }),
    ).toBeInTheDocument();
  });

  it("未知のパスではMapLitが表示される", () => {
    mockPathname = "/unknown";
    render(
      <DashboardShell tenantName="テスト薬局">
        <div>不明</div>
      </DashboardShell>,
    );

    expect(
      screen.getByRole("heading", { name: "MapLit" }),
    ).toBeInTheDocument();
  });

  it("ハンバーガーメニューでモバイルサイドバーが開閉できる", async () => {
    const user = userEvent.setup();

    render(
      <DashboardShell tenantName="テスト薬局">
        <div>テストコンテンツ</div>
      </DashboardShell>,
    );

    // ハンバーガーメニューをクリック
    await user.click(screen.getByRole("button", { name: "メニューを開く" }));

    // モバイルサイドバー内にもテナント名が表示される（デスクトップ+モバイルで2つ）
    const tenantNames = screen.getAllByText("テスト薬局");
    expect(tenantNames.length).toBeGreaterThanOrEqual(2);
  });

  it("メインエリアにchildrenが正しくレンダリングされる", () => {
    render(
      <DashboardShell tenantName="テスト薬局">
        <div data-testid="child-content">子コンテンツ</div>
      </DashboardShell>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });
});
