"use client";

import { useState, useCallback } from "react";
import { GbpScoreCard } from "./gbp-score-card";
import { PerformanceSection } from "./performance-section";
import { ReviewSummaryCard } from "./review-summary-card";
import { SearchKeywordsCard } from "./search-keywords-card";

interface SearchKeyword {
  keyword: string;
  count: number;
  isTracked: boolean;
}

interface DashboardContentProps {
  locationId: string;
  locationName: string;
}

export function DashboardContent({
  locationId,
  locationName,
}: DashboardContentProps) {
  const [keywords, setKeywords] = useState<SearchKeyword[]>([]);

  // PerformanceSectionからキーワードデータを受け取る（重複フェッチ回避）
  const handleKeywordsLoaded = useCallback((kw: SearchKeyword[]) => {
    setKeywords(kw);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-700">{locationName}</h2>

      {/* GBPプロフィール完成度 */}
      <GbpScoreCard locationId={locationId} />

      {/* パフォーマンス */}
      <PerformanceSection
        locationId={locationId}
        onKeywordsLoaded={handleKeywordsLoaded}
      />

      {/* 評価とレビュー + 検索キーワード */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReviewSummaryCard locationId={locationId} />
        <SearchKeywordsCard keywords={keywords} />
      </div>
    </div>
  );
}
