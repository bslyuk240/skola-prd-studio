import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk, eieValidationError } from "@/lib/eie/api-response";
import { checkRateLimit } from "@/lib/eie/rate-limit";
import { createPresignedUploadUrl, isStorageConfigured } from "@/lib/eie/storage";
import { z } from "zod";

const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().max(52_428_800),
});

const ALLOWED_MIME_TYPES = new Set([
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

  if (!isStorageConfigured()) {
    return eieError(
      "STORAGE_NOT_CONFIGURED",
      "File storage is not configured. Set all EIE_STORAGE_* environment variables.",
      503
    );
  }

  const rate = checkRateLimit(`eie-ingest:${auth.userId}`, 10, 60_000);
  if (!rate.allowed) {
    return eieError(
      "RATE_LIMIT_EXCEEDED",
      `Too many upload requests. Retry in ${rate.retryAfterSeconds}s.`,
      429
    );
  }

  const body = await req.json();
  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const { filename, mimeType, fileSize } = parsed.data;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return eieError("VALIDATION_ERROR", "File type not allowed", 400, [
      { field: "mimeType", message: "File type not allowed" },
    ]);
  }

  const lowerName = filename.toLowerCase();
  if (BLOCKED_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return eieError("VALIDATION_ERROR", "Executable files are not allowed", 400, [
      { field: "filename", message: "Executable files are not allowed" },
    ]);
  }

  const fileKey = `eie/uploads/${auth.userId}/${randomUUID()}/${filename}`;

  try {
    const uploadUrl = await createPresignedUploadUrl(fileKey, mimeType);
    return eieOk({
      fileKey,
      fileSize,
      mimeType,
      uploadUrl,
      expiresInSeconds: 900,
    });
  } catch (error) {
    return eieError(
      "STORAGE_ERROR",
      error instanceof Error ? error.message : "Failed to create upload URL",
      500
    );
  }
}
