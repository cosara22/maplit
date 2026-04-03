import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewPagination } from "./review-pagination";

describe("ReviewPagination", () => {
  it("ページ番号を正しく表示する", () => {
    render(
      <ReviewPagination page={1} totalPages={5} onPageChange={vi.fn()} />
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("ページクリックでonPageChangeが呼ばれる", () => {
    const onPageChange = vi.fn();
    render(
      <ReviewPagination page={1} totalPages={5} onPageChange={onPageChange} />
    );

    fireEvent.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("最初のページで前へボタンが無効になる", () => {
    render(
      <ReviewPagination page={1} totalPages={5} onPageChange={vi.fn()} />
    );

    // ChevronLeftを含むボタンを取得（最初のボタン）
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("最後のページで次へボタンが無効になる", () => {
    render(
      <ReviewPagination page={5} totalPages={5} onPageChange={vi.fn()} />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });
});
