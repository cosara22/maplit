"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, X } from "lucide-react";

interface AiReplySettings {
  replyKeywords: string[];
  replyStyleInstructions: string;
  replyTone: string;
}

interface AiReplySettingsCardProps {
  locationId: string;
}

export function AiReplySettingsCard({ locationId }: AiReplySettingsCardProps) {
  const [settings, setSettings] = useState<AiReplySettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [styleInstructions, setStyleInstructions] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      const params = new URLSearchParams({ locationId });
      const res = await fetch(`/api/reviews/ai-settings?${params}`);
      if (res.ok) {
        const data: AiReplySettings = await res.json();
        setSettings(data);
        setKeywords(Array.isArray(data.replyKeywords) ? data.replyKeywords : []);
        setStyleInstructions(data.replyStyleInstructions ?? "");
      }
    }
    fetchSettings();
  }, [locationId]);

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/reviews/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          replyKeywords: keywords,
          replyStyleInstructions: styleInstructions,
        }),
      });
      if (res.ok) {
        const data: AiReplySettings = await res.json();
        setSettings(data);
        setEditing(false);
      } else {
        setSaveError("保存に失敗しました");
      }
    } catch {
      setSaveError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (settings) {
      setKeywords(Array.isArray(settings.replyKeywords) ? settings.replyKeywords : []);
      setStyleInstructions(settings.replyStyleInstructions ?? "");
    }
    setEditing(false);
  };

  const displayKeywords =
    settings && Array.isArray(settings.replyKeywords)
      ? settings.replyKeywords
      : [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">AI返信設定</h3>
        </div>
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            編集
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              返信キーワード
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="キーワードを入力"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={handleAddKeyword}>
                追加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="hover:text-blue-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              返信スタイル指示
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              rows={3}
              value={styleInstructions}
              onChange={(e) => setStyleInstructions(e.target.value)}
              placeholder="返信のトーンや内容に関する指示を入力してください"
            />
          </div>

          {saveError && (
            <p className="text-sm text-red-600">{saveError}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              キャンセル
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-700">返信キーワード:</span>{" "}
            {displayKeywords.length > 0
              ? displayKeywords.join(", ")
              : "キーワードを登録すると、AI返信に自動で含まれます"}
          </p>
          <p>
            <span className="font-medium text-gray-700">
              返信スタイル指示:
            </span>{" "}
            {settings?.replyStyleInstructions ||
              "返信のトーンや内容に関する指示を設定できます"}
          </p>
        </div>
      )}
    </Card>
  );
}
