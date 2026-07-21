import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { eieError, eieOk, eieValidationError } from "@/lib/eie/api-response";
import { processSource, prepareSourceForProcessing } from "@/lib/eie/orchestrator";
import { processWebhookSchema } from "@/lib/zod/eie-schemas";

export const maxDuration = 300;

function verifyInternalSecret(req: NextRequest): boolean {
  const expected = process.env.EIE_INTERNAL_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-eie-internal-secret");
  if (!provided || provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!verifyInternalSecret(req)) {
    return eieError("FORBIDDEN", "Invalid internal webhook secret", 403);
  }

  const body = await req.json();
  const parsed = processWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  const { sourceId } = parsed.data;

  try {
    await processSource(sourceId);
    return eieOk({ sourceId, status: "processed" });
  } catch (error) {
    return eieError(
      "EXTRACTION_JOB_FAILED",
      error instanceof Error ? error.message : "Processing failed",
      422
    );
  }
}

/** Allow admin-triggered re-queue through the same pipeline with shared secret. */
export async function PUT(req: NextRequest) {
  if (!verifyInternalSecret(req)) {
    return eieError("FORBIDDEN", "Invalid internal webhook secret", 403);
  }

  const body = await req.json();
  const parsed = processWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return eieValidationError(parsed.error.issues);
  }

  await prepareSourceForProcessing(parsed.data.sourceId);
  await processSource(parsed.data.sourceId);
  return eieOk({ sourceId: parsed.data.sourceId, status: "reprocessed" });
}
