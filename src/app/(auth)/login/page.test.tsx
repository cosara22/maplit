import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

// next-auth/react のモック
const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

// next/navigation のモック
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ログインフォームが表示される", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Googleでログイン" }),
    ).toBeInTheDocument();
  });

  it("ログイン状態を保持チェックボックスが表示される", () => {
    render(<LoginPage />);

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText("ログイン状態を保持")).toBeInTheDocument();
  });

  it("パスワードをお忘れですかリンクが表示される", () => {
    render(<LoginPage />);

    expect(
      screen.getByText("パスワードをお忘れですか？"),
    ).toBeInTheDocument();
  });

  it("メール+パスワードでログインできる", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ ok: true, error: null });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "admin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "admin@example.com",
      password: "password123",
      redirect: false,
      callbackUrl: "/",
    });
  });

  it("ログイン成功後にダッシュボードへリダイレクトされる", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ ok: true, error: null });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "admin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("ログイン失敗時にエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({
      ok: false,
      error: "メールアドレスまたはパスワードが正しくありません",
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "admin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "wrong");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText(
        "メールアドレスまたはパスワードが正しくありません",
      ),
    ).toBeInTheDocument();
  });

  it("GoogleログインボタンをクリックするとsignInが呼ばれる", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue(undefined);

    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: "Googleでログイン" }),
    );

    expect(mockSignIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });

  it("ログイン中はボタンが無効化される", async () => {
    const user = userEvent.setup();
    // signInが解決しないPromiseを返す（ローディング状態維持）
    mockSignIn.mockReturnValue(new Promise(() => {}));

    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "admin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByRole("button", { name: "ログイン中..." }),
    ).toBeDisabled();
  });
});
