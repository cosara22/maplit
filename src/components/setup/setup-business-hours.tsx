"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const DAYS = [
  { key: "mon", label: "月曜日" },
  { key: "tue", label: "火曜日" },
  { key: "wed", label: "水曜日" },
  { key: "thu", label: "木曜日" },
  { key: "fri", label: "金曜日" },
  { key: "sat", label: "土曜日" },
  { key: "sun", label: "日曜日" },
] as const;

interface SetupBusinessHoursProps {
  location: {
    businessHours: Record<string, string> | null;
  };
  formValues: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  scoreBreakdown: {
    businessHours: { score: number; maxScore: number };
  };
}

export function SetupBusinessHours({
  location,
  formValues,
  onUpdate,
  scoreBreakdown,
}: SetupBusinessHoursProps) {
  const hours =
    (formValues.businessHours as Record<string, string> | undefined) ??
    location.businessHours ??
    {};

  const isComplete =
    scoreBreakdown.businessHours.score === scoreBreakdown.businessHours.maxScore;

  const updateDay = (dayKey: string, value: string) => {
    const updated = { ...hours, [dayKey]: value };
    // 空文字のキーを除去
    const cleaned = Object.fromEntries(
      Object.entries(updated).filter(([, v]) => v.trim() !== "")
    );
    onUpdate("businessHours", Object.keys(cleaned).length > 0 ? cleaned : null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">営業時間</CardTitle>
        <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
          {scoreBreakdown.businessHours.score}/{scoreBreakdown.businessHours.maxScore}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <Label className="w-16 text-sm text-right shrink-0">
                {label}
              </Label>
              <Input
                value={hours[key] || ""}
                onChange={(e) => updateDay(key, e.target.value)}
                placeholder="9:00-18:00 / 定休日"
                className="flex-1"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          1つ以上入力すると10点加算されます。定休日の場合は「定休日」と入力してください。
        </p>
      </CardContent>
    </Card>
  );
}
