"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SetupBasicInfo } from "./setup-basic-info";
import { SetupPhotos } from "./setup-photos";
import { SetupBusinessHours } from "./setup-business-hours";
import { Save, Loader2, CheckCircle2 } from "lucide-react";

interface ScoreBreakdown {
  basicInfo: { score: number; maxScore: number };
  description: { score: number; maxScore: number };
  subcategories: { score: number; maxScore: number };
  photos: { score: number; maxScore: number };
  businessHours: { score: number; maxScore: number };
}

interface SetupData {
  location: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    category: string | null;
    businessDescription: string | null;
    subcategories: string[] | null;
    businessHours: Record<string, string> | null;
    logoUrl: string | null;
    coverUrl: string | null;
    photos: string[] | null;
  };
  score: {
    totalScore: number;
    scoreBreakdown: ScoreBreakdown;
    missingItems: string[];
  };
}

interface SetupContentProps {
  locationId: string;
  locationName: string;
}

export function SetupContent({ locationId, locationName }: SetupContentProps) {
  const [data, setData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォームの編集中の値
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/setup?locationId=${locationId}`);
      if (res.ok) {
        const result: SetupData = await res.json();
        setData(result);
        setFormValues({});
      }
    } catch (err) {
      console.error("[SetupContent] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateField = useCallback((key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (Object.keys(formValues).length === 0) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, ...formValues }),
      });
      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || "保存に失敗しました");
        return;
      }
      const result: SetupData = await res.json();
      setData(result);
      setFormValues({});
      setSaveSuccess(true);
    } catch {
      setError("保存に失敗しました。再度お試しください。");
    } finally {
      setSaving(false);
    }
  }, [locationId, formValues]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">データの取得に失敗しました</p>
      </div>
    );
  }

  const { location, score } = data;
  const hasChanges = Object.keys(formValues).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700">{locationName}</h2>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? "保存中..." : saveSuccess ? "保存完了" : "保存"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* GBP完成度プログレス */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            GBPプロフィール完成度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3">
            <Progress value={score.totalScore} className="flex-1" />
            <span className="text-2xl font-bold min-w-[60px] text-right">
              {score.totalScore}/100
            </span>
          </div>
          {score.missingItems.length > 0 && (
            <p className="text-sm text-muted-foreground">
              未設定: {score.missingItems.join("、")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 基本情報セクション */}
      <SetupBasicInfo
        location={location}
        formValues={formValues}
        onUpdate={updateField}
        scoreBreakdown={score.scoreBreakdown}
      />

      {/* 写真セクション */}
      <SetupPhotos
        location={location}
        formValues={formValues}
        onUpdate={updateField}
        scoreBreakdown={score.scoreBreakdown}
      />

      {/* 営業時間セクション */}
      <SetupBusinessHours
        location={location}
        formValues={formValues}
        onUpdate={updateField}
        scoreBreakdown={score.scoreBreakdown}
      />
    </div>
  );
}
