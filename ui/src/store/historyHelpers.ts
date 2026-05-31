import type {
  Format,
  GenerateItem,
  ComposerInsertedPromptSnapshot,
} from "../types";
import type { getHistory } from "../lib/api";
import { normalizeInsertedPromptArray, type InsertedPrompt } from "./generationDefaults";

export const HISTORY_LIMIT = 500;

export function cloneInsertedPrompts(
  prompts: InsertedPrompt[],
): ComposerInsertedPromptSnapshot[] {
  return prompts.map((prompt) => ({
    id: prompt.id,
    name: prompt.name,
    text: prompt.text,
    placement: prompt.placement === "after" ? "after" : "before",
  }));
}

export function getHistoryComposerPatch(
  item: GenerateItem,
): { prompt?: string; insertedPrompts?: InsertedPrompt[] } {
  const restoredInsertedPrompts = normalizeInsertedPromptArray(item.composerInsertedPrompts);
  if (typeof item.composerPrompt === "string") {
    return {
      prompt: item.composerPrompt,
      insertedPrompts: restoredInsertedPrompts ?? [],
    };
  }
  if (restoredInsertedPrompts) return { insertedPrompts: restoredInsertedPrompts };
  return {};
}

export function narrowGenerateKind(k?: string | null): GenerateItem["kind"] {
  return k === "classic" || k === "edit" || k === "generate" ||
    k === "card-news-card" || k === "card-news-set" ? k : null;
}

export function mapHistoryItem(it: Awaited<ReturnType<typeof getHistory>>["items"][number]): GenerateItem {
  const composerInsertedPrompts = normalizeInsertedPromptArray(it.composerInsertedPrompts);
  return {
    image: it.url,
    url: it.url,
    filename: it.filename,
    thumb: it.url,
    prompt: it.prompt ?? undefined,
    userPrompt: it.userPrompt ?? null,
    revisedPrompt: it.revisedPrompt ?? null,
    promptMode: it.promptMode ?? null,
    composerPrompt: it.composerPrompt ?? null,
    composerInsertedPrompts: composerInsertedPrompts
      ? cloneInsertedPrompts(composerInsertedPrompts)
      : null,
    size: it.size ?? undefined,
    quality: it.quality ?? undefined,
    format: it.format as Format | undefined,
    model: it.model ?? undefined,
    reasoningEffort: (it.reasoningEffort as GenerateItem["reasoningEffort"]) ?? undefined,
    elapsed: it.elapsed ?? undefined,
    provider: it.provider,
    usage: (it.usage as GenerateItem["usage"]) ?? undefined,
    createdAt: it.createdAt,
    sessionId: it.sessionId ?? null,
    nodeId: it.nodeId ?? null,
    clientNodeId: it.clientNodeId ?? null,
    requestId: it.requestId ?? null,
    kind: narrowGenerateKind(it.kind),
    canvasVersion: Boolean(it.canvasVersion),
    canvasSourceFilename: it.canvasSourceFilename ?? null,
    canvasEditableFilename: it.canvasEditableFilename ?? null,
    canvasMergedAt: it.canvasMergedAt ?? undefined,
    setId: it.setId ?? null,
    cardId: it.cardId ?? null,
    cardOrder: it.cardOrder ?? null,
    headline: it.headline ?? null,
    body: it.body ?? null,
    cards: it.cards,
    refsCount: it.refsCount ?? 0,
    isFavorite: it.isFavorite ?? false,
    sequenceId: it.sequenceId ?? null,
    sequenceIndex: it.sequenceIndex ?? null,
    sequenceTotalRequested: it.sequenceTotalRequested ?? null,
    sequenceTotalReturned: it.sequenceTotalReturned ?? null,
    sequenceStatus: it.sequenceStatus ?? null,
  };
}

export function historyKey(item: Pick<GenerateItem, "filename" | "image">): string {
  return item.filename ?? item.image;
}

export function withoutHistoryDuplicate(
  history: GenerateItem[],
  item: Pick<GenerateItem, "filename" | "image">,
): GenerateItem[] {
  const key = historyKey(item);
  return history.filter((existing) => historyKey(existing) !== key);
}

export function findHistoryDuplicate(
  history: GenerateItem[],
  item: Pick<GenerateItem, "filename" | "image">,
): GenerateItem | undefined {
  const key = historyKey(item);
  return history.find((existing) => historyKey(existing) === key);
}

export function preserveHistoryMetadata(incoming: GenerateItem, existing?: GenerateItem): GenerateItem {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    createdAt: incoming.createdAt ?? existing.createdAt,
    requestId: incoming.requestId ?? existing.requestId,
    sessionId: incoming.sessionId ?? existing.sessionId,
    kind: incoming.kind ?? existing.kind,
    refsCount: incoming.refsCount ?? existing.refsCount,
    isFavorite: incoming.isFavorite ?? existing.isFavorite,
  };
}

export function mergeHistoryItems(current: GenerateItem[], incoming: GenerateItem[]): GenerateItem[] {
  const byKey = new Map(current.map((item) => [historyKey(item), item]));
  for (const item of incoming) byKey.set(historyKey(item), item);
  return [
    ...current.map((item) => byKey.get(historyKey(item)) ?? item),
    ...incoming.filter((item) => !current.some((h) => historyKey(h) === historyKey(item))),
  ];
}

export function retainHistoryItems(items: GenerateItem[], limit: number): GenerateItem[] {
  return items.slice(0, Math.max(HISTORY_LIMIT, limit));
}

export function multimodeImageKey(item: GenerateItem): string {
  return item.filename || item.image;
}

export function mergeMultimodeImages(current: GenerateItem[], incoming: GenerateItem[]): GenerateItem[] {
  const byKey = new Map(current.map((item) => [multimodeImageKey(item), item] as const));
  for (const item of incoming) byKey.set(multimodeImageKey(item), item);
  return [...byKey.values()].sort((a, b) =>
    (a.sequenceIndex ?? Number.MAX_SAFE_INTEGER) -
    (b.sequenceIndex ?? Number.MAX_SAFE_INTEGER),
  );
}
