// BOM (Byte Order Mark) — Excel で UTF-8 を正しく認識させるために必要
const BOM = "\uFEFF";

/** パフォーマンスCSVのヘッダー定義 */
const PERFORMANCE_HEADERS = [
  "検索数",
  "閲覧数",
  "ルートリクエスト",
  "通話クリック率(%)",
  "電話（メイン）",
  "通話ボタン",
  "ウェブサイト",
  "合計アクション",
] as const;

/** パフォーマンスデータの行 */
export interface PerformanceRow {
  searchCount: number;
  viewCount: number;
  directionRequests: number;
  callClickRate: number;
  phoneCalls: number;
  callButtonClicks: number;
  websiteClicks: number;
  totalActions: number;
}

/**
 * CSV用に値をエスケープする。
 * カンマ・ダブルクォート・改行を含む場合はダブルクォートで囲む。
 */
export function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 行データを CSV の1行に変換する
 */
function rowToCsvLine(values: string[]): string {
  return values.map(escapeCsvValue).join(",");
}

/**
 * パフォーマンスデータを BOM 付き UTF-8 CSV 文字列に変換する。
 * データが空配列の場合はヘッダー行のみ出力する。
 */
export function generatePerformanceCsv(rows: PerformanceRow[]): string {
  const headerLine = rowToCsvLine([...PERFORMANCE_HEADERS]);

  if (rows.length === 0) {
    return BOM + headerLine + "\n";
  }

  const dataLines = rows.map((row) =>
    rowToCsvLine([
      String(row.searchCount),
      String(row.viewCount),
      String(row.directionRequests),
      String(row.callClickRate),
      String(row.phoneCalls),
      String(row.callButtonClicks),
      String(row.websiteClicks),
      String(row.totalActions),
    ])
  );

  return BOM + [headerLine, ...dataLines].join("\n") + "\n";
}
