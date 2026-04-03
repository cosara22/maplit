import bcrypt from "bcryptjs";

// パスワードハッシュのコスト（設計書: bcrypt コスト12）
const BCRYPT_COST = 12;

// ブルートフォース防止: 5回連続失敗で15分ロック
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15分

/**
 * パスワードをbcryptでハッシュ化する
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * パスワードを検証する
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * アカウントがロックアウト中かどうかを判定する
 */
export function isAccountLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false;
  return new Date() < lockedUntil;
}

/**
 * ロックアウト解除時刻を計算する
 */
export function calculateLockoutUntil(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MS);
}
