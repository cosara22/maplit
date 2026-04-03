// GBP完成度スコア算出ロジック

/** スコア算出に必要なLocationフィールド */
export interface LocationForScore {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  businessDescription: string | null;
  subcategories: unknown;
  businessHours: unknown;
  logoUrl: string | null;
  coverUrl: string | null;
  photos: unknown;
}

/** カテゴリ別スコア */
export interface CategoryScore {
  score: number;
  maxScore: number;
}

/** スコア算出結果 */
export interface ScoreBreakdown {
  basicInfo: CategoryScore;
  description: CategoryScore;
  subcategories: CategoryScore;
  photos: CategoryScore;
  businessHours: CategoryScore;
}

export interface GbpScoreResult {
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  missingItems: string[];
}

// スコア配分定義
const SCORES = {
  // 基本情報 35点（各7点）
  basicInfo: {
    max: 35,
    items: [
      { field: "name" as const, label: "店舗名", points: 7 },
      { field: "address" as const, label: "住所", points: 7 },
      { field: "phone" as const, label: "電話番号", points: 7 },
      { field: "website" as const, label: "Webサイト", points: 7 },
      { field: "category" as const, label: "カテゴリ", points: 7 },
    ],
  },
  // 説明文 20点
  description: {
    max: 20,
    minLength: 200,
  },
  // サブカテゴリ 10点
  subcategories: {
    max: 10,
  },
  // 写真 25点
  photos: {
    max: 25,
    logo: 8,
    cover: 7,
    general: 10,
    minPhotos: 3,
  },
  // 営業時間 10点
  businessHours: {
    max: 10,
  },
} as const;

/** JSON配列フィールドを安全にパースする */
function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

/** 営業時間が有効に設定されているか判定する */
function isNonEmptyBusinessHours(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

/** GBP完成度スコアを算出する */
export function calculateGbpScore(location: LocationForScore): GbpScoreResult {
  const missingItems: string[] = [];

  // --- 基本情報 (35点) ---
  let basicInfoScore = 0;
  for (const item of SCORES.basicInfo.items) {
    const value = location[item.field];
    if (value && String(value).trim().length > 0) {
      basicInfoScore += item.points;
    } else {
      missingItems.push(item.label);
    }
  }

  // --- 説明文 (20点) ---
  let descriptionScore = 0;
  const desc = location.businessDescription;
  if (!desc || desc.trim().length === 0) {
    missingItems.push("ビジネスの説明");
    descriptionScore = 0;
  } else if (desc.trim().length < SCORES.description.minLength) {
    missingItems.push("ビジネスの説明（200文字以上）");
    // 文字数に応じた部分点（半分）
    descriptionScore = Math.floor(
      (desc.trim().length / SCORES.description.minLength) *
        (SCORES.description.max / 2)
    );
  } else {
    descriptionScore = SCORES.description.max;
  }

  // --- サブカテゴリ (10点) ---
  let subcategoriesScore = 0;
  const subs = parseJsonArray(location.subcategories);
  if (subs.length > 0) {
    subcategoriesScore = SCORES.subcategories.max;
  } else {
    missingItems.push("サブカテゴリー");
  }

  // --- 写真 (25点) ---
  let photosScore = 0;

  if (location.logoUrl && location.logoUrl.trim().length > 0) {
    photosScore += SCORES.photos.logo;
  } else {
    missingItems.push("ロゴ");
  }

  if (location.coverUrl && location.coverUrl.trim().length > 0) {
    photosScore += SCORES.photos.cover;
  } else {
    missingItems.push("カバー写真");
  }

  const photoArray = parseJsonArray(location.photos);
  if (photoArray.length >= SCORES.photos.minPhotos) {
    photosScore += SCORES.photos.general;
  } else if (photoArray.length > 0) {
    // 枚数に応じた部分点
    photosScore += Math.floor(
      (photoArray.length / SCORES.photos.minPhotos) * SCORES.photos.general
    );
    missingItems.push(`写真（${SCORES.photos.minPhotos}枚以上）`);
  } else {
    missingItems.push("写真");
  }

  // --- 営業時間 (10点) ---
  let businessHoursScore = 0;
  if (isNonEmptyBusinessHours(location.businessHours)) {
    businessHoursScore = SCORES.businessHours.max;
  } else {
    missingItems.push("営業時間");
  }

  const scoreBreakdown: ScoreBreakdown = {
    basicInfo: { score: basicInfoScore, maxScore: SCORES.basicInfo.max },
    description: {
      score: descriptionScore,
      maxScore: SCORES.description.max,
    },
    subcategories: {
      score: subcategoriesScore,
      maxScore: SCORES.subcategories.max,
    },
    photos: { score: photosScore, maxScore: SCORES.photos.max },
    businessHours: {
      score: businessHoursScore,
      maxScore: SCORES.businessHours.max,
    },
  };

  const totalScore =
    basicInfoScore +
    descriptionScore +
    subcategoriesScore +
    photosScore +
    businessHoursScore;

  return {
    totalScore,
    scoreBreakdown,
    missingItems,
  };
}
