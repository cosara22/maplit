import { getClient } from "./openai";

// AIOスコア算出結果
export interface AioScoreResult {
  score: number;
  reason: string;
}

// AIOスコア算出のsystemプロンプト（評価基準・出力形式）
const AIO_SCORE_SYSTEM_PROMPT = `あなたはGoogle口コミのAI検索最適化（AIO）スコアを評価する専門家です。
口コミテキストを受け取り、以下の基準で1〜5のスコアを付けてください。

## 評価基準
- 具体性: 店舗名、サービス名、商品名が含まれているか
- キーワード: 検索されやすいキーワードが自然に含まれているか
- 文章量: 十分な情報量があるか（50文字以上で高評価）
- 信頼性: 具体的な体験に基づいているか

JSON形式で回答: {"score": N, "reason": "..."}`;

// 入力テキストの最大文字数（トークン制限対策）
const MAX_COMMENT_LENGTH = 2000;

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

// userメッセージ用プロンプトを生成（口コミテキストをコードブロックで隔離）
export function buildAioScoreUserPrompt(comment: string): string {
  const trimmed = comment.slice(0, MAX_COMMENT_LENGTH);
  return `## 口コミ\n\`\`\`\n${trimmed}\n\`\`\``;
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

  const client = getClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: AIO_SCORE_SYSTEM_PROMPT },
      { role: "user", content: buildAioScoreUserPrompt(comment) },
    ],
    temperature: 0.3,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "";
  return parseAioScoreResponse(content);
}
