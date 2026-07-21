import { NextRequest } from "next/server";
import { db } from "@/db";
import { eieKnowledgeSources } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk, eieValidationError } from "@/lib/eie/api-response";
import { checkRateLimit } from "@/lib/eie/rate-limit";
import { assertPublicUrl } from "@/lib/eie/security/url-validator";
import {
  ingestSourceSchema,
  sourceListQuerySchema,
} from "@/lib/zod/eie-schemas";
import { queueSourceProcessing } from "@/lib/eie/orchestrator";

const ALLOWED_INGEST_MIME_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/plain",
  "video/mp4",
  "video/webm",
  "audio/mp4",
  "audio/m4a",
]);

const BLOCKED_FILE_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".dll",
  ".msi",
  ".app",
  ".dmg",
  ".deb",
  ".rpm",
  ".com",
  ".scr",
];

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const rate = checkRateLimit(`eie-ingest:${auth.userId}`, 10, 60_000);
  if (!rate.allowed) {
    return eieError(
      "RATE_LIMIT_EXCEEDED",
      `Too many ingestion requests. Retry in ${rate.retryAfterSeconds}s.`,
      429
    );
  }

  const body = await req.json();
  const parsed = ingestSourceSchema.safeParse(body);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const input = parsed.data;

  if ("sourceUrl" in input && input.sourceUrl) {
    try {
      await assertPublicUrl(input.sourceUrl);
    } catch (error) {
      return eieError(
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "URL is not allowed",
        400,
        [{ field: "sourceUrl", message: "URL is not allowed" }]
      );
    }
  }

  if ("fileKey" in input) {
    const mimeType = input.metadata?.mimeType;
    if (!mimeType || !ALLOWED_INGEST_MIME_TYPES.has(mimeType)) {
      return eieError("VALIDATION_ERROR", "File type not allowed", 400, [
        { field: "metadata.mimeType", message: "File type not allowed" },
      ]);
    }
    const lowerKey = input.fileKey.toLowerCase();
    if (BLOCKED_FILE_EXTENSIONS.some((ext) => lowerKey.endsWith(ext))) {
      return eieError("VALIDATION_ERROR", "Executable files are not allowed", 400, [
        { field: "fileKey", message: "Executable files are not allowed" },
      ]);
    }
  }

  const isPersonalNote = input.sourceType === "personal_note";

  const [source] = await db
    .insert(eieKnowledgeSources)
    .values({
      name: input.name,
      sourceType: input.sourceType,
      sourceUrl: "sourceUrl" in input ? input.sourceUrl : null,
      fileKey: "fileKey" in input ? input.fileKey : null,
      rawContent: isPersonalNote ? input.content : null,
      metadata: input.metadata ?? {},
      status: "pending",
      createdBy: auth.userId,
    })
    .returning();

  const dispatch = await queueSourceProcessing(source.id);

  return eieOk({ ...source, processing: dispatch }, 201);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = sourceListQuerySchema.safeParse(params);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const { status, sourceType, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(eieKnowledgeSources.status, status));
  if (sourceType) conditions.push(eq(eieKnowledgeSources.sourceType, sourceType));

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(eieKnowledgeSources)
    .where(whereClause)
    .orderBy(desc(eieKnowledgeSources.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eieKnowledgeSources)
    .where(whereClause);

  return eieOk({
    rows,
    pagination: {
      currentPage: page,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
      totalCount: count ?? 0,
    },
  });
}
