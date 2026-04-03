"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SearchKeyword {
  keyword: string;
  count: number;
  isTracked: boolean;
}

interface SearchKeywordsCardProps {
  keywords: SearchKeyword[];
}

export function SearchKeywordsCard({ keywords }: SearchKeywordsCardProps) {
  if (!keywords || keywords.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">検索内容</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            検索キーワードデータがありません
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">検索内容</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {keywords.map((kw, index) => (
            <div
              key={kw.keyword}
              className="flex items-center justify-between py-2 border-b last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-6">
                  {index + 1}.
                </span>
                <span className="text-sm font-medium">{kw.keyword}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">
                  {kw.count.toLocaleString("ja-JP")}
                </span>
                {!kw.isTracked && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" disabled>
                    キーワード分析登録
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
