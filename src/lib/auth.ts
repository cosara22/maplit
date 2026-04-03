import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "./prisma";
import {
  verifyPassword,
  isAccountLocked,
  calculateLockoutUntil,
  MAX_LOGIN_ATTEMPTS,
} from "./auth-helpers";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
          throw new Error("メールアドレスとパスワードを入力してください");
        }

        // ユーザーを検索（テナント横断でemailで検索）
        const user = await prisma.user.findFirst({
          where: { email },
        });

        if (!user) {
          throw new Error("メールアドレスまたはパスワードが正しくありません");
        }

        // ロックアウト判定
        if (isAccountLocked(user.lockedUntil)) {
          throw new Error(
            "アカウントがロックされています。15分後に再度お試しください",
          );
        }

        // パスワード未設定（OAuth専用ユーザー）
        if (!user.encryptedPassword) {
          throw new Error("メールアドレスまたはパスワードが正しくありません");
        }

        // パスワード検証
        const isValid = await verifyPassword(password, user.encryptedPassword);

        if (!isValid) {
          // ログイン失敗カウントを増加
          const attempts = user.failedLoginAttempts + 1;
          const updateData: {
            failedLoginAttempts: number;
            lockedUntil?: Date;
          } = { failedLoginAttempts: attempts };

          // 最大試行回数に達したらロックアウト
          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            updateData.lockedUntil = calculateLockoutUntil();
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });

          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            throw new Error(
              "ログイン試行回数の上限に達しました。15分後に再度お試しください",
            );
          }

          throw new Error("メールアドレスまたはパスワードが正しくありません");
        }

        // ログイン成功: 失敗カウントをリセット、最終ログイン日時を更新
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastSignInAt: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      // Google OAuthログインの場合: 既存ユーザーとの紐付け
      if (account?.provider === "google") {
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
          },
          include: { user: true },
        });

        if (existingAccount) {
          // 既存アカウント: ユーザー情報を返す
          user.tenantId = existingAccount.user.tenantId;
          user.role = existingAccount.user.role;
          return true;
        }

        // 新規OAuthログイン: emailで既存ユーザーを検索
        const existingUser = await prisma.user.findFirst({
          where: { email: user.email! },
        });

        if (existingUser) {
          // アカウントを紐付け
          await prisma.account.create({
            data: {
              userId: existingUser.id,
              provider: "google",
              providerAccountId: account.providerAccountId,
              accessToken: account.access_token ?? null,
              refreshToken: account.refresh_token ?? null,
              expiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            },
          });
          user.tenantId = existingUser.tenantId;
          user.role = existingUser.role;

          // 最終ログイン日時を更新
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { lastSignInAt: new Date() },
          });

          return true;
        }

        // emailに一致するユーザーが存在しない場合はログイン拒否
        // （管理者が事前にユーザーを作成している前提）
        return false;
      }

      return true;
    },
  },
});
