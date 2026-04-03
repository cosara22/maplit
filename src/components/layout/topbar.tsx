"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  title: string;
  onMenuClick: () => void;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center border-b bg-white px-4 shadow-sm md:px-6">
      {/* ハンバーガーメニュー（モバイルのみ） */}
      <Button
        variant="ghost"
        size="icon"
        className="mr-3 md:hidden"
        onClick={onMenuClick}
        aria-label="メニューを開く"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* ページタイトル */}
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
    </header>
  );
}
