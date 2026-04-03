import OpenAI from "openai";

// AIOスコア算出結果
export interface AioScoreResult {
  score: number;
  reason: string;
}

// OpenAIクライアント（遅延初期化）
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env["OPENAI_API_KEY"],
    });
  }
  return openaiClient;
}

// テスト用: OpenAIクライアントを差し替える
export function setOpenAIClientForTest(client: OpenAI | null) {
  openaiClient = client;
}

// AIOスコア算出プロンプト
const AIO_SCORE_PROMPT = `以下のGoogle口コミのAI検索最適化スコアを1〜5で評価してください。

## 評価基準
- 具体性: 店舗名、サービス名、商品名が含まれているか
- キーワード: 検索されやすいキーワードが自然に含まれているか
- 文章量: 十分な情報量があるか（50文字以上で高評価）
- 信頼性: 具体的な体験に基づいているか

## 口コミ
{comment}

JSON形式で回答: {"score": N, "reason": "..."}`;

// スコアを1〜5にクランプ
function clampScore(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)));
}

// OpenAIレスポンスからスコアをパース
export function parseAioScoreResponse(content: string): AioScoreResult {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.score !== "number") {
      return { score: 3, reason: "算出不可" };
    }
    return {
      score: clampScore(parsed.score),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch {
    return { score: 3, reason: "算出不可" };
  }
}

// プロンプトを生成
export function buildAioScorePrompt(comment: string): string {
  return AIO_SCORE_PROMPT.replace("{comment}", comment);
}

/**
 * 口コミテキストからAIOスコアを算出する。
 * 空の口コミの場合はスコア1を返す。
 */
export async function calculateAioScore(
  comment: string | null | undefined
): Promise<AioScoreResult> {
  // 空の口コミはスコア1
  if (!comment || comment.trim() === "") {
    return { score: 1, reason: "口コミテキストなし" };
  }

  const client = getOpenAIClient();
  const prompt = buildAioScorePrompt(comment);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "";
  return parseAioScoreResponse(content);
}
