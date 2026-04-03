import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

// Edge Runtime互換: Prismaを含まないベース設定を使用
const { auth } = NextAuth(authConfig);

// 認証不要なパス
const publicPaths = ["/login", "/register", "/reset-password", "/survey"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // 認証不要パスはスキップ
  const isPublic = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );
  if (isPublic) return NextResponse.next();

  // 未認証の場合は /login にリダイレクト
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // APIルート・静的ファイル・画像を除外
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
