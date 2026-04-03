"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ReviewPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ReviewPagination({
  page,
  totalPages,
  onPageChange,
}: ReviewPaginationProps) {
  // 表示するページ番号を計算（最大5ページ分）
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {getPageNumbers().map((p) => (
        <Button
          key={p}
          variant={p === page ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(p)}
          className="min-w-[36px]"
        >
          {p}
        </Button>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
