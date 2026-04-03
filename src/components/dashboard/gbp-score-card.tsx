"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

interface GbpScoreData {
  totalScore: number;
  maxScore: number;
  missingItems: string[];
  calculatedAt: string | null;
}

interface GbpScoreCardProps {
  locationId: string;
}

const DONUT_COLORS = ["#6366f1", "#e5e7eb"];

export function GbpScoreCard({ locationId }: GbpScoreCardProps) {
  const [data, setData] = useState<GbpScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScore() {
      try {
        const params = new URLSearchParams({ locationId });
        const res = await fetch(`/api/dashboard/gbp-score?${params}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("[GbpScoreCard] fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchScore();
  }, [locationId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">スコアデータがありません</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: "スコア", value: data.totalScore },
    { name: "残り", value: data.maxScore - data.totalScore },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          GBPプロフィール完成度
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          {/* ドーナツチャート */}
          <div className="relative w-32 h-32 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={56}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={DONUT_COLORS[index]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* 中央スコア表示 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{data.totalScore}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>

          {/* 未設定項目 */}
          <div className="flex-1 min-w-0">
            {data.missingItems.length > 0 && (
              <div className="mb-3">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  未設定の項目
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.missingItems.map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Link href="/setup">
              <Button size="sm" className="mt-2">
                GBP設定を完了する
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
