import OpenAI from "openai";

// OpenAIクライアント（シングルトン）
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY が設定されていません");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/** テスト用: クライアントをリセット */
export function resetClient() {
  client = null;
}

/** AI返信生成の入力パラメータ */
export interface GenerateReplyInput {
  locationName: string;
  category: string | null;
  replyKeywords: string[];
  replyTone: string;
  replyStyleInstructions: string;
  ngWords: string[];
  rating: number;
  comment: string;
}

/** AI返信生成の結果 */
export interface GenerateReplyResult {
  generatedReply: string;
  tokensUsed: { input: number; output: number };
}

/**
 * 口コミ返信プロンプトを構築する
 */
export function buildReplyPrompt(input: GenerateReplyInput): string {
  const lines: string[] = [
    "あなたは店舗のカスタマーサポート担当です。",
    "以下の条件でGoogle口コミへの返信文を生成してください。",
    "",
    "## 店舗情報",
    `- 店舗名: ${input.locationName}`,
    `- カテゴリ: ${input.category ?? "未設定"}`,
    `- 特徴: ${input.replyKeywords.length > 0 ? input.replyKeywords.join("、") : "なし"}`,
    "",
    "## 返信ルール",
    `- トーン: ${input.replyTone}`,
    `- スタイル: ${input.replyStyleInstructions || "特になし"}`,
    "- Googleのポリシーに準拠すること",
  ];

  if (input.ngWords.length > 0) {
    lines.push(
      `- 以下のNGワードは使用しないこと: ${input.ngWords.join("、")}`
    );
  }

  lines.push("- 150文字〜300文字程度");

  // 低評価（1-2★）の場合は謝罪トーンを追加
  if (input.rating <= 2) {
    lines.push(
      "- 低評価のため、まず謝罪から始め、改善への意欲を示してください"
    );
  }

  lines.push("");
  lines.push("## 口コミ内容");
  lines.push(`- 評価: ${input.rating}★`);
  lines.push(`- 本文: ${input.comment}`);
  lines.push("");
  lines.push("返信文のみを出力してください。");

  return lines.join("\n");
}

/**
 * NGワードが返信文に含まれているかチェックし、該当箇所を除去する
 */
export function removeNgWords(text: string, ngWords: string[]): string {
  if (ngWords.length === 0) return text;
  let result = text;
  for (const word of ngWords) {
    if (word && result.includes(word)) {
      result = result.replaceAll(word, "");
    }
  }
  return result;
}

/**
 * OpenAI API を使って口コミ返信文を生成する
 */
export async function generateReviewReply(
  input: GenerateReplyInput
): Promise<GenerateReplyResult> {
  const openai = getClient();
  const prompt = buildReplyPrompt(input);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });

  const rawReply = response.choices[0]?.message?.content?.trim() ?? "";

  // NGワードの二重チェック
  const generatedReply = removeNgWords(rawReply, input.ngWords);

  return {
    generatedReply,
    tokensUsed: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}
