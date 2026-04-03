/** 有効な期間パラメータ */
export const VALID_PERIODS = ["30d", "90d", "1y", "all"] as const;
export type Period = (typeof VALID_PERIODS)[number];

/** 期間パラメータのホワイトリスト検証 */
export function isValidPeriod(value: string): value is Period {
  return (VALID_PERIODS as readonly string[]).includes(value);
}

/** 期間パラメータから日数を計算。"all" の場合は null を返す。 */
export function getPeriodDays(period: Period): number | null {
  switch (period) {
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
    case "all":
      return null;
  }
}

/** パフォーマンスメトリクス取得時の結果件数上限（メモリ保護） */
export const MAX_METRICS = 1000;
