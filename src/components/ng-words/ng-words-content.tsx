"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Info, Loader2 } from "lucide-react";

interface NgWord {
  id: string;
  word: string;
  createdAt: string;
}

export function NgWordsContent() {
  const [ngWords, setNgWords] = useState<NgWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWords = useCallback(async () => {
    try {
      const res = await fetch("/api/ng-words");
      if (res.ok) {
        const data = await res.json();
        setNgWords(data.ngWords);
      }
    } catch (err) {
      console.error("[NgWordsContent] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  const handleAdd = useCallback(async () => {
    if (!newWord.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/ng-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: newWord.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "追加に失敗しました");
        return;
      }
      const data = await res.json();
      setNgWords((prev) => [data.ngWord, ...prev]);
      setNewWord("");
    } catch {
      setError("追加に失敗しました");
    } finally {
      setAdding(false);
    }
  }, [newWord]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ng-words/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNgWords((prev) => prev.filter((w) => w.id !== id));
      }
    } catch (err) {
      console.error("[NgWordsContent] delete error:", err);
    }
  }, []);

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50 text-blue-800">
        <Info className="h-4 w-4" />
        <div className="ml-2 text-sm">
          NGワードに登録した単語は、AI返信生成やAI口コミ文生成で使用が避けられます。
          競合店名や不適切な表現を登録してください。
        </div>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            NGワード管理
            <Badge variant="secondary" className="text-xs">
              {ngWords.length}/100
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 追加フォーム */}
          <div className="flex gap-2">
            <Input
              value={newWord}
              onChange={(e) => {
                setNewWord(e.target.value);
                setError(null);
              }}
              placeholder="NGワードを入力..."
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
              disabled={!newWord.trim() || adding}
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

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* リスト */}
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              読み込み中...
            </p>
          ) : ngWords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              NGワードが登録されていません
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ngWords.map((word) => (
                <span
                  key={word.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm"
                >
                  {word.word}
                  <button
                    type="button"
                    onClick={() => handleDelete(word.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
