import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin, isAuthFailure } from "@/lib/eie/auth";
import { eieError, eieOk, eieValidationError } from "@/lib/eie/api-response";
import { checkRateLimit } from "@/lib/eie/rate-limit";
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
  const bucket = process.env.EIE_STORAGE_BUCKET;
  const endpoint = process.env.EIE_STORAGE_ENDPOINT;

  return eieOk({
    fileKey,
    fileSize,
    mimeType,
    uploadUrl: bucket && endpoint ? `${endpoint}/${bucket}/${fileKey}` : null,
    message:
      bucket && endpoint
        ? "Use uploadUrl with storage credentials for direct upload"
        : "Storage is not configured. Set EIE_STORAGE_BUCKET and EIE_STORAGE_ENDPOINT.",
  });
}
