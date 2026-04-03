import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("ダッシュボードのタイトルが表示される", () => {
    render(<DashboardPage />);
    expect(screen.getByText("ダッシュボード")).toBeInTheDocument();
  });

  it("プレースホルダーテキストが表示される", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText("ここにKPIカードやグラフが表示されます"),
    ).toBeInTheDocument();
  });
});
