import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import { startJob, finishJob, registerJobAbortController, isJobCanceled } from "../lib/inflight.js";
import { isGenerationCanceledError, makeGenerationCanceledError } from "../lib/generationCancel.js";
import { logEvent, logError } from "../lib/logger.js";
import { invalidateHistoryIndex } from "../lib/historyIndex.js";
import { generateVideoViaGrok, type GrokVideoEvent } from "../lib/grokVideoAdapter.js";
import {
  normalizeGrokVideoModel,
  normalizeVideoResolution,
  normalizeVideoAspectRatio,
  normalizeVideoDuration,
  deriveVideoMode,
  clampVideoDuration,
  MAX_REF2V_REFERENCES,
  type VideoMode,
} from "../lib/imageModels.js";
import { errInfo } from "../lib/errInfo.js";
import { requireRuntimeContext, type RouteRuntimeContext, type RuntimeContext } from "../lib/runtimeContext.js";

function sendSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function toArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

type NormalizeError = { error: string; code: string; status: number };

function isNormalizeError(x: unknown): x is NormalizeError {
  return typeof x === "object" && x !== null && typeof (x as { error?: unknown }).error === "string";
}

async function resolveSourceImage(
  ctx: RuntimeContext,
  sourceImage: unknown,
  sourceFilename: unknown,
): Promise<{ b64: string | null; filename: string | null }> {
  if (typeof sourceFilename === "string" && sourceFilename) {
    const safe = sourceFilename.replace(/^\/+/, "");
    if (safe.includes("..")) throw { status: 400, code: "GROK_VIDEO_INVALID_MODE", message: "invalid source filename" };
    const buf = await readFile(join(ctx.config.storage.generatedDir, safe));
    return { b64: buf.toString("base64"), filename: safe };
  }
  if (typeof sourceImage === "string" && sourceImage) {
    return { b64: sourceImage, filename: null };
  }
  return { b64: null, filename: null };
}

/**
 * Normalizes an image input into a pure base64 string.
 * Supports:
 * - Pure base64 strings
 * - Data URLs (extracts prefix)
 * - Reference Library URLs (reads from referenceLibraryDir)
 * - Generated/History URLs (reads from generatedDir)
 * 
 * Performs validation:
 * - Empty string check
 * - Base64 charset check
 * - Decode buffer check
 * - JPEG/PNG/WEBP magic bytes check
 */
async function normalizeImageBase64(input: unknown, ctx: RuntimeContext): Promise<string> {
  const badImageErr = new Error("참조 이미지 데이터가 올바르지 않습니다. 보관함 이미지를 다시 저장하거나 JPG로 다시 업로드해 주세요.");

  if (typeof input !== "string" || !input.trim()) {
    throw badImageErr;
  }

  let str = input.trim();

  // 1. Data URL prefix check
  if (str.startsWith("data:")) {
    const commaIndex = str.indexOf(",");
    if (commaIndex === -1) {
      throw badImageErr;
    }
    str = str.slice(commaIndex + 1).trim();
  }

  // 2. URL detection and file-based resolution
  const isUrl =
    str.startsWith("/") ||
    str.startsWith("http://") ||
    str.startsWith("https://") ||
    str.startsWith("blob:") ||
    str.startsWith("data:") ||
    /[\\/]/.test(str);

  if (isUrl) {
    let filePath = "";

    if (str.startsWith("/reference-library/") || str.startsWith("/api/reference-library/")) {
      const filename = str.substring(str.lastIndexOf("/") + 1);
      const safe = filename.replace(/^\/+/, "");
      if (safe.includes("..")) {
        throw badImageErr;
      }
      filePath = join(ctx.config.storage.referenceLibraryDir, safe);
    } else if (str.startsWith("/generated/")) {
      const filename = str.substring(str.lastIndexOf("/") + 1);
      const safe = filename.replace(/^\/+/, "");
      if (safe.includes("..")) {
        throw badImageErr;
      }
      filePath = join(ctx.config.storage.generatedDir, safe);
    } else {
      throw badImageErr;
    }

    if (!filePath || !existsSync(filePath)) {
      throw badImageErr;
    }

    try {
      const buf = await readFile(filePath);
      str = buf.toString("base64");
    } catch (err) {
      throw badImageErr;
    }
  }

  // Remove whitespace/newlines from base64 string
  str = str.replace(/\s+/g, "");

  // 3. Base64 charset check
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!base64Regex.test(str)) {
    throw badImageErr;
  }

  // 4. Decode buffer and check length
  let buffer: Buffer;
  try {
    buffer = Buffer.from(str, "base64");
  } catch (err) {
    throw badImageErr;
  }

  if (buffer.length === 0) {
    throw badImageErr;
  }

  // 5. PNG/JPEG/WEBP magic bytes check
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
  const isWebp = buffer.length >= 12 &&
    buffer.toString("binary", 0, 4) === "RIFF" &&
    buffer.toString("binary", 8, 12) === "WEBP";

  if (!isJpeg && !isPng && !isWebp) {
    throw badImageErr;
  }

  return str;
}

