import { describe, it, expect } from "vitest";
import {
  generatePerformanceCsv,
  escapeCsvValue,
  PerformanceRow,
} from "./csv-export";

const HEADER =
  "検索数,閲覧数,ルートリクエスト,通話クリック率(%),電話（メイン）,通話ボタン,ウェブサイト,合計アクション";
const BOM = "\uFEFF";

const sampleRow: PerformanceRow = {
  searchCount: 1267,
  viewCount: 1206,
  directionRequests: 61,
  callClickRate: 4.42,
  phoneCalls: 10,
  callButtonClicks: 46,
  websiteClicks: 0,
  totalActions: 117,
};

describe("generatePerformanceCsv", () => {
  // UT-CSV-01: パフォーマンスデータが正しいCSVフォーマットで出力される
  it("UT-CSV-01: ヘッダー + データ行が正しいフォーマットで出力される", () => {
    const csv = generatePerformanceCsv([sampleRow]);
    const lines = csv.replace(BOM, "").trimEnd().split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe("1267,1206,61,4.42,10,46,0,117");
  });

  // UT-CSV-02: 日本語を含むデータがBOM付きUTF-8で出力される
  it("UT-CSV-02: BOM付きUTF-8で出力される", () => {
    const csv = generatePerformanceCsv([sampleRow]);

    // BOM (U+FEFF) が先頭にある
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    // ヘッダーに日本語が含まれる
    expect(csv).toContain("検索数");
  });

  // UT-CSV-03: カンマを含む値がダブルクォートで囲まれる
  it("UT-CSV-03: カンマを含む値がダブルクォートで囲まれる", () => {
    expect(escapeCsvValue("東京都渋谷区,1-8-5")).toBe(
      '"東京都渋谷区,1-8-5"'
    );
    // ダブルクォートを含む値はエスケープされる
    expect(escapeCsvValue('値に"引用符"あり')).toBe(
      '"値に""引用符""あり"'
    );
    // 改行を含む値も囲まれる
    expect(escapeCsvValue("行1\n行2")).toBe('"行1\n行2"');
    // 特殊文字なしの場合はそのまま
    expect(escapeCsvValue("通常の値")).toBe("通常の値");
  });

  // UT-CSV-04: 空データの場合ヘッダーのみ出力
  it("UT-CSV-04: 空データの場合ヘッダーのみ出力される", () => {
    const csv = generatePerformanceCsv([]);
    const lines = csv.replace(BOM, "").trimEnd().split("\n");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(HEADER);
  });

  it("複数行のデータが正しく出力される", () => {
    const row2: PerformanceRow = {
      searchCount: 500,
      viewCount: 300,
      directionRequests: 20,
      callClickRate: 2.5,
      phoneCalls: 5,
      callButtonClicks: 15,
      websiteClicks: 10,
      totalActions: 50,
    };
    const csv = generatePerformanceCsv([sampleRow, row2]);
    const lines = csv.replace(BOM, "").trimEnd().split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("500,300,20,2.5,5,15,10,50");
  });
});
