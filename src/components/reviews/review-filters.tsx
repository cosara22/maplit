"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

const filterOptions = [
  { value: "all", label: "すべて" },
  { value: "unreplied", label: "未返信" },
  { value: "replied", label: "返信済み" },
  { value: "high_rating", label: "高評価(4★+)" },
  { value: "low_rating", label: "低評価(3★-)" },
  { value: "high_aio", label: "AIO高スコア(4+)" },
] as const;

const sortOptions = [
  { value: "newest", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "rating_high", label: "高評価順" },
  { value: "rating_low", label: "低評価順" },
  { value: "aio_high", label: "AIOスコア順" },
] as const;

const periodOptions = [
  { value: "", label: "全期間" },
  { value: "7d", label: "過去7日" },
  { value: "30d", label: "過去30日" },
  { value: "90d", label: "過去90日" },
  { value: "1y", label: "過去1年" },
] as const;

interface ReviewFiltersProps {
  filter: string;
  sort: string;
  search: string;
  period: string;
  onFilterChange: (filter: string) => void;
  onSortChange: (sort: string) => void;
  onSearchChange: (search: string) => void;
  onPeriodChange: (period: string) => void;
}

export function ReviewFilters({
  filter,
  sort,
  search,
  period,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onPeriodChange,
}: ReviewFiltersProps) {
  return (
    <div className="space-y-3">
      {/* 期間・ソート・検索 */}
      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={(v) => onPeriodChange(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="全期間" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value || "__all__"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => onSortChange(v ?? "newest")}>
          <SelectTrigger>
            <SelectValue placeholder="ソート" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="口コミを検索..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* フィルタチップ */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onFilterChange(opt.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === opt.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
