import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createTenantClient } from "@/lib/prisma-tenant";
import { ReviewsContent } from "@/components/reviews/reviews-content";

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const db = createTenantClient(session.user.tenantId);

  // テナントの最初のアクティブな店舗を取得
  const location = await db.location.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Google口コミ
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          店舗が登録されていません。GBP初期設定から店舗を追加してください。
        </p>
      </div>
    );
  }

  return <ReviewsContent locationId={location.id} />;
}
