import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerformanceSection } from "./performance-section";

const TEST_LOCATION_ID = "00000000-0000-0000-0000-000000000001";

const mockPerformanceData = {
  searchCount: 1267,
  viewCount: 1206,
  directionRequests: 61,
  callClickRate: 4.42,
  phoneCalls: 10,
  callButtonClicks: 46,
  websiteClicks: 0,
  totalActions: 0,
  periodEnd: "2026-03-29",
  searchKeywords: [],
};

describe("PerformanceSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("読み込み中の表示がされる", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<PerformanceSection locationId={TEST_LOCATION_ID} />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("8つのKPIカードを表示する", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPerformanceData),
    });

    render(<PerformanceSection locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("検索数")).toBeInTheDocument();
    });
    expect(screen.getByText("閲覧数")).toBeInTheDocument();
    expect(screen.getByText("ルートリクエスト")).toBeInTheDocument();
    expect(screen.getByText("通話クリック率")).toBeInTheDocument();
    expect(screen.getByText("電話（メイン）")).toBeInTheDocument();
    expect(screen.getByText("通話ボタン")).toBeInTheDocument();
    expect(screen.getByText("ウェブサイト")).toBeInTheDocument();
    expect(screen.getByText("合計アクション")).toBeInTheDocument();
  });

  it("KPI値が正しくフォーマットされる", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPerformanceData),
    });

    render(<PerformanceSection locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("1,267")).toBeInTheDocument();
    });
    expect(screen.getByText("1,206")).toBeInTheDocument();
    expect(screen.getByText("4.42%")).toBeInTheDocument();
  });

  it("期間セレクターが表示される", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPerformanceData),
    });

    render(<PerformanceSection locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("パフォーマンス")).toBeInTheDocument();
    });
    const compareBtn = screen.getByText("期間比較");
    expect(compareBtn).toBeInTheDocument();
    expect(compareBtn.closest("button")).toBeDisabled();
  });

  it("CSVボタンが表示される", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPerformanceData),
    });

    render(<PerformanceSection locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument();
    });
    const csvBtn = screen.getByText("CSV").closest("button");
    expect(csvBtn).not.toBeDisabled();
  });

  it("読み込み中はCSVボタンがdisabledになる", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<PerformanceSection locationId={TEST_LOCATION_ID} />);
    const csvBtn = screen.getByText("CSV").closest("button");
    expect(csvBtn).toBeDisabled();
  });

  it("CSVボタンクリックでAPIを呼び出す", async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(["csv-data"], { type: "text/csv" });
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPerformanceData),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    render(<PerformanceSection locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument();
    });

    await user.click(screen.getByText("CSV").closest("button")!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    const secondCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondCall).toContain("/api/export/performance");
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it("データ取得失敗時にデータなしメッセージを表示", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<PerformanceSection locationId={TEST_LOCATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("データがありません")).toBeInTheDocument();
    });
  });
});
