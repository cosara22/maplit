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
import {
  Search,
  Eye,
  MapPin,
  Phone,
  PhoneCall,
  MousePointer,
  Globe,
  Activity,
} from "lucide-react";

interface PerformanceData {
  searchCount: number;
  viewCount: number;
  directionRequests: number;
  callClickRate: number;
  phoneCalls: number;
  callButtonClicks: number;
  websiteClicks: number;
  totalActions: number;
  periodEnd: string;
  searchKeywords: Array<{
    keyword: string;
    count: number;
    isTracked: boolean;
  }>;
}

interface PerformanceSectionProps {
  locationId: string;
}

const KPI_CONFIG = [
  { key: "searchCount", label: "検索数", icon: Search, format: "number" },
  { key: "viewCount", label: "閲覧数", icon: Eye, format: "number" },
  {
    key: "directionRequests",
    label: "ルートリクエスト",
    icon: MapPin,
    format: "number",
  },
  {
    key: "callClickRate",
    label: "通話クリック率",
    icon: Phone,
    format: "percent",
  },
  { key: "phoneCalls", label: "電話（メイン）", icon: PhoneCall, format: "number" },
  {
    key: "callButtonClicks",
    label: "通話ボタン",
    icon: MousePointer,
    format: "number",
  },
  { key: "websiteClicks", label: "ウェブサイト", icon: Globe, format: "number" },
  { key: "totalActions", label: "合計アクション", icon: Activity, format: "number" },
] as const;

function formatValue(value: number, format: string): string {
  if (format === "percent") return `${value}%`;
  return value.toLocaleString("ja-JP");
}

export function PerformanceSection({ locationId }: PerformanceSectionProps) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/performance?locationId=${locationId}&period=${period}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // サイレント
    } finally {
      setLoading(false);
    }
  }, [locationId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">パフォーマンス</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">過去30日間</SelectItem>
              <SelectItem value="90d">過去90日間</SelectItem>
              <SelectItem value="1y">過去1年間</SelectItem>
              <SelectItem value="all">全期間</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            期間比較
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">読み込み中...</p>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">データがありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {KPI_CONFIG.map(({ key, label, icon: Icon, format }) => (
              <div
                key={key}
                className="rounded-lg border bg-card p-4 text-center"
              >
                <Icon className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-xl font-bold">
                  {formatValue(
                    data[key as keyof PerformanceData] as number,
                    format
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
