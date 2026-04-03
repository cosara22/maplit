import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";

// Edge Runtime互換のAuth.js基本設定
// ミドルウェアから使用される（Prismaを含まない）
export const authConfig = {
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.user.id = token.sub!;
      session.user.tenantId = token.tenantId;
      session.user.role = token.role;
      return session;
    },
  },
  providers: [] as never[],
};
