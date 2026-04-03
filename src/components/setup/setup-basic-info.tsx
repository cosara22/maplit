"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ScoreBreakdown {
  basicInfo: { score: number; maxScore: number };
  description: { score: number; maxScore: number };
  subcategories: { score: number; maxScore: number };
}

interface SetupBasicInfoProps {
  location: {
    address: string | null;
    phone: string | null;
    website: string | null;
    category: string | null;
    businessDescription: string | null;
    subcategories: string[] | null;
  };
  formValues: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  scoreBreakdown: ScoreBreakdown;
}

function ScoreBadge({ score, maxScore }: { score: number; maxScore: number }) {
  const isComplete = score === maxScore;
  return (
    <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
      {score}/{maxScore}
    </Badge>
  );
}

export function SetupBasicInfo({
  location,
  formValues,
  onUpdate,
  scoreBreakdown,
}: SetupBasicInfoProps) {
  const getValue = (key: string, fallback: string | null) =>
    (formValues[key] as string | undefined) ?? fallback ?? "";

  const subcats = (formValues.subcategories as string[] | undefined) ??
    location.subcategories ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">基本情報</CardTitle>
        <ScoreBadge
          score={scoreBreakdown.basicInfo.score}
          maxScore={scoreBreakdown.basicInfo.maxScore}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">電話番号</Label>
          <Input
            id="phone"
            value={getValue("phone", location.phone)}
            onChange={(e) => onUpdate("phone", e.target.value)}
            placeholder="03-1234-5678"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Webサイト</Label>
          <Input
            id="website"
            value={getValue("website", location.website)}
            onChange={(e) => onUpdate("website", e.target.value)}
            placeholder="https://example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">住所</Label>
          <Input
            id="address"
            value={getValue("address", location.address)}
            onChange={(e) => onUpdate("address", e.target.value)}
            placeholder="東京都..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">カテゴリ</Label>
          <Input
            id="category"
            value={getValue("category", location.category)}
            onChange={(e) => onUpdate("category", e.target.value)}
            placeholder="薬局"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="businessDescription">
              ビジネスの説明
            </Label>
            <div className="flex items-center gap-2">
              <ScoreBadge
                score={scoreBreakdown.description.score}
                maxScore={scoreBreakdown.description.maxScore}
              />
              <span className="text-xs text-muted-foreground">
                {getValue("businessDescription", location.businessDescription).length}/200文字
              </span>
            </div>
          </div>
          <textarea
            id="businessDescription"
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={getValue("businessDescription", location.businessDescription)}
            onChange={(e) => onUpdate("businessDescription", e.target.value)}
            placeholder="お店の特徴やサービスを200文字以上で記載してください"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="subcategories">サブカテゴリ</Label>
            <ScoreBadge
              score={scoreBreakdown.subcategories.score}
              maxScore={scoreBreakdown.subcategories.maxScore}
            />
          </div>
          <Input
            id="subcategories"
            value={subcats.join(", ")}
            onChange={(e) => {
              const val = e.target.value;
              const arr = val
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onUpdate("subcategories", arr);
            }}
            placeholder="調剤薬局, ドラッグストア（カンマ区切り）"
          />
          <p className="text-xs text-muted-foreground">
            カンマ区切りで複数入力できます
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
