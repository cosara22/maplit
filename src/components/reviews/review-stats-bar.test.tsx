import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewStatsBar } from "./review-stats-bar";

describe("ReviewStatsBar", () => {
  it("統計データを正しく表示する", () => {
    render(
      <ReviewStatsBar
        stats={{
          totalReviews: 10,
          averageRating: 4.5,
          replyRate: 60,
          unrepliedCount: 4,
        }}
      />
    );

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("ラベルを正しく表示する", () => {
    render(
      <ReviewStatsBar
        stats={{
          totalReviews: 0,
          averageRating: 0,
          replyRate: 0,
          unrepliedCount: 0,
        }}
      />
    );

    expect(screen.getByText("総レビュー数")).toBeInTheDocument();
    expect(screen.getByText("平均評価")).toBeInTheDocument();
    expect(screen.getByText("返信率")).toBeInTheDocument();
    expect(screen.getByText("未返信")).toBeInTheDocument();
  });

  it("statsがnullの場合ダッシュを表示する", () => {
    render(<ReviewStatsBar stats={null} />);

    const dashes = screen.getAllByText("-");
    expect(dashes).toHaveLength(4);
  });
});
