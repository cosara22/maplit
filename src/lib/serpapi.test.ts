import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  measureKeywordRank,
  measureMultipleKeywords,
  isSerpApiConfigured,
} from "./serpapi";

const originalEnv = process.env;

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("isSerpApiConfigured", () => {
  it("SERP_API_KEY未設定の場合falseを返す", () => {
    delete process.env.SERP_API_KEY;
    expect(isSerpApiConfigured()).toBe(false);
  });

  it("SERP_API_KEY設定済みの場合trueを返す", () => {
    process.env.SERP_API_KEY = "test-key";
    expect(isSerpApiConfigured()).toBe(true);
  });
});

describe("measureKeywordRank", () => {
  it("APIキー未設定の場合エラーを投げる", async () => {
    delete process.env.SERP_API_KEY;
    await expect(
      measureKeywordRank("薬局", 35.6762, 139.6503, "place123")
    ).rejects.toThrow("SERP_API_KEYが設定されていません");
  });

  it("place_id一致で順位を返す", async () => {
    process.env.SERP_API_KEY = "test-key";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        local_results: [
          { place_id: "other1", title: "他店A" },
          { place_id: "other2", title: "他店B" },
          { place_id: "my-place", title: "自店" },
        ],
      }),
    });
    global.fetch = mockFetch;

    const result = await measureKeywordRank("薬局", 35.6762, 139.6503, "my-place");

    expect(result.keyword).toBe("薬局");
    expect(result.rankPosition).toBe(3);
    expect(result.latitude).toBe(35.6762);
    expect(result.longitude).toBe(139.6503);
  });

  it("place_id不一致で圏外（null）を返す", async () => {
    process.env.SERP_API_KEY = "test-key";
    const results = Array.from({ length: 20 }, (_, i) => ({
      place_id: `other${i}`,
      title: `他店${i}`,
    }));
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ local_results: results }),
    });
    global.fetch = mockFetch;

    const result = await measureKeywordRank("薬局", 35.6762, 139.6503, "my-place");

    expect(result.rankPosition).toBeNull();
  });

  it("APIエラーの場合例外を投げる", async () => {
    process.env.SERP_API_KEY = "test-key";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });
    global.fetch = mockFetch;

    await expect(
      measureKeywordRank("薬局", 35.6762, 139.6503, "my-place")
    ).rejects.toThrow("SerpAPI リクエスト失敗: 429 Too Many Requests");
  });

  it("SerpAPIレスポ���スにerrorがある場合例外を投げる", async () => {
    process.env.SERP_API_KEY = "test-key";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: "Invalid API key" }),
    });
    global.fetch = mockFetch;

    await expect(
      measureKeywordRank("薬局", 35.6762, 139.6503, "my-place")
    ).rejects.toThrow("SerpAPI エラー: Invalid API key");
  });
});

describe("measureMultipleKeywords", () => {
  it("複数キーワードの計測結果を返す", async () => {
    process.env.SERP_API_KEY = "test-key";
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          local_results: [
            { place_id: "my-place", title: "自店" },
          ],
        }),
      };
    });
    global.fetch = mockFetch;

    const { results, errors } = await measureMultipleKeywords(
      ["薬局", "ドラッグストア"],
      35.6762,
      139.6503,
      "my-place"
    );

    expect(results).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(results[0].keyword).toBe("薬局");
    expect(results[0].rankPosition).toBe(1);
    expect(results[1].keyword).toBe("ドラッグストア");
    expect(callCount).toBe(2);
  });

  it("一部のキーワードでエラーが発生した場合、エラーを返しつつ続行する", async () => {
    process.env.SERP_API_KEY = "test-key";
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        };
      }
      return {
        ok: true,
        json: async () => ({
          local_results: [{ place_id: "my-place", title: "自店" }],
        }),
      };
    });
    global.fetch = mockFetch;

    const { results, errors } = await measureMultipleKeywords(
      ["薬局", "ドラッグストア"],
      35.6762,
      139.6503,
      "my-place"
    );

    expect(results).toHaveLength(1);
    expect(results[0].keyword).toBe("ドラッグストア");
    expect(errors).toHaveLength(1);
    expect(errors[0].keyword).toBe("薬局");
  });
});
