// SerpAPI連携ライブラリ
// Google Maps検索結果から店舗の順位を計測する

const SERPAPI_BASE_URL = "https://serpapi.com/search.json";
const MAX_RESULTS_TO_CHECK = 20;
const REQUEST_TIMEOUT_MS = 30000;

interface SerpApiLocalResult {
  place_id?: string;
  position?: number;
  title?: string;
  [key: string]: unknown;
}

interface SerpApiResponse {
  local_results?: SerpApiLocalResult[];
  error?: string;
  [key: string]: unknown;
}

export interface RankMeasurement {
  keyword: string;
  rankPosition: number | null; // null = 圏外
  measuredAt: Date;
  latitude: number;
  longitude: number;
}

/**
 * SerpAPIキーの取得。未設定の場合はnullを返す。
 */
function getApiKey(): string | null {
  return process.env.SERP_API_KEY || null;
}

/**
 * SerpAPIキーが設定済みかチェック
 */
export function isSerpApiConfigured(): boolean {
  return !!getApiKey();
}

/**
 * SerpAPI google_maps エンジンで検索し、指定店舗の順位を取得する
 *
 * @param keyword - 検索キーワード（例: "薬局"）
 * @param latitude - 検索地点の緯度
 * @param longitude - 検索地点の経度
 * @param gbpPlaceId - 自店舗のGoogle Place ID（place_id照合用）
 * @returns 順位（1-based）またはnull（圏外）
 */
export async function measureKeywordRank(
  keyword: string,
  latitude: number,
  longitude: number,
  gbpPlaceId: string
): Promise<RankMeasurement> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("SERP_API_KEYが設定されていません");
  }

  const params = new URLSearchParams({
    engine: "google_maps",
    q: keyword,
    ll: `@${latitude},${longitude},15z`,
    api_key: apiKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${SERPAPI_BASE_URL}?${params}`, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `SerpAPI リクエスト失敗: ${response.status} ${response.statusText}`
    );
  }

  const data: SerpApiResponse = await response.json();

  if (data.error) {
    throw new Error(`SerpAPI エラー: ${data.error}`);
  }

  const localResults = data.local_results ?? [];
  let rankPosition: number | null = null;

  // local_resultsからplace_idが一致する結果を探す
  for (let i = 0; i < Math.min(localResults.length, MAX_RESULTS_TO_CHECK); i++) {
    if (localResults[i].place_id === gbpPlaceId) {
      rankPosition = i + 1; // 1-based
      break;
    }
  }

  return {
    keyword,
    rankPosition,
    measuredAt: new Date(),
    latitude,
    longitude,
  };
}

/**
 * 複数キーワードの順位を一括計測する
 */
export async function measureMultipleKeywords(
  keywords: string[],
  latitude: number,
  longitude: number,
  gbpPlaceId: string
): Promise<{ results: RankMeasurement[]; errors: { keyword: string; error: string }[] }> {
  const results: RankMeasurement[] = [];
  const errors: { keyword: string; error: string }[] = [];

  // 順次実行（API レート制限対策）
  for (const keyword of keywords) {
    try {
      const result = await measureKeywordRank(
        keyword,
        latitude,
        longitude,
        gbpPlaceId
      );
      results.push(result);
    } catch (error) {
      errors.push({
        keyword,
        error: error instanceof Error ? error.message : "計測に失敗しました",
      });
    }
  }

  return { results, errors };
}
