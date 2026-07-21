import { z } from "zod";
import {
  EIE_CATEGORIES,
  EIE_RELATIONSHIP_TYPES,
  EIE_SOURCE_TYPES,
  EIE_SYNTHESIS_STATUSES,
} from "@/lib/eie/constants";

const videoUrlPattern = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)/i;
const githubUrlPattern = /github\.com/i;

export const eieSourceTypeSchema = z.enum(EIE_SOURCE_TYPES);
export const eieSynthesisStatusSchema = z.enum(EIE_SYNTHESIS_STATUSES);
export const eieCategorySchema = z.enum(EIE_CATEGORIES);

const referenceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
});

const tradeOffSchema = z.object({
  alternative: z.string().min(1),
  pro: z.string().min(1),
  con: z.string().min(1),
});

/** Shared synthesis field shapes used by drafts and published knowledge */
export const synthesisFieldsSchema = z.object({
  conceptName: z.string().min(2).max(255),
  category: eieCategorySchema,
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  summary: z.string().min(10),
  practicalExplanation: z.string().min(10),
  bestPractices: z.array(z.string().min(1)).min(1),
  tradeOffs: z.union([z.array(z.string().min(1)), z.array(tradeOffSchema)]),
  alternativeApproaches: z.array(z.string().min(1)),
  securityConsiderations: z.array(z.string().min(1)).min(1),
  commonMistakes: z.array(z.string().min(1)),
  implementationRecommendations: z.union([
    z.array(z.string().min(1)),
    z.record(z.string(), z.unknown()),
  ]),
  references: z.array(referenceSchema).default([]),
});

const fileBackedSourceTypes = z.enum([
  "video_upload",
  "pdf",
  "book",
  "official_doc",
  "markdown_file",
  "research_paper",
]);

export const ingestSourceSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("video_url"),
    name: z.string().min(3).max(255),
    sourceUrl: z
      .string()
      .url()
      .regex(videoUrlPattern, "URL must be YouTube, Vimeo, or TikTok"),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    sourceType: z.literal("github_repo"),
    name: z.string().min(3).max(255),
    sourceUrl: z
      .string()
      .url()
      .regex(githubUrlPattern, "URL must be a GitHub repository link"),
    metadata: z
      .object({
        branch: z.string().min(1).default("main"),
      })
      .optional(),
  }),
  z.object({
    sourceType: z.literal("personal_note"),
    name: z.string().min(3).max(255),
    content: z.string().min(20).max(100_000),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    sourceType: fileBackedSourceTypes,
    name: z.string().min(3).max(255),
    fileKey: z.string().min(1),
    sourceUrl: z.string().url().optional(),
    metadata: z
      .object({
        fileSize: z.number().int().positive().max(52_428_800), // 50MB
        mimeType: z.string().min(1),
      })
      .optional(),
  }),
]);

export const updateDraftSchema = synthesisFieldsSchema
  .partial()
  .extend({
    status: eieSynthesisStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const mergeSplitSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("merge"),
    sourceDraftIds: z.array(z.string().uuid()).min(2),
    mergedConceptName: z.string().min(5).max(255),
    category: eieCategorySchema,
  }),
  z.object({
    action: z.literal("split"),
    sourceDraftId: z.string().uuid(),
    definitions: z
      .array(
        z.object({
          conceptName: z.string().min(5).max(255),
          scope: z.string().min(20),
          category: eieCategorySchema,
        })
      )
      .min(2),
  }),
]);

export const librarySearchSchema = z.object({
  query: z.string().max(500).optional(),
  category: eieCategorySchema.optional(),
  tags: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined
    ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const publishDraftSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens"
    ),
  relatedKnowledgeIds: z.array(z.string().uuid()).optional(),
  relationshipType: z.enum(EIE_RELATIONSHIP_TYPES).default("related_to"),
});

export const sourceListQuerySchema = z.object({
  status: z.enum(["pending", "processing", "success", "failed"]).optional(),
  sourceType: eieSourceTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const draftListQuerySchema = z.object({
  status: eieSynthesisStatusSchema.optional(),
  sourceId: z.string().uuid().optional(),
  category: eieCategorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const exportConceptSchema = z.object({
  format: z.enum(["pdf", "markdown"]).default("markdown"),
});

export const processWebhookSchema = z.object({
  sourceId: z.string().uuid(),
});

export type IngestSourceInput = z.infer<typeof ingestSourceSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
export type MergeSplitInput = z.infer<typeof mergeSplitSchema>;
export type LibrarySearchInput = z.infer<typeof librarySearchSchema>;
export type PublishDraftInput = z.infer<typeof publishDraftSchema>;
export type SynthesisFields = z.infer<typeof synthesisFieldsSchema>;
