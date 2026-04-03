"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, User, Loader2, Copy, Check, Flag } from "lucide-react";
import type { ReviewData } from "./reviews-content";

interface ReviewCardProps {
  review: ReviewData;
  locationId: string;
  onReviewUpdated: () => void;
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

export function ReviewCard({
  review,
  locationId: _locationId,
  onReviewUpdated,
}: ReviewCardProps) {
  const hasReply = review.reply !== null;

  // AI返信生成の状態
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // 返信フォームの状態
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editedReply, setEditedReply] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // 模範口コミの状態
  const [isModelReview, setIsModelReview] = useState(review.isModelReview);
  const [isTogglingModel, setIsTogglingModel] = useState(false);

  // エラー
  const [error, setError] = useState<string | null>(null);

  // AI返信を生成してクリップボードにコピー
  const handleAiReply = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/ai-reply`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ?? "AI返信の生成に失敗しました"
        );
      }
      const data = await res.json();
      setAiReply(data.generatedReply);
      setEditedReply(data.generatedReply);

      // クリップボードにコピー
      await navigator.clipboard.writeText(data.generatedReply);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "AI返信の生成に失敗しました"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 返信を投稿
  const handlePostReply = async () => {
    if (!editedReply.trim()) return;
    setIsPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText: editedReply.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "返信の投稿に失敗しました");
      }
      setShowReplyForm(false);
      setAiReply(null);
      setEditedReply("");
      onReviewUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "返信の投稿に失敗しました"
      );
    } finally {
      setIsPosting(false);
    }
  };

  // 模範口コミトグル
  const handleToggleModel = async () => {
    setIsTogglingModel(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/model`, {
        method: "PUT",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ?? "模範口コミの更新に失敗しました"
        );
      }
      const data = await res.json();
      setIsModelReview(data.isModelReview);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "模範口コミの更新に失敗しました"
      );
    } finally {
      setIsTogglingModel(false);
    }
  };

  // 返信するボタンのクリック
  const handleOpenReplyForm = () => {
    setShowReplyForm(true);
    if (!aiReply && !editedReply) {
      handleAiReply();
    }
  };

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
            {isModelReview && (
              <Badge variant="outline">模範口コミ</Badge>
            )}
            {hasReply && <Badge variant="default">返信済み</Badge>}
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

      {/* AI生成テキスト表示 */}
      {aiReply && !showReplyForm && (
        <div className="mt-3 rounded-md bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-600 mb-1">
            AI生成返信
          </p>
          <p className="text-sm text-gray-700">{aiReply}</p>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 返信フォーム（インライン） */}
      {showReplyForm && !hasReply && (
        <div className="mt-3 space-y-2">
          <textarea
            value={editedReply}
            onChange={(e) => setEditedReply(e.target.value)}
            placeholder={
              isGenerating
                ? "AI返信を生成中..."
                : "返信文を入力してください"
            }
            className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={4}
            disabled={isGenerating}
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowReplyForm(false);
                setError(null);
              }}
              disabled={isPosting}
            >
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={handlePostReply}
              disabled={isPosting || isGenerating || !editedReply.trim()}
            >
              {isPosting ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  投稿中...
                </>
              ) : (
                "投稿"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="mt-3 flex items-center gap-2 justify-end">
        {/* 模範口コミトグル */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleModel}
          disabled={isTogglingModel}
          title={isModelReview ? "模範口コミを解除" : "模範口コミに設定"}
        >
          <Flag
            className={`h-4 w-4 ${isModelReview ? "fill-amber-500 text-amber-500" : "text-gray-400"}`}
          />
        </Button>

        {!hasReply && !showReplyForm && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiReply}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  生成中...
                </>
              ) : copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  AI返信コピー
                </>
              )}
            </Button>
            <Button size="sm" onClick={handleOpenReplyForm}>
              返信する
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