export function registerVideoRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.post("/api/video/generate", async (req: Request, res: Response) => {
    const requestId =
      typeof req.body?.requestId === "string"
        ? req.body.requestId
        : typeof req.body?.clientRequestId === "string"
          ? req.body.clientRequestId
          : req.id;
    let finishStatus = "completed";
    let finishHttpStatus = 200;
    let finishErrorCode: string | undefined;
    let finishMeta: Record<string, unknown> = {};
    let finishCanceled = false;
    const cancelController = new AbortController();

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const fail = (status: number | undefined, code: string, error: string) => {
      const httpStatus = status ?? 500;
      finishStatus = "error";
      finishHttpStatus = httpStatus;
      finishErrorCode = code;
      sendSse(res, "error", { error, code, status: httpStatus, requestId });
    };

    try {
      const { prompt, provider = "grok", model: rawModel } = req.body || {};
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
      const clientNodeId = typeof req.body?.clientNodeId === "string" ? req.body.clientNodeId : null;

      if (provider !== "grok") return fail(400, "VIDEO_PROVIDER_UNSUPPORTED", "video generation requires provider 'grok'");
      if (typeof prompt !== "string" || !prompt.trim()) return fail(400, "PROMPT_REQUIRED", "Prompt is required");

      const modelCheck = normalizeGrokVideoModel(rawModel);
      if (isNormalizeError(modelCheck)) return fail(modelCheck.status, modelCheck.code, modelCheck.error);
      const durationCheck = normalizeVideoDuration(req.body?.duration);
      if (isNormalizeError(durationCheck)) return fail(durationCheck.status, durationCheck.code, durationCheck.error);
      const resolutionCheck = normalizeVideoResolution(req.body?.resolution);
      if (isNormalizeError(resolutionCheck)) return fail(resolutionCheck.status, resolutionCheck.code, resolutionCheck.error);
      const aspectCheck = normalizeVideoAspectRatio(req.body?.aspectRatio);
      if (isNormalizeError(aspectCheck)) return fail(aspectCheck.status, aspectCheck.code, aspectCheck.error);

      // Resolve reference inputs: base64 list + existing-file list + legacy single source.
      const refInputs: Array<{ image?: unknown; filename?: unknown }> = [
        ...toArray(req.body?.referenceImages).map((image) => ({ image })),
        ...toArray(req.body?.referenceFilenames).map((filename) => ({ filename })),
        ...(req.body?.sourceImage || req.body?.sourceFilename
          ? [{ image: req.body?.sourceImage, filename: req.body?.sourceFilename }]
          : []),
      ];
      let resolved: Array<{ b64: string; filename: string | null }>;
      try {
        const all = await Promise.all(
          refInputs.map(async (r) => {
            const resImg = await resolveSourceImage(ctx, r.image, r.filename);
            if (resImg.b64) {
              const normalizedB64 = await normalizeImageBase64(resImg.b64, ctx);
              return { b64: normalizedB64, filename: resImg.filename };
            }
            return { b64: null, filename: null };
          })
        );
        resolved = all.filter((r): r is { b64: string; filename: string | null } => Boolean(r.b64));
      } catch (e: any) {
        const errMsg = e instanceof Error ? e.message : "참조 이미지 데이터가 올바르지 않습니다. 보관함 이미지를 다시 저장하거나 JPG로 다시 업로드해 주세요.";
        return fail(400, "GROK_VIDEO_INVALID_IMAGE", errMsg);
      }
      if (resolved.length > MAX_REF2V_REFERENCES) return fail(400, "GROK_VIDEO_REF_TOO_MANY", `at most ${MAX_REF2V_REFERENCES} reference images`);
      const mode: VideoMode = deriveVideoMode(resolved.length);
      const duration = clampVideoDuration(durationCheck.duration, mode);
      const referenceImages = mode === "reference-to-video" ? resolved.map((r) => r.b64) : undefined;
      const sourceB64 = mode === "image-to-video" ? resolved[0]?.b64 : undefined;
      const sourceFilename = resolved[0]?.filename ?? null;

      startJob({
        requestId,
        kind: "video",
        prompt,
        meta: { kind: "video", sessionId, clientNodeId, model: modelCheck.model, mode, duration, resolution: resolutionCheck.resolution },
      });
      registerJobAbortController(requestId, cancelController);
      await mkdir(ctx.config.storage.generatedDir, { recursive: true });

      logEvent("video", "request", { requestId, mode, duration, resolution: resolutionCheck.resolution, aspectRatio: aspectCheck.aspectRatio });
      const startTime = Date.now();

      const onEvent = (ev: GrokVideoEvent) => {
        if (ev.phase === "submitted") sendSse(res, "submitted", { requestId, xaiVideoRequestId: ev.xaiVideoRequestId });
        else if (ev.phase === "progress") sendSse(res, "progress", { requestId, progress: typeof ev.progress === "number" ? ev.progress / 100 : null, stalled: Boolean(ev.stalled) });
        else sendSse(res, "planning", { requestId });
      };

      const result = await generateVideoViaGrok(prompt, ctx, {
        model: modelCheck.model,
        mode,
        duration,
        resolution: resolutionCheck.resolution,
        aspectRatio: aspectCheck.aspectRatio,
        sourceImage: sourceB64,
        referenceImages,
        signal: cancelController.signal,
        requestId,
        onEvent,
      });

      const rand = randomBytes(ctx.config.ids.generatedHexBytes).toString("hex");
      const filename = `${Date.now()}_${rand}.mp4`;
      const elapsed = +((Date.now() - startTime) / 1000).toFixed(1);
      const meta = {
        kind: "video",
        mediaType: "video",
        requestId,
        sessionId,
        clientNodeId,
        prompt,
        userPrompt: prompt,
        revisedPrompt: result.revisedPrompt,
        provider: "grok",
        model: modelCheck.model,
        createdAt: Date.now(),
        elapsed,
        usage: result.usage,
        webSearchCalls: result.webSearchCalls,
        video: {
          duration: result.duration,
          resolution: result.resolution,
          aspectRatio: result.aspectRatio,
          sourceImageFilename: sourceFilename,
          xaiVideoRequestId: result.xaiVideoRequestId,
        },
      };
      await writeFile(join(ctx.config.storage.generatedDir, filename), result.videoBuffer);
      await writeFile(join(ctx.config.storage.generatedDir, filename + ".json"), JSON.stringify(meta)).catch(() => {});
      invalidateHistoryIndex();

      finishMeta = { filename, xaiVideoRequestId: result.xaiVideoRequestId };
      logEvent("video", "saved", { requestId, filename, bytes: result.videoBuffer.length, elapsedMs: Date.now() - startTime });
      sendSse(res, "done", {
        requestId,
        filename,
        url: `/generated/${encodeURIComponent(filename)}`,
        mediaType: "video",
        revisedPrompt: result.revisedPrompt,
        elapsed,
        usage: result.usage,
        video: meta.video,
      });
    } catch (e) {
      const err = errInfo(e);
      if (isGenerationCanceledError(err.raw) || isJobCanceled(requestId)) {
        const canceled = makeGenerationCanceledError();
        finishCanceled = true;
        finishHttpStatus = canceled.status;
        finishErrorCode = canceled.code;
        sendSse(res, "error", { error: canceled.message, code: canceled.code, status: canceled.status, requestId });
      } else {
        finishStatus = "error";
        finishHttpStatus = err.status || 500;
        finishErrorCode = err.code || "GROK_VIDEO_FAILED";
        logError("video", "error", err.raw, { requestId, code: finishErrorCode });
        sendSse(res, "error", { error: err.message, code: finishErrorCode, status: finishHttpStatus, requestId });
      }
    } finally {
      finishJob(requestId, { canceled: finishCanceled, status: finishStatus, httpStatus: finishHttpStatus, errorCode: finishErrorCode, meta: finishMeta });
      res.end();
    }
  });
}
