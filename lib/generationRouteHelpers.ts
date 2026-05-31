import type { RuntimeContext } from "./runtimeContext.js";
import { isGenerationCanceledError } from "./generationCancel.js";
import { isJobCanceled } from "./inflight.js";
import { classifyUpstreamError } from "./errorClassify.js";
import { errInfo } from "./errInfo.js";

/**
 * Validates the moderation setting against the configured valid values.
 */
export function validateModeration(ctx: RuntimeContext, moderation: unknown) {
  if (typeof moderation !== "string" || !ctx.config.oauth.validModeration.has(moderation)) {
    return { error: "moderation must be one of: auto, low" };
  }
  return { moderation };
}

/**
 * Decides the output image format based on its MIME type.
 */
export function imageFormatFromMime(mime: string | null | undefined): "png" | "jpeg" | "webp" {
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/webp") return "webp";
  return "png";
}

/**
 * Checks if the generation error is due to job cancellation.
 */
export function isCanceledGenerationError(err: unknown, requestId: string): boolean {
  return isGenerationCanceledError(err) || isJobCanceled(requestId);
}

export interface GenerationErrorResponsePayload {
  error: string;
  code: string;
  upstreamCode: string | null;
  upstreamType: string | null;
  upstreamParam: string | null;
  diagnosticReason: string | null;
  retryKind: string | null;
  initialEventCount: number | null;
  initialEventTypes: unknown | null;
  referencesDroppedOnRetry: boolean | null;
  developerPromptDroppedOnRetry: boolean | null;
  webSearchDroppedOnRetry: boolean | null;
  fallbackEventCount: number | null;
  fallbackEventTypes: unknown | null;
  fallbackImageCallSeen: boolean | null;
  fallbackImageResultCount: number | null;
  errorEventCount: number | null;
  eventTypes: unknown | null;
  webSearchCalls: number | null;
  responseDiagnostics: unknown | null;
  toolTypes: unknown | null;
  toolChoiceKind: unknown | null;
  requestId: string;
}

/**
 * Standardizes the generation/edit API error responses.
 */
export function buildGenerationErrorResponse(
  error: unknown,
  requestId: string,
  fallbackDefaultCode: "GENERATE_FAILED" | "EDIT_FAILED"
): { status: number; payload: GenerationErrorResponsePayload } {
  const err = errInfo(error);
  const ext = (err.raw && typeof err.raw === "object" ? err.raw as Record<string, unknown> : {});
  const code = err.code || classifyUpstreamError(err.message) || fallbackDefaultCode;
  const status = err.status || 500;

  const payload: GenerationErrorResponsePayload = {
    error: err.message,
    code,
    upstreamCode: (ext.upstreamCode as string) || null,
    upstreamType: (ext.upstreamType as string) || null,
    upstreamParam: (ext.upstreamParam as string) || null,
    diagnosticReason: (ext.diagnosticReason as string) || null,
    retryKind: (ext.retryKind as string) || null,
    initialEventCount: typeof ext.initialEventCount === "number" ? ext.initialEventCount : null,
    initialEventTypes: ext.initialEventTypes || null,
    referencesDroppedOnRetry: typeof ext.referencesDroppedOnRetry === "boolean" ? ext.referencesDroppedOnRetry : null,
    developerPromptDroppedOnRetry: typeof ext.developerPromptDroppedOnRetry === "boolean" ? ext.developerPromptDroppedOnRetry : null,
    webSearchDroppedOnRetry: typeof ext.webSearchDroppedOnRetry === "boolean" ? ext.webSearchDroppedOnRetry : null,
    fallbackEventCount: typeof ext.fallbackEventCount === "number" ? ext.fallbackEventCount : null,
    fallbackEventTypes: ext.fallbackEventTypes || null,
    fallbackImageCallSeen: typeof ext.fallbackImageCallSeen === "boolean" ? ext.fallbackImageCallSeen : null,
    fallbackImageResultCount: typeof ext.fallbackImageResultCount === "number" ? ext.fallbackImageResultCount : null,
    errorEventCount: typeof ext.eventCount === "number" ? ext.eventCount : null,
    eventTypes: ext.eventTypes || null,
    webSearchCalls: typeof ext.webSearchCalls === "number" ? ext.webSearchCalls : null,
    responseDiagnostics: ext.responseDiagnostics || null,
    toolTypes: ext.toolTypes || null,
    toolChoiceKind: ext.toolChoiceKind || null,
    requestId,
  };

  return { status, payload };
}
