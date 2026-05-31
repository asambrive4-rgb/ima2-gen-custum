import type {
  Count,
  Format,
  Moderation,
  Provider,
  Quality,
  SizePreset,
} from "../types";
import { parseRequestedCustomSide } from "../lib/size";
import { GENERATION_DEFAULTS_STORAGE_KEY } from "./persistenceRegistry";

export type InsertedPrompt = {
  id: string;
  name: string;
  text: string;
  placement?: "before" | "after";
};

export type GenerationDefaults = Partial<{
  provider: Provider;
  quality: Quality;
  sizePreset: SizePreset;
  customW: number;
  customH: number;
  format: Format;
  moderation: Moderation;
  count: Count;
  multimode: boolean;
  multimodeMaxImages: Count;
  promptMode: "auto" | "direct";
  prompt: string;
  insertedPrompts: InsertedPrompt[];
}>;

export function normalizeCount(value: number): Count {
  return Math.min(8, Math.max(1, Math.trunc(value || 1))) as Count;
}

export const SIZE_PRESET_VALUES = new Set<SizePreset>([
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "1360x1024",
  "1024x1360",
  "1824x1024",
  "1024x1824",
  "2048x2048",
  "2048x1152",
  "1152x2048",
  "3840x2160",
  "2160x3840",
  "auto",
  "custom",
]);

export function parseMetadataSize(size?: string | null): { preset?: SizePreset; w?: number; h?: number } {
  if (typeof size !== "string") return {};
  if (SIZE_PRESET_VALUES.has(size as SizePreset)) return { preset: size as SizePreset };
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return {};
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return {};
  return { preset: "custom", w, h };
}

export function isQuality(value: unknown): value is Quality {
  return value === "low" || value === "medium" || value === "high";
}

export function isFormat(value: unknown): value is Format {
  return value === "png" || value === "jpeg" || value === "webp";
}

export function isModeration(value: unknown): value is Moderation {
  return value === "low" || value === "auto";
}

export function isProvider(value: unknown): value is Provider {
  return value === "oauth" || value === "api" || value === "grok";
}

export function isPromptMode(value: unknown): value is "auto" | "direct" {
  return value === "auto" || value === "direct";
}

export function isSizePreset(value: unknown): value is SizePreset {
  return typeof value === "string" && SIZE_PRESET_VALUES.has(value as SizePreset);
}

export function composePrompt(mainPrompt: string, insertedPrompts: InsertedPrompt[]): string {
  const before = insertedPrompts.filter((prompt) => prompt.placement !== "after");
  const after = insertedPrompts.filter((prompt) => prompt.placement === "after");
  return [
    ...before.map((prompt) => prompt.text.trim()).filter(Boolean),
    mainPrompt.trim(),
    ...after.map((prompt) => prompt.text.trim()).filter(Boolean),
  ].filter(Boolean).join("\n\n");
}

export function normalizeInsertedPrompt(value: unknown): InsertedPrompt | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.text !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    name: item.name,
    text: item.text,
    placement: item.placement === "after" ? "after" : "before",
  };
}

export function normalizeInsertedPromptArray(value: unknown): InsertedPrompt[] | null {
  if (!Array.isArray(value)) return null;
  const prompts = value.map(normalizeInsertedPrompt);
  return prompts.every((item): item is InsertedPrompt => item !== null) ? prompts : null;
}

export function loadGenerationDefaults(): GenerationDefaults {
  try {
    const raw = localStorage.getItem(GENERATION_DEFAULTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: GenerationDefaults = {};
    if (isProvider(parsed.provider)) out.provider = parsed.provider;
    if (isQuality(parsed.quality)) out.quality = parsed.quality;
    if (isSizePreset(parsed.sizePreset)) out.sizePreset = parsed.sizePreset;
    if (typeof parsed.customW === "number" && Number.isFinite(parsed.customW)) {
      out.customW = parseRequestedCustomSide(parsed.customW, 1920);
    }
    if (typeof parsed.customH === "number" && Number.isFinite(parsed.customH)) {
      out.customH = parseRequestedCustomSide(parsed.customH, 1088);
    }
    if (isFormat(parsed.format)) out.format = parsed.format;
    if (isModeration(parsed.moderation)) out.moderation = parsed.moderation;
    if (typeof parsed.count === "number") out.count = normalizeCount(parsed.count);
    if (typeof parsed.multimode === "boolean") out.multimode = parsed.multimode;
    if (typeof parsed.multimodeMaxImages === "number") {
      out.multimodeMaxImages = normalizeCount(parsed.multimodeMaxImages);
    }
    if (isPromptMode(parsed.promptMode)) out.promptMode = parsed.promptMode;
    if (typeof parsed.prompt === "string") out.prompt = parsed.prompt;
    const insertedPrompts = normalizeInsertedPromptArray(parsed.insertedPrompts);
    if (insertedPrompts) out.insertedPrompts = insertedPrompts;
    return out;
  } catch {
    return {};
  }
}

export function saveGenerationDefaultsPatch(patch: GenerationDefaults): void {
  try {
    const current = loadGenerationDefaults();
    localStorage.setItem(
      GENERATION_DEFAULTS_STORAGE_KEY,
      JSON.stringify({ ...current, ...patch }),
    );
  } catch {}
}
