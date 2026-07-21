import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { EIE_ADMIN_ROLES, type EieAdminRole } from "@/lib/eie/constants";
import { eieError } from "@/lib/eie/api-response";

type ClerkMetadata = {
  role?: string;
};

function readRole(sessionClaims: Record<string, unknown> | null | undefined): string | undefined {
  const metadata = sessionClaims?.metadata as ClerkMetadata | undefined;
  return metadata?.role;
}

function isAdminRole(role: string | undefined): role is EieAdminRole {
  return role !== undefined && (EIE_ADMIN_ROLES as readonly string[]).includes(role);
}

export type AuthenticatedUser = {
  userId: string;
};

export type AdminUser = AuthenticatedUser & {
  role: EieAdminRole;
};

export type AuthResult<T> = T | NextResponse;

export async function requireAuthenticated(): Promise<AuthResult<AuthenticatedUser>> {
  const { userId } = await auth();
  if (!userId) {
    return eieError("UNAUTHORIZED", "User is unauthenticated.", 401);
  }
  return { userId };
}

export async function requireAdmin(): Promise<AuthResult<AdminUser>> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return eieError("UNAUTHORIZED", "User is unauthenticated.", 401);
  }

  const role = readRole(sessionClaims as Record<string, unknown> | null | undefined);
  if (!isAdminRole(role)) {
    return eieError(
      "FORBIDDEN",
      "Only administrators are authorized for this action.",
      403
    );
  }

  return { userId, role };
}

export function isAuthFailure<T>(result: AuthResult<T>): result is NextResponse {
  return result instanceof NextResponse;
}
