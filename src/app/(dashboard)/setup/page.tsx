import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createTenantClient } from "@/lib/prisma-tenant";
import { SetupContent } from "@/components/setup/setup-content";

export default async function SetupPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const db = createTenantClient(session.user.tenantId);

  const location = await db.location.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">
          店舗が登録されていません。
        </p>
      </div>
    );
  }

  return <SetupContent locationId={location.id} locationName={location.name} />;
}
