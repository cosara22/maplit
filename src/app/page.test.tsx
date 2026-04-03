import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("MapLitのタイトルが表示される", () => {
    render(<Home />);
    expect(screen.getByText("MapLit")).toBeInTheDocument();
  });

  it("サブタイトルが表示される", () => {
    render(<Home />);
    expect(
      screen.getByText("ローカルビジネス向け AI検索最適化SaaS")
    ).toBeInTheDocument();
  });
});
