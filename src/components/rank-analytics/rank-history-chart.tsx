"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";

interface HistoryPoint {
  position: number | null;
  date: string;
}

interface HistoryData {
  keyword: string;
  keywordId: string;
  history: HistoryPoint[];
}

interface RankHistoryChartProps {
  locationId: string;
  keywordId: string;
  period: string;
}

export function RankHistoryChart({
  locationId,
  keywordId,
  period,
}: RankHistoryChartProps) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        locationId,
        keywordId,
        period,
      });
      const res = await fetch(`/api/rankings/history?${params}`);
      if (res.ok) {
        const result: HistoryData = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error("[RankHistoryChart] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [locationId, keywordId, period]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">
          この期間の計測データがありません
        </p>
      </div>
    );
  }

  // グラフ用データ整形
  const chartData = data.history.map((h) => ({
    date: new Date(h.date).toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
    }),
    fullDate: new Date(h.date).toLocaleDateString("ja-JP"),
    position: h.position,
    // 圏外は表示しない（グラフ上null）
    displayPosition: h.position,
  }));

  // Y軸の範囲を計算（順位は小さいほど良い → Y軸を反転）
  const positions = chartData
    .map((d) => d.position)
    .filter((p): p is number => p !== null);
  const minPos = positions.length > 0 ? Math.min(...positions) : 1;
  const maxPos = positions.length > 0 ? Math.max(...positions) : 20;
  const yMin = Math.max(1, minPos - 1);
  const yMax = Math.min(20, maxPos + 2);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            reversed
            domain={[yMin, yMax]}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            label={{
              value: "順位",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12 },
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-md">
                  <p className="text-xs text-muted-foreground">{item.fullDate}</p>
                  <p className="text-sm font-semibold">
                    {item.position !== null
                      ? `${item.position}位`
                      : "圏外"}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="displayPosition"
            stroke="#1a73e8"
            strokeWidth={2}
            dot={{ r: 4, fill: "#1a73e8" }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
