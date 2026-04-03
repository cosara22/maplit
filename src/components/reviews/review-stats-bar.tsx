"use client";

import { Card } from "@/components/ui/card";
import { Star, MessageSquare, Reply, AlertCircle } from "lucide-react";

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  replyRate: number;
  unrepliedCount: number;
}

interface ReviewStatsBarProps {
  stats: ReviewStats | null;
}

const statItems = [
  {
    key: "totalReviews" as const,
    label: "総レビュー数",
    icon: MessageSquare,
    format: (v: number) => String(v),
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    key: "averageRating" as const,
    label: "平均評価",
    icon: Star,
    format: (v: number) => v.toFixed(1),
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    key: "replyRate" as const,
    label: "返信率",
    icon: Reply,
    format: (v: number) => `${v}%`,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    key: "unrepliedCount" as const,
    label: "未返信",
    icon: AlertCircle,
    format: (v: number) => String(v),
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
];

export function ReviewStatsBar({ stats }: ReviewStatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => {
        const Icon = item.icon;
        const value = stats ? stats[item.key] : 0;
        return (
          <Card key={item.key} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${item.bgColor}`}>
                <Icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-xl font-bold text-gray-900">
                  {stats ? item.format(value) : "-"}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
