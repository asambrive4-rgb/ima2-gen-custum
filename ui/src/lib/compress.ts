// ui/src/lib/compress.ts – reference-image pre-upload adaptive compression.
//
// Responsibility: accept a raw File from drag/paste/picker and return a
// base64 data URL whose length is under maximum byte budget, optimized for
// device stability (Desktop vs Mobile/Tablet).

export interface CompressOptions {
  /** Hard cap on output base64 length. */
  maxB64Bytes?: number;
  /** If true, keep PNG encoding (useful for transparent references). */
  preserveTransparency?: boolean;
  /** Longest edge in pixels. */
  maxEdge?: number;
  /** Quality ladder tried in order. Default [0.95, 0.9, 0.85, 0.75, 0.65]. */
  qualityLadder?: number[];
  /** If true, force JPEG re-encoding for video media reference stability. */
  isVideoMode?: boolean;
}

const QUALITY_LADDER_DEFAULT = [0.95, 0.9, 0.85, 0.75, 0.65];

function isMobileOrTablet(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  const isUAMobileTablet = /Android|iPhone|iPad|iPod|Windows Phone|webOS|Tablet/i.test(ua);
  const isMaciPad = ua.includes("Macintosh") && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
  const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || false;
  const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  
  return isUAMobileTablet || isMaciPad || hasTouch || isCoarsePointer;
}

interface DeviceLimits {
  maxB64Bytes: number;
  maxEdge: number;
  maxCanvasPixels: number;
}

function getDeviceLimits(): DeviceLimits {
  if (isMobileOrTablet()) {
    return {
      maxB64Bytes: 10_000_000,    // 10MB
      maxEdge: 4096,
      maxCanvasPixels: 16_777_216 // 16.7M pixels (e.g. 4096 x 4096)
    };
  }
  return {
    maxB64Bytes: 15_000_000,    // 15MB
    maxEdge: 6144,
    maxCanvasPixels: 33_554_432 // 33.5M pixels (e.g. 5760 x 5760 or similar)
  };
}

function clampDimensions(
  w: number,
  h: number,
  maxEdge: number,
  maxCanvasPixels: number
): { w: number; h: number } {
  let width = w;
  let height = h;
  if (width <= 0 || height <= 0) return { w: 1, h: 1 };
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const scale = maxEdge / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  if (width * height > maxCanvasPixels) {
    const scale = Math.sqrt(maxCanvasPixels / (width * height));
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
  }
  return { w: width, h: height };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      if (typeof fr.result === "string") resolve(fr.result);
      else reject(new Error("FileReader returned non-string"));
    };
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error("태블릿 브라우저에서 이미지가 너무 커서 처리하지 못했습니다. JPG로 변환하거나 해상도를 낮춰 다시 시도해 주세요."));
          }
        },
        type,
        quality,
      );
    } catch (err) {
      reject(new Error("태블릿 브라우저에서 이미지가 너무 커서 처리하지 못했습니다. JPG로 변환하거나 해상도를 낮춰 다시 시도해 주세요.", { cause: err }));
    }
  });
}

function b64LengthOfDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  return i < 0 ? dataUrl.length : dataUrl.length - i - 1;
}

function decodeWithHTMLImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error("태블릿 브라우저에서 이미지가 너무 커서 처리하지 못했습니다. JPG로 변환하거나 해상도를 낮춰 다시 시도해 주세요.", { cause: err }));
    };
    img.src = url;
  });
}

export async function compressToBase64(file: File, opts: CompressOptions = {}): Promise<string> {
  const limits = getDeviceLimits();
  const maxB64Bytes = opts.maxB64Bytes ?? limits.maxB64Bytes;
  const maxEdge = opts.maxEdge ?? limits.maxEdge;
  const qualityLadder = opts.qualityLadder ?? QUALITY_LADDER_DEFAULT;
  
  // Under video mode, we prioritize upload stability and do not preserve transparency (forces JPEG)
  const isVideoMode = opts.isVideoMode || false;
  const preserveTransparency = isVideoMode ? false : (opts.preserveTransparency ?? false);

  // Fast path: if already small enough and re-encode is not forced, reuse original bytes
  const rawDataUrl = await blobToDataUrl(file);
  if (b64LengthOfDataUrl(rawDataUrl) <= maxB64Bytes && !isVideoMode) {
    return rawDataUrl;
  }

  let source: ImageBitmap | HTMLImageElement;
  let isBitmap = false;

  try {
    source = await createImageBitmap(file);
    isBitmap = true;
  } catch (err) {
    try {
      // Fallback decoding path for Edge/Safari touch browsers when createImageBitmap fails
      source = await decodeWithHTMLImageElement(file);
    } catch (fallbackErr) {
      throw new Error("태블릿 브라우저에서 이미지가 너무 커서 처리하지 못했습니다. JPG로 변환하거나 해상도를 낮춰 다시 시도해 주세요.", { cause: fallbackErr });
    }
  }

  try {
    const width = isBitmap ? (source as ImageBitmap).width : (source as HTMLImageElement).naturalWidth;
    const height = isBitmap ? (source as ImageBitmap).height : (source as HTMLImageElement).naturalHeight;

    const { w, h } = clampDimensions(width, height, maxEdge, limits.maxCanvasPixels);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(source, 0, 0, w, h);

    if (preserveTransparency) {
      const blob = await canvasToBlob(canvas, "image/png");
      const dataUrl = await blobToDataUrl(blob);
      if (b64LengthOfDataUrl(dataUrl) > maxB64Bytes) {
        throw new Error("태블릿 브라우저에서 이미지가 너무 커서 처리하지 못했습니다. JPG로 변환하거나 해상도를 낮춰 다시 시도해 주세요.");
      }
      return dataUrl;
    }

    for (const q of qualityLadder) {
      const blob = await canvasToBlob(canvas, "image/jpeg", q);
      const dataUrl = await blobToDataUrl(blob);
      if (b64LengthOfDataUrl(dataUrl) <= maxB64Bytes) {
        return dataUrl;
      }
    }
    throw new Error("태블릿 브라우저에서 이미지가 너무 커서 처리하지 못했습니다. JPG로 변환하거나 해상도를 낮춰 다시 시도해 주세요.");
  } finally {
    if (isBitmap && source && "close" in source) {
      (source as ImageBitmap).close?.();
    }
  }
}

export function isHeic(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return true;
  const n = (file.name || "").toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

export function hasAlphaChannel(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  return t === "image/png";
}
