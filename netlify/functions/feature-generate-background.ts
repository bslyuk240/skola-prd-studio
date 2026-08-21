// Netlify Background Function for Feature Planner document generation.
import { db } from "../../src/db";
import { featureDocuments } from "../../src/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyBackgroundRequest } from "../../src/lib/background-function-auth";
import {
  generateFeatureDocument,
  type FeatureDocumentType,
} from "../../src/lib/generate-feature-document";

interface Event {
  body?: string | null;
  headers?: Record<string, string | undefined>;
}

export const handler = async (event: Event) => {
  let featureRequestId = "";
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
    featureRequestId = payload.featureRequestId;
    documentType = payload.documentType;
    const userId = payload.userId;

    if (!featureRequestId || !documentType || !userId) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    await generateFeatureDocument(
      featureRequestId,
      documentType as FeatureDocumentType,
      userId
    );

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("[feature-generate-background]", err);
    if (featureRequestId && documentType) {
      try {
        await db
          .update(featureDocuments)
          .set({ status: "pending", updatedAt: new Date() })
          .where(
            and(
              eq(featureDocuments.featureRequestId, featureRequestId),
              eq(featureDocuments.type, documentType as typeof featureDocuments.$inferSelect["type"])
            )
          );
      } catch (revertErr) {
        console.error("[feature-generate-background] failed to revert status", revertErr);
      }
    }
    return { statusCode: 500, body: "Generation failed" };
  }
};
