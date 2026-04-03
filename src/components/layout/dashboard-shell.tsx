"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

// パス→ページタイトルのマッピング
const pageTitles: Record<string, string> = {
  "/": "ダッシュボード",
  "/setup": "GBP初期設定",
  "/surveys": "アンケート管理",
  "/reviews": "Google口コミ",
  "/ng-words": "NGワード設定",
  "/rank-analytics": "キーワード分析",
  "/citations": "サイテーション",
  "/settings": "各種設定",
  "/posts": "投稿一覧",
};

function getPageTitle(pathname: string): string {
  // 完全一致
  if (pageTitles[pathname]) return pageTitles[pathname];
  // プレフィックス一致（サブページ対応）
  for (const [path, title] of Object.entries(pageTitles)) {
    if (path !== "/" && pathname.startsWith(path)) return title;
  }
  return "MapLit";
}

interface DashboardShellProps {
  children: React.ReactNode;
  tenantName: string;
}

export function DashboardShell({ children, tenantName }: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* デスクトップサイドバー */}
      <aside className="hidden shrink-0 md:block">
        <Sidebar tenantName={tenantName} />
      </aside>

      {/* モバイルサイドバー（Sheet） */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[230px] p-0">
          <SheetTitle className="sr-only">ナビゲーションメニュー</SheetTitle>
          <Sidebar
            tenantName={tenantName}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* メインエリア */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
