import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseAioScoreResponse,
  buildAioScorePrompt,
  calculateAioScore,
  setOpenAIClientForTest,
} from "./aio-score";

// OpenAIクライアントのモック
function createMockClient(content: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("AIOスコア算出", () => {
  beforeEach(() => {
    setOpenAIClientForTest(null);
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
    const prompt = buildAioScorePrompt(comment);
    expect(prompt).toContain(comment);
    expect(prompt).toContain("AI検索最適化スコアを1〜5で評価");
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
    const mockClient = createMockClient(
      '{"score": 4, "reason": "具体的な体験が書かれている"}'
    );
    setOpenAIClientForTest(mockClient);

    const result = await calculateAioScore(
      "しん薬局の薬剤師さんがとても親切でした。処方箋の説明も丁寧で安心できました。"
    );

    expect(result.score).toBe(4);
    expect(result.reason).toBe("具体的な体験が書かれている");
    expect(mockClient.chat.completions.create).toHaveBeenCalledOnce();
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
});
