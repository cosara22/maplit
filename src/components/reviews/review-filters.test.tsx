import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewFilters } from "./review-filters";

const defaultProps = {
  filter: "all",
  sort: "newest",
  search: "",
  period: "",
  onFilterChange: vi.fn(),
  onSortChange: vi.fn(),
  onSearchChange: vi.fn(),
  onPeriodChange: vi.fn(),
};

describe("ReviewFilters", () => {
  it("フィルタチップを全て表示する", () => {
    render(<ReviewFilters {...defaultProps} />);

    expect(screen.getByText("すべて")).toBeInTheDocument();
    expect(screen.getByText("未返信")).toBeInTheDocument();
    expect(screen.getByText("返信済み")).toBeInTheDocument();
    expect(screen.getByText("高評価(4★+)")).toBeInTheDocument();
    expect(screen.getByText("低評価(3★-)")).toBeInTheDocument();
    expect(screen.getByText("AIO高スコア(4+)")).toBeInTheDocument();
  });

  it("フィルタチップクリックでonFilterChangeが呼ばれる", () => {
    const onFilterChange = vi.fn();
    render(<ReviewFilters {...defaultProps} onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByText("未返信"));
    expect(onFilterChange).toHaveBeenCalledWith("unreplied");
  });

  it("検索入力でonSearchChangeが呼ばれる", () => {
    const onSearchChange = vi.fn();
    render(<ReviewFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByPlaceholderText("口コミを検索...");
    fireEvent.change(searchInput, { target: { value: "良い" } });
    expect(onSearchChange).toHaveBeenCalledWith("良い");
  });

  it("アクティブなフィルタが強調表示される", () => {
    render(<ReviewFilters {...defaultProps} filter="unreplied" />);

    const unrepliedChip = screen.getByText("未返信");
    expect(unrepliedChip.className).toContain("bg-indigo-600");
    expect(unrepliedChip.className).toContain("text-white");
  });
});
