"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Search,
} from "lucide-react";
import { RankHistoryChart } from "./rank-history-chart";

interface KeywordWithRank {
  id: string;
  keyword: string;
  createdAt: string;
  latestRank: number | null;
  latestMeasuredAt: string | null;
  previousRank: number | null;
}

interface RankAnalyticsContentProps {
  locationId: string;
  locationName: string;
}

export function RankAnalyticsContent({
  locationId,
  locationName,
}: RankAnalyticsContentProps) {
  const [keywords, setKeywords] = useState<KeywordWithRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [adding, setAdding] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [measureResult, setMeasureResult] = useState<string | null>(null);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");

  const fetchKeywords = useCallback(async () => {
    try {
      const params = new URLSearchParams({ locationId });
      const res = await fetch(`/api/rankings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords);
        // 最初のキーワードを自動選択
        if (data.keywords.length > 0 && !selectedKeywordId) {
          setSelectedKeywordId(data.keywords[0].id);
        }
      }
    } catch (err) {
      console.error("[RankAnalytics] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [locationId, selectedKeywordId]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  const handleAdd = useCallback(async () => {
    if (!newKeyword.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/rankings/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword.trim(), locationId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "追加に失敗しました");
        return;
      }
      const data = await res.json();
      const newKw: KeywordWithRank = {
        ...data.keyword,
        latestRank: null,
        latestMeasuredAt: null,
        previousRank: null,
      };
      setKeywords((prev) => [newKw, ...prev]);
      setNewKeyword("");
      if (!selectedKeywordId) {
        setSelectedKeywordId(newKw.id);
      }
    } catch {
      setError("追加に失敗しました");
    } finally {
      setAdding(false);
    }
  }, [newKeyword, locationId, selectedKeywordId]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/rankings/keywords/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setKeywords((prev) => prev.filter((k) => k.id !== id));
          if (selectedKeywordId === id) {
            setSelectedKeywordId(null);
          }
        }
      } catch (err) {
        console.error("[RankAnalytics] delete error:", err);
      }
    },
    [selectedKeywordId]
  );

  const handleMeasure = useCallback(async () => {
    setMeasuring(true);
    setMeasureResult(null);
    try {
      const res = await fetch("/api/rankings/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMeasureResult(`エラー: ${data.error}`);
        return;
      }
      setMeasureResult(
        `${data.measured}件計測完了${data.errors > 0 ? `（${data.errors}件エラー）` : ""}`
      );
      // 計測後にキーワード一覧を再取得
      await fetchKeywords();
    } catch {
      setMeasureResult("計測に失敗しました");
    } finally {
      setMeasuring(false);
    }
  }, [locationId, fetchKeywords]);

  // 順位変動の表示
  function renderRankChange(current: number | null, previous: number | null) {
    if (current === null) {
      return <Badge variant="secondary">未計測</Badge>;
    }
    if (previous === null) {
      return (
        <span className="text-2xl font-bold">
          {current}
          <span className="text-sm font-normal text-muted-foreground">位</span>
        </span>
      );
    }
    const diff = previous - current; // 正=順位上昇（良い）
    return (
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">
          {current}
          <span className="text-sm font-normal text-muted-foreground">位</span>
        </span>
        {diff > 0 && (
          <span className="flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-0.5" />+{diff}
          </span>
        )}
        {diff < 0 && (
          <span className="flex items-center text-sm text-red-600">
            <TrendingDown className="w-4 h-4 mr-0.5" />{diff}
          </span>
        )}
        {diff === 0 && (
          <span className="flex items-center text-sm text-muted-foreground">
            <Minus className="w-4 h-4 mr-0.5" />0
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">キーワード分析</h2>
          <p className="text-sm text-muted-foreground">{locationName}</p>
        </div>
        <Button
          onClick={handleMeasure}
          disabled={measuring || keywords.length === 0}
          variant="outline"
          size="sm"
        >
          {measuring ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1" />
          )}
          {measuring ? "計測中..." : "手動計測"}
        </Button>
      </div>

      {measureResult && (
        <p
          className={`text-sm ${measureResult.startsWith("エラー") ? "text-red-600" : "text-green-600"}`}
        >
          {measureResult}
        </p>
      )}

      {/* キーワード登録 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              計測キーワード
            </span>
            <Badge variant="secondary" className="text-xs">
              {keywords.length}/20
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 追加フォーム */}
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => {
                setNewKeyword(e.target.value);
                setError(null);
              }}
              placeholder="キーワードを入力（例: 薬局）..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              disabled={adding}
              className="flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={!newKeyword.trim() || adding}
              size="sm"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1" />
              )}
              追加
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* キーワード一覧 */}
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              読み込み中...
            </p>
          ) : keywords.length === 0 ? (
            <div className="text-center py-8">
              <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                キーワードが登録されていません
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                上のフォームからキーワードを追加して、順位計測を開始しましょう
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {keywords.map((kw) => (
                <div
                  key={kw.id}
                  className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedKeywordId === kw.id
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedKeywordId(kw.id)}
                >
                  <div>
                    <p className="font-medium">{kw.keyword}</p>
                    {kw.latestMeasuredAt && (
                      <p className="text-xs text-muted-foreground">
                        最終計測:{" "}
                        {new Date(kw.latestMeasuredAt).toLocaleDateString("ja-JP")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {renderRankChange(kw.latestRank, kw.previousRank)}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(kw.id);
                      }}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 順位推移グラフ */}
      {selectedKeywordId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-semibold">順位推移</CardTitle>
            <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">過去7日間</SelectItem>
                <SelectItem value="30d">過去30日間</SelectItem>
                <SelectItem value="90d">過去90日間</SelectItem>
                <SelectItem value="1y">過去1年間</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <RankHistoryChart
              locationId={locationId}
              keywordId={selectedKeywordId}
              period={period}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
