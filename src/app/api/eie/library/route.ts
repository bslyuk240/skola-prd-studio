import { NextRequest } from "next/server";
import { requireAuthenticated, isAuthFailure } from "@/lib/eie/auth";
import { eieOk, eieValidationError } from "@/lib/eie/api-response";
import { librarySearchSchema } from "@/lib/zod/eie-schemas";
import { searchPublished } from "@/lib/eie/search";
import { toPublicConceptList } from "@/lib/eie/public-serializer";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticated();
  if (isAuthFailure(auth)) return auth;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = librarySearchSchema.safeParse(params);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const { page, limit } = parsed.data;
  const { rows, total } = await searchPublished(parsed.data);

  return eieOk({
    rows: toPublicConceptList(rows),
    pagination: {
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      totalCount: total,
    },
  });
}
