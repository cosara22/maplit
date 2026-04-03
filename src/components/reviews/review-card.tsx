"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, User } from "lucide-react";
import type { ReviewData } from "./reviews-content";

interface ReviewCardProps {
  review: ReviewData;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ReviewCard({ review }: ReviewCardProps) {
  const hasReply = review.reply !== null;

  return (
    <Card className="p-5">
      {/* ヘッダー: アバター + 投稿者名 + 星評価 + 投稿日 */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {review.reviewerPhotoUrl ? (
            <img
              src={review.reviewerPhotoUrl}
              alt={review.reviewerName ?? ""}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
              <User className="h-5 w-5 text-gray-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">
              {review.reviewerName ?? "匿名"}
            </span>
            <StarRating rating={review.rating} />
            <span className="text-sm text-gray-500">
              投稿: {formatDate(review.reviewedAt)}
            </span>
          </div>

          {/* バッジ群 */}
          <div className="mt-1.5 flex flex-wrap gap-2">
            {review.aioScore !== null && (
              <Badge variant="secondary">
                AIOスコア {review.aioScore}
              </Badge>
            )}
            {review.replyRecommended && (
              <Badge variant="destructive">返信推奨</Badge>
            )}
            {review.isModelReview && (
              <Badge variant="outline">模範口コミ</Badge>
            )}
            {hasReply && (
              <Badge variant="default">返信済み</Badge>
            )}
          </div>
        </div>
      </div>

      {/* コメント本文 */}
      {review.comment && (
        <p className="mt-3 text-sm text-gray-700 leading-relaxed">
          {review.comment}
        </p>
      )}

      {/* 翻訳コメント */}
      {review.translatedComment && (
        <p className="mt-2 text-sm text-gray-500 italic">
          {review.translatedComment}
        </p>
      )}

      {/* 既存の返信 */}
      {review.reply?.replyText && (
        <div className="mt-3 rounded-md bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">返信済み</p>
          <p className="text-sm text-gray-700">{review.reply.replyText}</p>
        </div>
      )}

      {/* アクションボタン（Issue #8で機能接続予定） */}
      <div className="mt-3 flex items-center gap-2 justify-end">
        {!hasReply && (
          <>
            <Button variant="outline" size="sm" disabled title="準備中">
              AI返信コピー
            </Button>
            <Button size="sm" disabled title="準備中">
              返信する
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
