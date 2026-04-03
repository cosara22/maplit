import { describe, it, expect } from "vitest";
import {
  calculateGbpScore,
  type LocationForScore,
  type ScoreBreakdown,
} from "./gbp-score";

// 全項目入力済みのテスト用ロケーション
function createFullLocation(): LocationForScore {
  return {
    name: "しん薬局",
    address: "東京都渋谷区神南1-2-3",
    phone: "03-1234-5678",
    website: "https://shin-pharmacy.example.com",
    category: "薬局",
    businessDescription: "あ".repeat(200), // 200文字以上
    subcategories: ["調剤薬局", "OTC医薬品"],
    businessHours: {
      monday: { open: "09:00", close: "18:00" },
      tuesday: { open: "09:00", close: "18:00" },
    },
    logoUrl: "https://example.com/logo.png",
    coverUrl: "https://example.com/cover.jpg",
    photos: [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg",
      "https://example.com/photo3.jpg",
    ],
  };
}

describe("calculateGbpScore", () => {
  // UT-SCORE-01: 全項目入力済みの場合100点を返す
  it("全項目入力済みの場合100点を返す", () => {
    const location = createFullLocation();
    const result = calculateGbpScore(location);

    expect(result.totalScore).toBe(100);
    expect(result.missingItems).toEqual([]);
  });

  // UT-SCORE-02: ビジネス説明未入力の場合減点
  it("ビジネス説明未入力の場合 -20点", () => {
    const location = createFullLocation();
    location.businessDescription = null;
    const result = calculateGbpScore(location);

    expect(result.totalScore).toBe(80); // 100 - 説明文(20) = 80
    expect(result.scoreBreakdown.description.score).toBe(0);
    expect(result.missingItems).toContain("ビジネスの説明");
  });

  // UT-SCORE-03: ビジネス説明200文字未満の場合減点
  it("ビジネス説明200文字未満の場合部分点", () => {
    const location = createFullLocation();
    location.businessDescription = "短い説明文です"; // 7文字
    const result = calculateGbpScore(location);

    // 部分点: floor(7/200 * 10) = 0
    expect(result.totalScore).toBe(80); // 100 - 20 + 0
    expect(result.scoreBreakdown.description.score).toBe(0);
    expect(result.missingItems).toContain("ビジネスの説明（200文字以上）");
  });

  // UT-SCORE-04: ロゴ未設定の場合減点
  it("ロゴ未設定の場合 -8点", () => {
    const location = createFullLocation();
    location.logoUrl = null;
    const result = calculateGbpScore(location);

    expect(result.totalScore).toBe(92); // 100 - ロゴ(8) = 92
    expect(result.scoreBreakdown.photos.score).toBe(17); // 25 - 8 = 17
    expect(result.missingItems).toContain("ロゴ");
  });

  // UT-SCORE-05: カバー写真未設定の場合減点
  it("カバー写真未設定の場合 -7点", () => {
    const location = createFullLocation();
    location.coverUrl = null;
    const result = calculateGbpScore(location);

    expect(result.totalScore).toBe(93); // 100 - カバー(7) = 93
    expect(result.scoreBreakdown.photos.score).toBe(18); // 25 - 7 = 18
    expect(result.missingItems).toContain("カバー写真");
  });

  // UT-SCORE-06: サブカテゴリ未設定の場合減点
  it("サブカテゴリ未設定の場合 -10点", () => {
    const location = createFullLocation();
    location.subcategories = [];
    const result = calculateGbpScore(location);

    expect(result.totalScore).toBe(90); // 100 - サブカテゴリ(10) = 90
    expect(result.scoreBreakdown.subcategories.score).toBe(0);
    expect(result.missingItems).toContain("サブカテゴリー");
  });

  // UT-SCORE-07: 営業時間未設定の場合減点
  it("営業時間未設定の場合 -10点", () => {
    const location = createFullLocation();
    location.businessHours = null;
    const result = calculateGbpScore(location);

    expect(result.totalScore).toBe(90); // 100 - 営業時間(10) = 90
    expect(result.scoreBreakdown.businessHours.score).toBe(0);
    expect(result.missingItems).toContain("営業時間");
  });

  // UT-SCORE-08: 電話番号未設定の場合減点
  it("電話番号未設定の場合 -7点", () => {
    const location = createFullLocation();
    location.phone = null;
    const result = calculateGbpScore(location);

    expect(result.totalScore).toBe(93); // 100 - 電話番号(7) = 93
    expect(result.scoreBreakdown.basicInfo.score).toBe(28); // 35 - 7 = 28
    expect(result.missingItems).toContain("電話番号");
  });

  // UT-SCORE-09: 写真0枚の場合減点
  it("写真0枚の場合 -10点", () => {
    const location = createFullLocation();
    location.photos = [];
    const result = calculateGbpScore(location);

    expect(result.totalScore).toBe(90); // 100 - 通常写真(10) = 90
    expect(result.scoreBreakdown.photos.score).toBe(15); // logo(8) + cover(7) + 0
    expect(result.missingItems).toContain("写真");
  });

  // UT-SCORE-10: scoreBreakdown各カテゴリが正しく算出される
  it("scoreBreakdown各カテゴリが正しく算出される", () => {
    // 部分的な入力: 基本情報一部欠落、説明200文字未満、写真1枚
    const location: LocationForScore = {
      name: "しん薬局",
      address: "東京都渋谷区神南1-2-3",
      phone: null, // 未設定 → 基本情報 -7
      website: null, // 未設定 → 基本情報 -7
      category: "薬局",
      businessDescription: "あ".repeat(100), // 200文字未満 → 部分点
      subcategories: ["調剤薬局"], // 設定済み → 10点
      businessHours: null, // 未設定 → 0点
      logoUrl: "https://example.com/logo.png", // 設定済み → 8点
      coverUrl: null, // 未設定 → 0点
      photos: ["https://example.com/photo1.jpg"], // 1枚 → 部分点
    };

    const result = calculateGbpScore(location);
    const breakdown: ScoreBreakdown = result.scoreBreakdown;

    // 基本情報: name(7) + address(7) + category(7) = 21 / 35
    expect(breakdown.basicInfo.score).toBe(21);
    expect(breakdown.basicInfo.maxScore).toBe(35);

    // 説明文: 100/200 * 10 = 5 / 20（部分点）
    expect(breakdown.description.score).toBe(5);
    expect(breakdown.description.maxScore).toBe(20);

    // サブカテゴリ: 10 / 10
    expect(breakdown.subcategories.score).toBe(10);
    expect(breakdown.subcategories.maxScore).toBe(10);

    // 写真: logo(8) + cover(0) + general(1/3*10=3) = 11 / 25
    expect(breakdown.photos.score).toBe(11);
    expect(breakdown.photos.maxScore).toBe(25);

    // 営業時間: 0 / 10
    expect(breakdown.businessHours.score).toBe(0);
    expect(breakdown.businessHours.maxScore).toBe(10);

    // 合計: 21 + 5 + 10 + 11 + 0 = 47
    expect(result.totalScore).toBe(47);

    // 欠落項目の検証
    expect(result.missingItems).toContain("電話番号");
    expect(result.missingItems).toContain("Webサイト");
    expect(result.missingItems).toContain("ビジネスの説明（200文字以上）");
    expect(result.missingItems).toContain("営業時間");
    expect(result.missingItems).toContain("カバー写真");
    expect(result.missingItems).toContain("写真（3枚以上）");
    expect(result.missingItems).not.toContain("店舗名");
    expect(result.missingItems).not.toContain("住所");
    expect(result.missingItems).not.toContain("カテゴリ");
    expect(result.missingItems).not.toContain("ロゴ");
    expect(result.missingItems).not.toContain("サブカテゴリー");
  });
});
