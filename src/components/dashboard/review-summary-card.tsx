"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Star } from "lucide-react";

interface ReviewSummaryData {
  totalReviews: number;
  averageRating: number;
  replyRate: number;
  unrepliedCount: number;
  ratingDistribution: Record<string, number>;
}

interface ReviewSummaryCardProps {
  locationId: string;
}

export function ReviewSummaryCard({ locationId }: ReviewSummaryCardProps) {
  const [data, setData] = useState<ReviewSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          `/api/dashboard/review-summary?locationId=${locationId}`
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // サイレント
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [locationId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">レビューデータがありません</p>
        </CardContent>
      </Card>
    );
  }

  // 星分布の最大値（バーの比率計算用）
  const maxDistribution = Math.max(
    ...Object.values(data.ratingDistribution),
    1
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">評価とレビュー</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 平均評価 + レビュー件数 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={`w-5 h-5 ${
                  i < Math.round(data.averageRating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <span className="text-2xl font-bold">{data.averageRating}</span>
          <span className="text-sm text-muted-foreground">
            {data.totalReviews}件のレビュー
          </span>
        </div>

        {/* 星分布グラフ */}
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = data.ratingDistribution[String(star)] || 0;
            const width =
              maxDistribution > 0 ? (count / maxDistribution) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-3 text-right">{star}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="w-6 text-right text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
