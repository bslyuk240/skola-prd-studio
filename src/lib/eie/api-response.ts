import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";

export type EieErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNSUPPORTED_INGESTION_SOURCE"
  | "EXTRACTION_JOB_FAILED"
  | "CONCEPT_NOT_PUBLISHED"
  | "RATE_LIMIT_EXCEEDED"
  | "MUTATION_VIOLATION"
  | "SLUG_CONFLICT"
  | "INTERNAL_ERROR";

type ErrorBody = {
  success: false;
  error: EieErrorCode;
  message: string;
  details?: unknown[];
};

type SuccessBody<T> = {
  success: true;
  data: T;
};

export function eieOk<T>(data: T, status = 200): NextResponse<SuccessBody<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function eieError(
  code: EieErrorCode,
  message: string,
  status: number,
  details?: unknown[]
): NextResponse<ErrorBody> {
  return NextResponse.json(
    {
      success: false,
      error: code,
      message,
      ...(details?.length ? { details } : {}),
    },
    { status }
  );
}

export function eieValidationError(issues: ZodIssue[]): NextResponse<ErrorBody> {
  return eieError(
    "VALIDATION_ERROR",
    "Request validation failed",
    400,
    issues.map((issue) => ({
      field: issue.path.map(String).join("."),
      message: issue.message,
    }))
  );
}
