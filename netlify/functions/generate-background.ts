// Netlify Background Function — runs with up to 15 minutes execution time,
// well beyond the ~10-26s limit on regular synchronous functions. Triggered
// by /api/generate, which returns to the client immediately while this runs.
// Relative imports only — this is bundled separately from the Next.js app
// and does not resolve the "@/" tsconfig path alias.
import { db } from "../../src/db";
import { documents } from "../../src/db/schema";
import { eq, and } from "drizzle-orm";
import { generateProjectDocument } from "../../src/lib/generate-project-document";
import { verifyBackgroundRequest } from "../../src/lib/background-function-auth";

interface Event {
  body?: string | null;
  headers?: Record<string, string | undefined>;
}

export const handler = async (event: Event) => {
  let projectId = "";
  let documentType = "";

  try {
    const rawBody = event.body ?? "{}";
    if (
      !verifyBackgroundRequest(
        rawBody,
        event.headers,
        process.env.BACKGROUND_FUNCTION_SECRET
      )
    ) {
      return { statusCode: 403, body: "Forbidden" };
    }

    const payload = JSON.parse(rawBody);
    projectId = payload.projectId;
    documentType = payload.documentType;
    const userId = payload.userId;

    if (!projectId || !documentType || !userId) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    await generateProjectDocument(
      projectId,
      documentType as typeof documents.$inferSelect["type"],
      userId
    );

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("[generate-background]", err);
    if (projectId && documentType) {
      try {
        await db
          .update(documents)
          .set({ status: "pending", updatedAt: new Date() })
          .where(
            and(
              eq(documents.projectId, projectId),
              eq(documents.type, documentType as typeof documents.$inferSelect["type"])
            )
          );
      } catch (revertErr) {
        console.error("[generate-background] failed to revert status", revertErr);
      }
    }
    return { statusCode: 500, body: "Generation failed" };
  }
};
