import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ReviewSummaryCard } from "./review-summary-card";

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";

describe("ReviewSummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("読み込み中の表示がされる", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<ReviewSummaryCard locationId={TEST_LOCATION_ID} />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("レビューサマリーを正しく表示する", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          totalReviews: 3,
          averageRating: 5.0,
          replyRate: 0,
          unrepliedCount: 3,
          ratingDistribution: { "5": 3, "4": 0, "3": 0, "2": 0, "1": 0 },
        }),
    });

    render(<ReviewSummaryCard locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("3件のレビュー")).toBeInTheDocument();
    });
    // 平均評価が2xl font-boldで表示されている
    const ratingEl = screen.getByText("5", { selector: ".text-2xl" });
    expect(ratingEl).toBeInTheDocument();
    expect(screen.getByText("評価とレビュー")).toBeInTheDocument();
  });

  it("返信率と未返信数を表示する", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          totalReviews: 5,
          averageRating: 3.8,
          replyRate: 40,
          unrepliedCount: 3,
          ratingDistribution: { "5": 2, "4": 1, "3": 1, "2": 0, "1": 1 },
        }),
    });

    render(<ReviewSummaryCard locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("5件のレビュー")).toBeInTheDocument();
    });
    expect(screen.getByText("返信率: 40%")).toBeInTheDocument();
    expect(screen.getByText("未返信: 3件")).toBeInTheDocument();
  });

  it("API失敗時にデータなしメッセージを表示する", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<ReviewSummaryCard locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(
        screen.getByText("レビューデータがありません")
      ).toBeInTheDocument();
    });
  });
});
