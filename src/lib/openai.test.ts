import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildReplyPrompt,
  removeNgWords,
  generateReviewReply,
  resetClient,
  type GenerateReplyInput,
} from "./openai";

// OpenAI SDKモック
const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

const baseInput: GenerateReplyInput = {
  locationName: "シング薬局",
  category: "調剤薬局",
  replyKeywords: ["処方箋", "健康相談"],
  replyTone: "polite",
  replyStyleInstructions: "丁寧にお礼を述べてください",
  ngWords: ["最悪", "クレーム"],
  rating: 5,
  comment: "とても親切な対応でした。",
};

describe("buildReplyPrompt", () => {
  it("店舗情報・キーワード・トーンを含むプロンプトを生成する", () => {
    const prompt = buildReplyPrompt(baseInput);
    expect(prompt).toContain("シング薬局");
    expect(prompt).toContain("調剤薬局");
    expect(prompt).toContain("処方箋、健康相談");
    expect(prompt).toContain("polite");
    expect(prompt).toContain("丁寧にお礼を述べてください");
    expect(prompt).toContain("とても親切な対応でした。");
    expect(prompt).toContain("5★");
    expect(prompt).toContain("最悪、クレーム");
  });

  it("低評価（1-2★）の場合は謝罪指示を含む", () => {
    const prompt = buildReplyPrompt({ ...baseInput, rating: 1 });
    expect(prompt).toContain("謝罪から始め");
  });

  it("高評価（3-5★）の場合は謝罪指示を含まない", () => {
    const prompt = buildReplyPrompt({ ...baseInput, rating: 3 });
    expect(prompt).not.toContain("謝罪から始め");
  });

  it("キーワードが空の場合「なし」と表示する", () => {
    const prompt = buildReplyPrompt({ ...baseInput, replyKeywords: [] });
    expect(prompt).toContain("特徴: なし");
  });

  it("カテゴリがnullの場合「未設定」と表示する", () => {
    const prompt = buildReplyPrompt({ ...baseInput, category: null });
    expect(prompt).toContain("カテゴリ: 未設定");
  });

  it("NGワードが空の場合、NGワード行を含まない", () => {
    const prompt = buildReplyPrompt({ ...baseInput, ngWords: [] });
    expect(prompt).not.toContain("NGワード");
  });
});

describe("removeNgWords", () => {
  it("NGワードを除去する", () => {
    const result = removeNgWords("これは最悪な体験でした", ["最悪"]);
    expect(result).toBe("これはな体験でした");
  });

  it("複数のNGワードを除去する", () => {
    const result = removeNgWords("最悪のクレーム対応", ["最悪", "クレーム"]);
    expect(result).toBe("の対応");
  });

  it("NGワードがない場合そのまま返す", () => {
    const result = removeNgWords("良い体験でした", ["最悪"]);
    expect(result).toBe("良い体験でした");
  });

  it("空のNGワード配列の場合そのまま返す", () => {
    const result = removeNgWords("テスト文", []);
    expect(result).toBe("テスト文");
  });
});

describe("generateReviewReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetClient();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("正常にAI返信を生成する", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "口コミありがとうございます。" } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    const result = await generateReviewReply(baseInput);

    expect(result.generatedReply).toBe("口コミありがとうございます。");
    expect(result.tokensUsed).toEqual({ input: 100, output: 50 });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        temperature: 0.7,
      })
    );
  });

  it("生成結果にNGワードが含まれていたら除去する", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        { message: { content: "最悪のご体験をされたとのこと。" } },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    const result = await generateReviewReply(baseInput);
    expect(result.generatedReply).not.toContain("最悪");
  });

  it("APIレスポンスにusageがない場合は0を返す", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "ありがとうございます。" } }],
      usage: null,
    });

    const result = await generateReviewReply(baseInput);
    expect(result.tokensUsed).toEqual({ input: 0, output: 0 });
  });
});
