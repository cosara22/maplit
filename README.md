# MapLit（マップリット）

ローカルビジネス向け AI検索最適化SaaS。Google Business Profile（GBP）のMEO/AIO対策を一元管理し、店舗の集客力を最大化します。

## 主な機能

- **ダッシュボード** — GBP完成度スコア、パフォーマンスKPI、評価・レビュー概要
- **Google口コミ管理** — AI返信生成（GPT-4o-mini）、AIOスコア算出、返信推奨判定
- **Instagram自動同期** — Instagram投稿をGBPに自動転載（ハッシュタグ除去・文章最適化）
- **キーワード順位分析** — Googleマップ検索順位の毎日自動計測・推移グラフ
- **サイテーション管理** — 17+プラットフォームへの店舗情報一括配信
- **アンケート管理** — QRコードアンケートで口コミ投稿を促進（多言語対応）
- **改ざん検知** — GBP情報の不正変更をリアルタイム検知・LINE通知

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 15 (App Router) + TypeScript |
| UIライブラリ | shadcn/ui + Tailwind CSS |
| 認証 | NextAuth.js (Auth.js v5) — Email + Google OAuth |
| ORM | Prisma |
| データベース | PostgreSQL (Supabase) |
| キャッシュ/キュー | Redis (Upstash) + BullMQ |
| AI | OpenAI API (GPT-4o-mini) |
| 順位計測 | SerpAPI |
| ホスティング | Vercel |

## 開発

```bash
pnpm install
pnpm dev        # 開発サーバー起動
pnpm test       # ユニット + 統合テスト
pnpm test:e2e   # E2Eテスト (Playwright)
pnpm build      # 本番ビルド
```

## ライセンス

MIT
