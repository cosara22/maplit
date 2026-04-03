import { prisma } from "./prisma";

// テナント分離用のPrismaクライアント拡張
// 全クエリにtenant_idフィルタを自動付与する

// テナントIDでフィルタリングするモデル一覧
const TENANT_MODELS = [
  "User",
  "Location",
  "NgWord",
] as const;

// location_id経由でテナントに紐づくモデル（直接tenant_idを持たない）
const LOCATION_SCOPED_MODELS = [
  "Review",
  "ReviewReply",
  "Ranking",
  "Post",
  "Citation",
  "Survey",
  "SurveyResponse",
  "Integration",
  "TamperingLog",
  "GbpScore",
  "PerformanceMetric",
  "AiReplySettings",
] as const;

/**
 * テナントスコープ付きPrismaクライアントを生成
 * セッションから取得したtenantIdを全クエリに自動付与する
 */
export function createTenantClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model) return query(args);

        const isTenantModel = TENANT_MODELS.includes(
          model as (typeof TENANT_MODELS)[number]
        );

        if (!isTenantModel) return query(args);

        // findMany, findFirst, count, updateMany, deleteMany にwhere条件を追加
        if (
          "where" in args ||
          operation === "findMany" ||
          operation === "findFirst" ||
          operation === "count" ||
          operation === "updateMany" ||
          operation === "deleteMany"
        ) {
          args.where = { ...args.where, tenantId };
        }

        // create時にtenantIdを自動付与
        if (operation === "create" && "data" in args) {
          args.data = { ...args.data, tenantId };
        }

        // createMany時にtenantIdを自動付与
        if (operation === "createMany" && "data" in args) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d: Record<string, unknown>) => ({
              ...d,
              tenantId,
            }));
          } else {
            args.data = { ...args.data, tenantId };
          }
        }

        return query(args);
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantClient>;
