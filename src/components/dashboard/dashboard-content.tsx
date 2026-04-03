"use client";

import { useEffect, useState, useCallback } from "react";
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

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/dashboard/performance?locationId=${locationId}&period=30d`
      );
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.searchKeywords || []);
      }
    } catch {
      // サイレント
    }
  }, [locationId]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-700">{locationName}</h2>

      {/* GBPプロフィール完成度 */}
      <GbpScoreCard locationId={locationId} />

      {/* パフォーマンス */}
      <PerformanceSection locationId={locationId} />

      {/* 評価とレビュー + 検索キーワード */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReviewSummaryCard locationId={locationId} />
        <SearchKeywordsCard keywords={keywords} />
      </div>
    </div>
  );
}
