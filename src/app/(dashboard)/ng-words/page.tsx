import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NgWordsContent } from "@/components/ng-words/ng-words-content";

export default async function NgWordsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return <NgWordsContent />;
}
