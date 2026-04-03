import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewCard } from "./review-card";
import type { ReviewData } from "./reviews-content";

// navigator.clipboard モック
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

// fetch モック
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockOnReviewUpdated = vi.fn();

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

function renderCard(review: ReviewData = baseReview) {
  return render(
    <ReviewCard review={review} onReviewUpdated={mockOnReviewUpdated} />
  );
}

describe("ReviewCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("投稿者名と星評価を表示する", () => {
    renderCard();
    expect(screen.getByText("テスト太郎")).toBeInTheDocument();
    expect(screen.getByText("とても良い薬局です")).toBeInTheDocument();
  });

  it("AIOスコアバッジを表示する", () => {
    renderCard();
    expect(screen.getByText("AIOスコア 3")).toBeInTheDocument();
  });

  it("返信推奨バッジを表示する", () => {
    renderCard();
    expect(screen.getByText("返信推奨")).toBeInTheDocument();
  });

  it("未返信の場合「AI返信コピー」「返信する」ボタンが有効", () => {
    renderCard();
    const aiButton = screen.getByText("AI返信コピー").closest("button");
    const replyButton = screen.getByText("返信する").closest("button");
    expect(aiButton).toBeInTheDocument();
    expect(replyButton).toBeInTheDocument();
    expect(aiButton).not.toBeDisabled();
    expect(replyButton).not.toBeDisabled();
  });

  it("返信済みの場合返信内容を表示し、ボタンは非表示", () => {
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
    renderCard(reviewWithReply);

    expect(
      screen.getByText("ご来局ありがとうございます")
    ).toBeInTheDocument();
    expect(screen.getAllByText("返信済み")).toHaveLength(2);
    expect(screen.queryByText("AI返信コピー")).not.toBeInTheDocument();
  });

  it("投稿者名がnullの場合「匿名」と表示する", () => {
    renderCard({ ...baseReview, reviewerName: null });
    expect(screen.getByText("匿名")).toBeInTheDocument();
  });

  it("模範口コミバッジを表示する", () => {
    renderCard({ ...baseReview, isModelReview: true });
    expect(screen.getByText("模範口コミ")).toBeInTheDocument();
  });

  it("翻訳コメントを表示する", () => {
    renderCard({
      ...baseReview,
      translatedComment: "Very good pharmacy",
    });
    expect(screen.getByText("Very good pharmacy")).toBeInTheDocument();
  });

  it("「AI返信コピー」クリックでAI返信を生成しクリップボードにコピーする", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        generatedReply: "ありがとうございます。",
        tokensUsed: { input: 100, output: 50 },
      }),
    });

    renderCard();
    fireEvent.click(screen.getByText("AI返信コピー"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/reviews/r-001/ai-reply",
        { method: "POST" }
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("ありがとうございます。")
      ).toBeInTheDocument();
    });

    expect(mockWriteText).toHaveBeenCalledWith("ありがとうございます。");
  });

  it("「返信する」クリックで返信フォームが表示される", () => {
    renderCard();
    fireEvent.click(screen.getByText("返信する"));

    expect(
      screen.getByPlaceholderText("返信文を入力してください")
    ).toBeInTheDocument();
    expect(screen.getByText("キャンセル")).toBeInTheDocument();
    expect(screen.getByText("投稿")).toBeInTheDocument();
  });

  it("模範口コミトグルボタンが動作する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "r-001", isModelReview: true }),
    });

    renderCard();
    const toggleButton = screen.getByTitle("模範口コミに設定");
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/reviews/r-001/model",
        { method: "PUT" }
      );
    });

    await waitFor(() => {
      expect(screen.getByText("模範口コミ")).toBeInTheDocument();
    });
  });

  it("AI返信生成エラー時にエラーメッセージを表示する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "AI返信の生成に失敗しました" }),
    });

    renderCard();
    fireEvent.click(screen.getByText("AI返信コピー"));

    await waitFor(() => {
      expect(
        screen.getByText("AI返信の生成に失敗しました")
      ).toBeInTheDocument();
    });
  });
});
