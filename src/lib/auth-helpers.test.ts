import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  isAccountLocked,
  calculateLockoutUntil,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from "./auth-helpers";

describe("auth-helpers", () => {
  describe("hashPassword / verifyPassword", () => {
    it("パスワードをハッシュ化し、正しいパスワードで検証できる", async () => {
      const password = "SecurePass123!";
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it("間違ったパスワードでは検証に失敗する", async () => {
      const hash = await hashPassword("CorrectPassword");

      expect(await verifyPassword("WrongPassword", hash)).toBe(false);
    });

    it("bcryptハッシュ形式で出力される", async () => {
      const hash = await hashPassword("test");

      // bcryptハッシュは $2a$ または $2b$ で始まる
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it("コスト12でハッシュ化される", async () => {
      const hash = await hashPassword("test");

      // bcryptハッシュの3番目のセクションがコスト値
      expect(hash).toMatch(/^\$2[ab]\$12\$/);
    });
  });

  describe("isAccountLocked", () => {
    it("lockedUntilがnullの場合はロックされていない", () => {
      expect(isAccountLocked(null)).toBe(false);
    });

    it("lockedUntilが過去の場合はロックされていない", () => {
      const pastDate = new Date(Date.now() - 1000);
      expect(isAccountLocked(pastDate)).toBe(false);
    });

    it("lockedUntilが未来の場合はロックされている", () => {
      const futureDate = new Date(Date.now() + 60000);
      expect(isAccountLocked(futureDate)).toBe(true);
    });
  });

  describe("calculateLockoutUntil", () => {
    it("現在時刻から15分後の時刻を返す", () => {
      const before = Date.now();
      const lockoutUntil = calculateLockoutUntil();
      const after = Date.now();

      expect(lockoutUntil.getTime()).toBeGreaterThanOrEqual(
        before + LOCKOUT_DURATION_MS,
      );
      expect(lockoutUntil.getTime()).toBeLessThanOrEqual(
        after + LOCKOUT_DURATION_MS,
      );
    });
  });

  describe("定数", () => {
    it("最大ログイン試行回数は5回", () => {
      expect(MAX_LOGIN_ATTEMPTS).toBe(5);
    });

    it("ロックアウト時間は15分", () => {
      expect(LOCKOUT_DURATION_MS).toBe(15 * 60 * 1000);
    });
  });
});
