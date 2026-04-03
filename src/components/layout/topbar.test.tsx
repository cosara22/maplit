import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Topbar } from "./topbar";

describe("Topbar", () => {
  it("ページタイトルが表示される", () => {
    render(<Topbar title="ダッシュボード" onMenuClick={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "ダッシュボード" }),
    ).toBeInTheDocument();
  });

  it("ハンバーガーメニューボタンが表示される", () => {
    render(<Topbar title="ダッシュボード" onMenuClick={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "メニューを開く" }),
    ).toBeInTheDocument();
  });

  it("ハンバーガーメニューをクリックするとonMenuClickが呼ばれる", async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();

    render(<Topbar title="ダッシュボード" onMenuClick={onMenuClick} />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));

    expect(onMenuClick).toHaveBeenCalledOnce();
  });

  it("異なるタイトルが正しく表示される", () => {
    render(<Topbar title="Google口コミ" onMenuClick={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Google口コミ" }),
    ).toBeInTheDocument();
  });
});
