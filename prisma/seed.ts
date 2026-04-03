import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL が設定されていません");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// サイテーションプラットフォーム初期データ（設計書5章準拠）
const CITATION_PLATFORMS = [
  { platformName: "Apple Maps", platformCategory: "検索、音声、発見" },
  { platformName: "Bing", platformCategory: "検索、音声、発見" },
  { platformName: "Siri", platformCategory: "音声システム" },
  {
    platformName: "Foursquare",
    platformCategory: "ソーシャルネットワークおよびアプリ",
  },
  { platformName: "HERE", platformCategory: "ナビゲーションサービス" },
  { platformName: "TomTom", platformCategory: "ナビゲーションサービス" },
  { platformName: "Navmii", platformCategory: "ナビゲーションサービス" },
  { platformName: "Uber", platformCategory: "ナビゲーションサービス" },
  { platformName: "Where To?", platformCategory: "ナビゲーションサービス" },
  { platformName: "Petal Search", platformCategory: "検索、音声、発見" },
  { platformName: "wediGo", platformCategory: "ナビゲーションサービス" },
  { platformName: "Alexa", platformCategory: "音声システム" },
  { platformName: "Mercato", platformCategory: "ディレクトリ" },
  { platformName: "OpenAI", platformCategory: "AI検索" },
  { platformName: "Toyota", platformCategory: "ナビゲーションサービス" },
  { platformName: "Tupalo", platformCategory: "ディレクトリ" },
  { platformName: "YP", platformCategory: "ディレクトリ" },
] as const;

async function main() {
  console.log("シードデータの投入を開始...");

  // 開発用パスワード（bcrypt コスト12）
  const devPassword = await bcrypt.hash("password123", 12);

  // テナント作成
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "sing薬局グループ",
      plan: "basic",
      trialEndsAt: new Date("2026-05-01"),
    },
  });
  console.log(`  テナント作成: ${tenant.name}`);

  // 管理者ユーザー作成
  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "admin@sing-pharmacy.example.com",
      },
    },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      tenantId: tenant.id,
      email: "admin@sing-pharmacy.example.com",
      encryptedPassword: devPassword,
      name: "管理者",
      role: "admin",
      emailVerified: true,
    },
  });
  console.log(`  ユーザー作成: ${admin.name} (${admin.role})`);

  // スタッフユーザー作成
  const staff = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "staff@sing-pharmacy.example.com",
      },
    },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000011",
      tenantId: tenant.id,
      email: "staff@sing-pharmacy.example.com",
      encryptedPassword: devPassword,
      name: "スタッフA",
      role: "staff",
      emailVerified: true,
    },
  });
  console.log(`  ユーザー作成: ${staff.name} (${staff.role})`);

  // 店舗作成
  const location = await prisma.location.upsert({
    where: { id: "00000000-0000-0000-0000-000000000100" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000100",
      tenantId: tenant.id,
      name: "sing薬局 馬込",
      address: "東京都大田区中馬込2丁目7-11 sing馬込 商心",
      phone: "03-0000-0000",
      category: "薬局",
      latitude: 35.5986,
      longitude: 139.7083,
      businessHours: {
        月: { open: "09:00", close: "19:00" },
        火: { open: "09:00", close: "19:00" },
        水: { open: "09:00", close: "19:00" },
        木: { open: "09:00", close: "19:00" },
        金: { open: "09:00", close: "19:00" },
        土: { open: "09:00", close: "13:00" },
        日: null,
      },
      subcategories: ["調剤薬局", "OTC医薬品"],
      isActive: true,
    },
  });
  console.log(`  店舗作成: ${location.name}`);

  // サイテーションプラットフォーム初期データ
  for (const platform of CITATION_PLATFORMS) {
    await prisma.citation.upsert({
      where: {
        locationId_platformName: {
          locationId: location.id,
          platformName: platform.platformName,
        },
      },
      update: {},
      create: {
        locationId: location.id,
        platformName: platform.platformName,
        platformCategory: platform.platformCategory,
        status: "pending",
      },
    });
  }
  console.log(
    `  サイテーション作成: ${CITATION_PLATFORMS.length}プラットフォーム`
  );

  // サンプル口コミ
  const review = await prisma.review.upsert({
    where: { gbpReviewId: "sample-review-001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000001001",
      locationId: location.id,
      gbpReviewId: "sample-review-001",
      reviewerName: "田中太郎",
      rating: 5,
      comment:
        "とても親切な薬局です。処方箋の説明も丁寧で、待ち時間も短いです。",
      language: "ja",
      aioScore: 4,
      replyRecommended: true,
      reviewedAt: new Date("2026-03-15"),
    },
  });

  // サンプルAI返信
  await prisma.reviewReply.upsert({
    where: { id: "00000000-0000-0000-0000-000000002001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000002001",
      reviewId: review.id,
      aiGeneratedText:
        "田中様、素敵な口コミをいただきありがとうございます。お薬の説明を丁寧にすることを心がけております。今後もお気軽にお越しください。",
      status: "draft",
    },
  });
  console.log("  サンプル口コミ・返信作成");

  // GBPスコア
  await prisma.gbpScore.upsert({
    where: { locationId: location.id },
    update: {},
    create: {
      locationId: location.id,
      totalScore: 72,
      scoreBreakdown: {
        basicInfo: 90,
        photos: 60,
        reviews: 75,
        posts: 40,
        attributes: 80,
      },
      missingItems: ["写真10枚以上", "投稿を週1回以上", "Q&Aの設定"],
      calculatedAt: new Date(),
    },
  });
  console.log("  GBPスコア作成");

  // AI返信設定
  await prisma.aiReplySettings.upsert({
    where: { locationId: location.id },
    update: {},
    create: {
      locationId: location.id,
      replyKeywords: ["薬局", "処方箋", "OTC", "健康相談"],
      replyStyleInstructions:
        "丁寧で温かみのある返信を心がけてください。お客様のお名前を必ず含めてください。",
      replyTone: "丁寧",
    },
  });
  console.log("  AI返信設定作成");

  console.log("\nシードデータの投入が完了しました ✓");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("シードエラー:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
