import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewCard } from "./review-card";
import type { ReviewData } from "./reviews-content";

const baseReview: ReviewData = {
  id: "r-001",
  reviewerName: "テスト太郎",
  reviewerPhotoUrl: null,
  rating: 5,
  comment: "とても良い薬局です",
  translatedComment: null,
  language: "ja",
  aioScore: 3,
  replyRecommended: true,
  isModelReview: false,
  reviewedAt: "2023-09-30T00:00:00Z",
  reply: null,
};

describe("ReviewCard", () => {
  it("投稿者名と星評価を表示する", () => {
    render(<ReviewCard review={baseReview} />);

    expect(screen.getByText("テスト太郎")).toBeInTheDocument();
    expect(screen.getByText("とても良い薬局です")).toBeInTheDocument();
  });

  it("AIOスコアバッジを表示する", () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText("AIOスコア 3")).toBeInTheDocument();
  });

  it("返信推奨バッジを表示する", () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText("返信推奨")).toBeInTheDocument();
  });

  it("未返信の場合アクションボタンを表示する（disabled）", () => {
    render(<ReviewCard review={baseReview} />);
    const aiButton = screen.getByText("AI返信コピー").closest("button");
    const replyButton = screen.getByText("返信する").closest("button");
    expect(aiButton).toBeInTheDocument();
    expect(replyButton).toBeInTheDocument();
    expect(aiButton).toBeDisabled();
    expect(replyButton).toBeDisabled();
  });

  it("返信済みの場合返信内容を表示する", () => {
    const reviewWithReply: ReviewData = {
      ...baseReview,
      reply: {
        id: "rr-001",
        replyText: "ご来局ありがとうございます",
        aiGeneratedText: null,
        status: "posted",
        repliedAt: "2023-10-01T00:00:00Z",
      },
    };
    render(<ReviewCard review={reviewWithReply} />);

    expect(screen.getByText("ご来局ありがとうございます")).toBeInTheDocument();
    // 「返信済み」はバッジとラベルの2箇所に表示される
    expect(screen.getAllByText("返信済み")).toHaveLength(2);
    // 返信済みの場合ボタンは非表示
    expect(screen.queryByText("AI返信コピー")).not.toBeInTheDocument();
  });

  it("投稿者名がnullの場合「匿名」と表示する", () => {
    render(<ReviewCard review={{ ...baseReview, reviewerName: null }} />);
    expect(screen.getByText("匿名")).toBeInTheDocument();
  });

  it("模範口コミバッジを表示する", () => {
    render(<ReviewCard review={{ ...baseReview, isModelReview: true }} />);
    expect(screen.getByText("模範口コミ")).toBeInTheDocument();
  });

  it("翻訳コメントを表示する", () => {
    render(
      <ReviewCard
        review={{ ...baseReview, translatedComment: "Very good pharmacy" }}
      />
    );
    expect(screen.getByText("Very good pharmacy")).toBeInTheDocument();
  });
});
