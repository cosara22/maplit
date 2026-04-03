import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseAioScoreResponse,
  buildAioScoreUserPrompt,
  calculateAioScore,
} from "./aio-score";

// モック: openai.ts のgetClient
const mockCreate = vi.fn();
vi.mock("./openai", () => ({
  getClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

function mockOpenAIResponse(content: string) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content } }],
  });
}

describe("AIOスコア算出", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UT-AIO-01: OpenAI APIのレスポンスからスコアを正しくパースする
  it("OpenAI APIのレスポンスからスコアを正しくパースする", () => {
    const result = parseAioScoreResponse(
      '{"score": 4, "reason": "具体的な店舗名とサービスが含まれている"}'
    );
    expect(result.score).toBe(4);
    expect(result.reason).toBe("具体的な店舗名とサービスが含まれている");
  });

  // UT-AIO-02: 不正なJSONレスポンスの場合デフォルトスコアを返す
  it("不正なJSONレスポンスの場合デフォルトスコア3を返す", () => {
    const result = parseAioScoreResponse("invalid json");
    expect(result.score).toBe(3);
    expect(result.reason).toBe("算出不可");
  });

  // UT-AIO-03: スコアが1未満の場合1にクランプする
  it("スコアが1未満の場合1にクランプする", () => {
    const result = parseAioScoreResponse('{"score": 0}');
    expect(result.score).toBe(1);
  });

  // UT-AIO-04: スコアが5超の場合5にクランプする
  it("スコアが5超の場合5にクランプする", () => {
    const result = parseAioScoreResponse('{"score": 7}');
    expect(result.score).toBe(5);
  });

  // UT-AIO-05: プロンプトに口コミテキストが正しく埋め込まれる
  it("プロンプトに口コミテキストが正しく埋め込まれる", () => {
    const comment = "薬剤師さんがとても親切で丁寧に説明してくれました";
    const prompt = buildAioScoreUserPrompt(comment);
    expect(prompt).toContain(comment);
    expect(prompt).toContain("```");
  });

  // UT-AIO-06: 空の口コミの場合スコア1を返す
  it("空の口コミの場合スコア1を返す", async () => {
    const result = await calculateAioScore("");
    expect(result.score).toBe(1);
    expect(result.reason).toBe("口コミテキストなし");
  });

  it("nullの口コミの場合スコア1を返す", async () => {
    const result = await calculateAioScore(null);
    expect(result.score).toBe(1);
  });

  // 統合テスト: calculateAioScoreがOpenAI APIを呼び出して結果を返す
  it("OpenAI APIを呼び出してスコアを返す", async () => {
    mockOpenAIResponse('{"score": 4, "reason": "具体的な体験が書かれている"}');

    const result = await calculateAioScore(
      "しん薬局の薬剤師さんがとても親切でした。処方箋の説明も丁寧で安心できました。"
    );

    expect(result.score).toBe(4);
    expect(result.reason).toBe("具体的な体験が書かれている");
    expect(mockCreate).toHaveBeenCalledOnce();

    // system/userメッセージが分離されていることを確認
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");
    expect(callArgs.messages[1].content).toContain("```");
  });

  // scoreフィールドが数値でない場合
  it("scoreフィールドが数値でない場合デフォルトスコアを返す", () => {
    const result = parseAioScoreResponse('{"score": "high", "reason": "test"}');
    expect(result.score).toBe(3);
    expect(result.reason).toBe("算出不可");
  });

  // reasonフィールドが文字列でない場合
  it("reasonフィールドが文字列でない場合、空文字を返す", () => {
    const result = parseAioScoreResponse('{"score": 4, "reason": 123}');
    expect(result.score).toBe(4);
    expect(result.reason).toBe("");
  });

  // OpenAI APIエラー時に例外をスローする
  it("OpenAI APIエラー時に例外をスローする", async () => {
    mockCreate.mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(
      calculateAioScore("テスト口コミ")
    ).rejects.toThrow("Rate limit exceeded");
  });

  // 長いテキストがトリミングされる
  it("2000文字を超える口コミがトリミングされる", () => {
    const longComment = "あ".repeat(3000);
    const prompt = buildAioScoreUserPrompt(longComment);
    // 2000文字 + "## 口コミ\n```\n" + "\n```" のオーバーヘッド
    expect(prompt).not.toContain("あ".repeat(3000));
    expect(prompt).toContain("あ".repeat(2000));
  });
});
