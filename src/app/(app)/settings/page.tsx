import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [clerkUser, prefsRows] = await Promise.all([
    currentUser(),
    db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1),
  ]);

  const prefs = prefsRows[0] ?? null;

  return (
    <SettingsClient
      user={{
        name: clerkUser?.fullName ?? clerkUser?.firstName ?? "User",
        email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
        imageUrl: clerkUser?.imageUrl ?? "",
        id: userId,
      }}
      prefs={{
        aiModel: prefs?.aiModel ?? "google/gemini-3.5-flash",
        defaultSecurityLevel: (prefs?.defaultSecurityLevel as "basic" | "standard" | "high" | "enterprise") ?? "standard",
        defaultSecurityToggles: (prefs?.defaultSecurityToggles as Record<string, boolean>) ?? null,
        wordCountVisible: prefs?.wordCountVisible ?? true,
        autoRefresh: prefs?.autoRefresh ?? true,
      }}
    />
  );
}
