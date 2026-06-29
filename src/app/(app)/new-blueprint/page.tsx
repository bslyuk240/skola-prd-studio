import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BlueprintWizard } from "@/components/wizard/blueprint-wizard";

export default async function NewBlueprintPage() {
  const { userId } = await auth();
  const [prefs] = userId
    ? await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
    : [null];

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">New Blueprint</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Describe your app once to generate a complete build-ready blueprint.
        </p>
      </div>
      <BlueprintWizard
        defaultSecurityLevel={(prefs?.defaultSecurityLevel as "basic" | "standard" | "high" | "enterprise") ?? "standard"}
        defaultSecurityToggles={(prefs?.defaultSecurityToggles as Record<string, boolean>) ?? null}
      />
    </div>
  );
}
