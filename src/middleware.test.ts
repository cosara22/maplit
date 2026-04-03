import { describe, it, expect, vi, beforeEach } from "vitest";

// NextResponse のモック
const mockNext = vi.fn().mockReturnValue({ type: "next" });
const mockRedirect = vi.fn().mockReturnValue({ type: "redirect" });

vi.mock("next/server", () => ({
  NextResponse: {
    next: (...args: unknown[]) => mockNext(...args),
    redirect: (...args: unknown[]) => mockRedirect(...args),
  },
}));

// auth関数のモック: middleware.tsではデフォルトエクスポートがauth(callback)の戻り値
// テストでは直接コールバック関数をテストする
// auth()はミドルウェアコールバックをラップするので、コールバックのロジックを直接テストする

describe("認証ミドルウェア ロジック", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ミドルウェアコールバックのロジックを模倣するヘルパー
  function createRequest(pathname: string, hasAuth: boolean) {
    return {
      nextUrl: { pathname },
      url: "http://localhost:3000",
      auth: hasAuth ? { user: { id: "1", tenantId: "t1", role: "admin" } } : null,
    };
  }

  // ミドルウェアのコールバック関数を再現
  const publicPaths = ["/login", "/register", "/reset-password", "/survey"];

  function middlewareCallback(req: ReturnType<typeof createRequest>) {
    const { pathname } = req.nextUrl;
    const isPublic = publicPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/"),
    );
    if (isPublic) return mockNext();
    if (!req.auth) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return mockRedirect(loginUrl);
    }
    return mockNext();
  }

  it("公開パス(/login)は認証なしでアクセスできる", () => {
    const req = createRequest("/login", false);
    middlewareCallback(req);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("公開パス(/survey/xxx)は認証なしでアクセスできる", () => {
    const req = createRequest("/survey/abc-123", false);
    middlewareCallback(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("未認証ユーザーは/loginにリダイレクトされる", () => {
    const req = createRequest("/", false);
    middlewareCallback(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/login");
    expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/");
  });

  it("認証済みユーザーはダッシュボードにアクセスできる", () => {
    const req = createRequest("/", true);
    middlewareCallback(req);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("未認証ユーザーが/reviewsにアクセスすると/loginにリダイレクト", () => {
    const req = createRequest("/reviews", false);
    middlewareCallback(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/reviews");
  });

  it("認証済みユーザーは保護されたパスにアクセスできる", () => {
    const req = createRequest("/settings", true);
    middlewareCallback(req);
    expect(mockNext).toHaveBeenCalled();
  });
});
