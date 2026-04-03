"use client";

import { useState, useEffect, useCallback } from "react";
import { ReviewStatsBar } from "./review-stats-bar";
import { AiReplySettingsCard } from "./ai-reply-settings-card";
import { ReviewFilters } from "./review-filters";
import { ReviewCard } from "./review-card";
import { ReviewPagination } from "./review-pagination";

export interface ReviewData {
  id: string;
  reviewerName: string | null;
  reviewerPhotoUrl: string | null;
  rating: number;
  comment: string | null;
  translatedComment: string | null;
  language: string | null;
  aioScore: number | null;
  replyRecommended: boolean;
  isModelReview: boolean;
  reviewedAt: string | null;
  reply: {
    id: string;
    replyText: string | null;
    aiGeneratedText: string | null;
    status: string;
    repliedAt: string | null;
  } | null;
}

interface ReviewsResponse {
  reviews: ReviewData[];
  total: number;
  page: number;
  totalPages: number;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  replyRate: number;
  unrepliedCount: number;
}

interface ReviewsContentProps {
  locationId: string;
}

export function ReviewsContent({ locationId }: ReviewsContentProps) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 統計データ取得
  useEffect(() => {
    async function fetchStats() {
      try {
        const params = new URLSearchParams({ locationId });
        const res = await fetch(`/api/dashboard/review-summary?${params}`);
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // 統計取得失敗は致命的でないため無視
      }
    }
    fetchStats();
  }, [locationId]);

  // AIOスコア未算出の口コミを検出して自動算出をトリガー
  const triggerAioScoreCalculation = useCallback(
    async (reviewsList: ReviewData[]) => {
      const hasUncalculated = reviewsList.some(
        (r) => r.aioScore === null && r.comment
      );
      if (!hasUncalculated) return;

      try {
        const res = await fetch("/api/reviews/aio-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.calculated > 0) {
            // 算出完了後にリストを再取得してスコアを反映
            await refetchReviews();
          }
        }
      } catch {
        // AIOスコア算出失敗は致命的でないため無視
      }
    },
    [locationId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 口コミ一覧取得（再取得用・AIOトリガーなし）
  const refetchReviews = useCallback(async () => {
    const params = new URLSearchParams({
      locationId,
      filter,
      sort,
      page: String(page),
      limit: "20",
    });
    if (search) params.set("search", search);
    if (period) params.set("period", period);

    try {
      const res = await fetch(`/api/reviews?${params}`);
      if (res.ok) {
        const data: ReviewsResponse = await res.json();
        setReviews(data.reviews);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      // 再取得失敗は無視（元のデータは表示されたまま）
    }
  }, [locationId, filter, sort, search, period, page]);

  // 口コミ一覧取得
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      locationId,
      filter,
      sort,
      page: String(page),
      limit: "20",
    });
    if (search) params.set("search", search);
    if (period) params.set("period", period);

    try {
      const res = await fetch(`/api/reviews?${params}`);
      if (!res.ok) {
        setError("口コミの取得に失敗しました");
        return;
      }
      const data: ReviewsResponse = await res.json();
      setReviews(data.reviews);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      // AIOスコア未算出の口コミがあれば自動算出
      triggerAioScoreCalculation(data.reviews);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [locationId, filter, sort, search, period, page, triggerAioScoreCalculation]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // フィルタ変更時にページを1にリセット
  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setPage(1);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 統計バー */}
      <ReviewStatsBar stats={stats} />

      {/* AI返信設定 */}
      <AiReplySettingsCard locationId={locationId} />

      {/* フィルタ・検索・ソート */}
      <ReviewFilters
        filter={filter}
        sort={sort}
        search={search}
        period={period}
        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        onSearchChange={handleSearchChange}
        onPeriodChange={handlePeriodChange}
      />

      {/* エラー表示 */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 口コミ一覧 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-gray-500">
            {filter === "all" && !search
              ? "口コミがまだありません"
              : "条件に一致する口コミがありません"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{total}件の口コミ</p>
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onReviewUpdated={fetchReviews}
              />
            ))}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <ReviewPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
