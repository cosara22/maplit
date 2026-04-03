import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SearchKeywordsCard } from "./search-keywords-card";

describe("SearchKeywordsCard", () => {
  it("キーワードが無い場合メッセージを表示", () => {
    render(<SearchKeywordsCard keywords={[]} />);
    expect(
      screen.getByText("検索キーワードデータがありません")
    ).toBeInTheDocument();
  });

  it("キーワードリストを正しく表示する", () => {
    const keywords = [
      { keyword: "薬局", count: 13042, isTracked: false },
      { keyword: "調剤薬局", count: 1275, isTracked: false },
      { keyword: "ドラッグストア", count: 447, isTracked: true },
    ];

    render(<SearchKeywordsCard keywords={keywords} />);

    expect(screen.getByText("薬局")).toBeInTheDocument();
    expect(screen.getByText("13,042")).toBeInTheDocument();
    expect(screen.getByText("調剤薬局")).toBeInTheDocument();
    expect(screen.getByText("1,275")).toBeInTheDocument();
    expect(screen.getByText("ドラッグストア")).toBeInTheDocument();
    expect(screen.getByText("447")).toBeInTheDocument();
  });

  it("未トラッキングのキーワードに登録ボタンを表示", () => {
    const keywords = [
      { keyword: "薬局", count: 100, isTracked: false },
      { keyword: "調剤", count: 50, isTracked: true },
    ];

    render(<SearchKeywordsCard keywords={keywords} />);

    const buttons = screen.getAllByText("キーワード分析登録");
    // isTracked=falseのキーワードだけボタンがある
    expect(buttons).toHaveLength(1);
  });

  it("番号が正しく表示される", () => {
    const keywords = [
      { keyword: "薬局", count: 100, isTracked: false },
      { keyword: "調剤", count: 50, isTracked: false },
    ];

    render(<SearchKeywordsCard keywords={keywords} />);

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
  });
});
