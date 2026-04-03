"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  ClipboardList,
  Star,
  ShieldOff,
  TrendingUp,
  Link2,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";

// ナビゲーション項目定義
const navItems = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/setup", label: "GBP設定", icon: Store },
  { href: "/surveys", label: "アンケート", icon: ClipboardList },
  { href: "/reviews", label: "口コミ", icon: Star },
  { href: "/ng-words", label: "NGワード", icon: ShieldOff },
  { href: "/rank-analytics", label: "分析", icon: TrendingUp },
  { href: "/citations", label: "サイテーション", icon: Link2 },
  { href: "/settings", label: "設定", icon: Settings },
] as const;

interface SidebarProps {
  tenantName: string;
  onNavigate?: () => void;
}

export function Sidebar({ tenantName, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await signOut({ redirectTo: "/login" });
  };

  return (
    <div className="flex h-full w-[230px] flex-col bg-[hsl(230,30%,15%)] text-white">
      {/* ロゴ・テナント名 */}
      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-lg font-bold tracking-wide">MapLit</div>
        <div className="mt-1 truncate text-xs text-white/60">{tenantName}</div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto py-2" role="navigation">
        <ul>
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                    active
                      ? "border-l-4 border-[#6366f1] bg-white/5 text-[#818cf8]"
                      : "border-l-4 border-transparent text-white/80 hover:bg-white/5 hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ログアウト */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>ログアウト</span>
        </button>
      </div>
    </div>
  );
}
