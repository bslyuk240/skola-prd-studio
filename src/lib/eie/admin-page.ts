import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EIE_ADMIN_ROLES, type EieAdminRole } from "@/lib/eie/constants";

export async function requireAdminPage(): Promise<{ userId: string; role: EieAdminRole }> {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (!role || !(EIE_ADMIN_ROLES as readonly string[]).includes(role)) {
    redirect("/dashboard");
  }

  return { userId, role: role as EieAdminRole };
}
