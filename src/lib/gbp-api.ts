/**
 * GBP API 返信投稿ラッパー
 *
 * 現段階ではスタブ実装。GBP API統合時に実APIに差し替える。
 */
export interface GbpReplyResult {
  success: boolean;
  error?: string;
}

/**
 * GBP APIに口コミ返信を投稿する
 *
 * TODO: Google My Business API の accounts.locations.reviews.updateReply を呼び出す
 */
export async function postReplyToGbp(
  _gbpAccountId: string | null,
  _gbpLocationId: string | null,
  _gbpReviewId: string | null,
  _replyText: string
): Promise<GbpReplyResult> {
  // スタブ: 常に成功を返す
  return { success: true };
}
