import { db } from "@/db";
import { eieSynthesisDrafts } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";
import { requireAdminPage } from "@/lib/eie/admin-page";
import { EieAdminNav } from "@/components/eie/admin-nav";

export default async function EieAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();

  const [pendingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eieSynthesisDrafts)
    .where(inArray(eieSynthesisDrafts.status, ["draft", "needs_revision"]));

  const pendingReviewCount = pendingRow?.count ?? 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Engineering Intelligence Engine
        </p>
        <h1 className="text-2xl font-bold">Admin Workspace</h1>
      </div>

      <EieAdminNav pendingReviewCount={pendingReviewCount} />

      {children}
    </div>
  );
}
