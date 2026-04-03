import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GbpScoreCard } from "./gbp-score-card";

// next/link のモック
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// recharts のモック（SVG描画をスキップ）
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div />,
}));

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";

describe("GbpScoreCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("読み込み中の表示がされる", () => {
    // fetchが解決しない状態をシミュレート
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<GbpScoreCard locationId={TEST_LOCATION_ID} />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("スコアデータを正しく表示する", async () => {
    const mockData = {
      totalScore: 65,
      maxScore: 100,
      scoreBreakdown: {
        basicInfo: 35,
        description: 0,
        subcategories: 10,
        photos: 10,
        hours: 10,
      },
      missingItems: ["ビジネスの説明（200文字以上）"],
      calculatedAt: "2026-04-01",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    render(<GbpScoreCard locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("65")).toBeInTheDocument();
    });
    expect(screen.getByText("/100")).toBeInTheDocument();
    expect(screen.getByText("ビジネスの説明（200文字以上）")).toBeInTheDocument();
    expect(screen.getByText("GBP設定を完了する")).toBeInTheDocument();
  });

  it("API失敗時にデータなしメッセージを表示する", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<GbpScoreCard locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("スコアデータがありません")).toBeInTheDocument();
    });
  });

  it("未設定項目が無い場合バッジを表示しない", async () => {
    const mockData = {
      totalScore: 100,
      maxScore: 100,
      scoreBreakdown: {
        basicInfo: 35,
        description: 20,
        subcategories: 10,
        photos: 25,
        hours: 10,
      },
      missingItems: [],
      calculatedAt: "2026-04-01",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    render(<GbpScoreCard locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("100")).toBeInTheDocument();
    });
    expect(screen.queryByText("未設定の項目")).not.toBeInTheDocument();
  });

  it("GBP設定リンクが/setupを指す", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          totalScore: 50,
          maxScore: 100,
          scoreBreakdown: {},
          missingItems: [],
          calculatedAt: null,
        }),
    });

    render(<GbpScoreCard locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      const link = screen.getByText("GBP設定を完了する").closest("a");
      expect(link).toHaveAttribute("href", "/setup");
    });
  });
});
