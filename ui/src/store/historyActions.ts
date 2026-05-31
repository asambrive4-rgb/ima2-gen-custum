import type { AppState } from "./appStateTypes";
import type { GenerateItem } from "../types";
import type { GalleryShortcutAction } from "../lib/galleryShortcuts";
import type { MultimodeSequenceStatus } from "../types";

import {
  getHistory,
  deleteHistoryItem,
  restoreHistoryItem,
  permanentlyDeleteHistoryItem,
} from "../lib/api";
import { compressImage } from "../lib/image";
import {
  getNeighborAfterRemoval,
  getShortcutTarget,
  getVisibleGalleryItems,
  resolveVisibleShortcutCurrent,
} from "../lib/galleryShortcuts";
import { compareSequenceItems, getSidebarHistoryShortcutTarget } from "../lib/history/sidebarHistory";
import { resolveWorkspaceSettings } from "../lib/workspaceProfile";
import { t } from "../i18n";
import {
  HISTORY_LIMIT,
  getHistoryComposerPatch,
  findHistoryDuplicate,
  preserveHistoryMetadata,
  withoutHistoryDuplicate,
  retainHistoryItems,
  mergeHistoryItems,
} from "./historyHelpers";
import { removeImageFromMultimodeSequences, getActiveSidebarSequenceId } from "./multimodeHelpers";
import { saveSelectedFilename, loadSelectedFilename } from "./persistence";
import { importLocalImage } from "../lib/api";

// Local helper extracted from useAppStore.ts
async function addHistory(
  item: GenerateItem,
  set: any,
  get: () => AppState,
): Promise<void> {
  const thumb = await compressImage(item.image).catch(() => item.image);
  const url = item.filename ? `/generated/${item.filename}` : item.image;
  const withThumb: GenerateItem = {
    ...item,
    thumb,
    url,
    createdAt: item.createdAt || Date.now(),
  };
  const state = get();
  const existing = findHistoryDuplicate(state.history, withThumb);
  const merged = preserveHistoryMetadata(withThumb, existing);
  const historyWithoutDuplicate = withoutHistoryDuplicate(state.history, merged);
  const history = retainHistoryItems(
    [merged, ...historyWithoutDuplicate],
    state.loadedHistoryRetainLimit + 1,
  );
  saveSelectedFilename(merged.filename ?? null);
  set((s: AppState) => ({
    history,
    currentImage: merged,
    loadedHistoryRetainLimit: Math.max(
      s.loadedHistoryRetainLimit,
      Math.min(s.history.length + 1, s.loadedHistoryRetainLimit + 1),
    ),
    unseenGeneratedCount: s.unseenGeneratedCount + 1,
  }));
}

export const createHistoryActions = (
  set: any,
  get: () => AppState,
) => ({
  applyMergedCanvasImage: (item: GenerateItem) => {
    set((s: AppState) => ({
      history: item.filename
        ? s.history.some((h) => h.filename === item.filename)
          ? s.history.map((h) => (h.filename === item.filename ? item : h))
          : retainHistoryItems([item, ...s.history], s.loadedHistoryRetainLimit + 1)
        : s.history,
      loadedHistoryRetainLimit: Math.max(
        s.loadedHistoryRetainLimit,
        Math.min(s.history.length + 1, s.loadedHistoryRetainLimit + 1),
      ),
    }));
  },

  addGeneratedHistoryItem: async (item: GenerateItem) => {
    await addHistory(item, set, get);
  },

  loadOlderHistory: async () => {
    const cursor = get().historyNextCursor;
    if (!cursor || get().historyLoadingOlder) return;
    set(() => ({ historyLoadingOlder: true }));
    try {
      const res = await getHistory({ limit: HISTORY_LIMIT, cursor });
      const incoming = res.items.map((it: any) => ({
        ...it,
        image: it.image,
        filename: it.filename ?? null,
      }));
      set((s: AppState) => {
        const seen = new Set(s.history.map((item) => item.filename ?? item.image));
        const appended = incoming.filter((item) => {
          const key = item.filename ?? item.image;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return {
          history: [...s.history, ...appended],
          historyNextCursor: res.nextCursor,
          historyLoadingOlder: false,
          loadedHistoryRetainLimit: Math.max(
            s.loadedHistoryRetainLimit,
            s.history.length + appended.length,
          ),
        };
      });
    } catch {
      set(() => ({ historyLoadingOlder: false }));
      get().showToast(t("gallery.loadOlderFailed"), true);
    }
  },

  loadFavoriteHistory: async () => {
    try {
      const res = await getHistory({ limit: HISTORY_LIMIT, favoritesOnly: true });
      const incoming = res.items.map((it: any) => ({
        ...it,
        image: it.image,
        filename: it.filename ?? null,
      }));
      set((s: AppState) => {
        const history = mergeHistoryItems(s.history, incoming);
        return {
          history,
          favoriteHistoryNextCursor: res.nextCursor,
          loadedHistoryRetainLimit: Math.max(s.loadedHistoryRetainLimit, history.length),
          galleryFavorites: new Set([
            ...Array.from(s.galleryFavorites),
            ...incoming.filter((item) => item.filename).map((item) => item.filename!),
          ]),
        };
      });
    } catch {
      get().showToast(t("gallery.loadOlderFailed"), true);
    }
  },

  loadOlderFavoriteHistory: async () => {
    const cursor = get().favoriteHistoryNextCursor;
    if (!cursor || get().favoriteHistoryLoadingOlder) return;
    set(() => ({ favoriteHistoryLoadingOlder: true }));
    try {
      const res = await getHistory({ limit: HISTORY_LIMIT, cursor, favoritesOnly: true });
      const incoming = res.items.map((it: any) => ({
        ...it,
        image: it.image,
        filename: it.filename ?? null,
      }));
      set((s: AppState) => {
        const history = mergeHistoryItems(s.history, incoming);
        return {
          history,
          favoriteHistoryNextCursor: res.nextCursor,
          favoriteHistoryLoadingOlder: false,
          loadedHistoryRetainLimit: Math.max(s.loadedHistoryRetainLimit, history.length),
          galleryFavorites: new Set([
            ...Array.from(s.galleryFavorites),
            ...incoming.filter((item) => item.filename).map((item) => item.filename!),
          ]),
        };
      });
    } catch {
      set(() => ({ favoriteHistoryLoadingOlder: false }));
      get().showToast(t("gallery.loadOlderFailed"), true);
    }
  },

  selectHistory: (item: GenerateItem) => {
    const history = get().history;
    const target = item.canvasVersion
      ? resolveVisibleShortcutCurrent(history, item) ?? getVisibleGalleryItems(history)[0] ?? null
      : resolveVisibleShortcutCurrent(history, item) ?? item;
    saveSelectedFilename(target?.filename ?? null);
    const shouldRestoreComposer = resolveWorkspaceSettings(get().workspaceProfile).restoreComposerFromHistory;
    const currentPrompt = get().prompt;
    const currentInserted = get().insertedPrompts;
    const isComposerDirty = currentPrompt.trim() !== "" || currentInserted.length > 0;
    const composerPatch =
      shouldRestoreComposer && target && !isComposerDirty
        ? getHistoryComposerPatch(target)
        : {};
    set(() => ({
      currentImage: target,
      unseenGeneratedCount: 0,
      multimodePreviewFlightId: null,
      ...composerPatch,
    }));
  },

  showHistorySequence: (sequenceId: string) => {
    const items = get().history
      .filter((item) => item.sequenceId === sequenceId && !item.canvasVersion)
      .sort(compareSequenceItems);
    if (items.length === 0) return;
    const previewId = `history:${sequenceId}`;
    const requested = Math.max(
      items.length,
      ...items.map((item) => item.sequenceTotalRequested ?? 0),
    );
    const returned = items.length;
    const status: MultimodeSequenceStatus =
      items[0]?.sequenceStatus === "empty"
        ? "empty"
        : returned >= requested
          ? "complete"
          : "partial";
    saveSelectedFilename(null);
    set((state: AppState) => ({
      currentImage: null,
      unseenGeneratedCount: 0,
      canvasOpen: false,
      multimodePreviewFlightId: previewId,
      multimodeSequences: {
        ...state.multimodeSequences,
        [previewId]: {
          sequenceId,
          requestId: previewId,
          requested,
          returned,
          images: items,
          partials: [],
          status,
        },
      },
    }));
  },

  markGeneratedResultsSeen: () => {
    set(() => ({ unseenGeneratedCount: 0 }));
  },

  selectHistoryShortcutTarget: (action: GalleryShortcutAction) => {
    const state = get();
    const workspaceSettings = resolveWorkspaceSettings(state.workspaceProfile);
    if (state.uiMode === "classic" && workspaceSettings.multimodeHistoryGrouping === "sequence") {
      const target = getSidebarHistoryShortcutTarget(
        state.history,
        state.currentImage,
        action,
        getActiveSidebarSequenceId(state),
      );
      if (!target) return;
      if (target.type === "sequence") {
        get().showHistorySequence(target.sequenceId);
        return;
      }
      get().selectHistory(target.item);
      return;
    }
    const target = getShortcutTarget(state.history, state.currentImage, action);
    if (!target) return;
    get().selectHistory(target);
  },

  trashHistoryItem: async (item: GenerateItem) => {
    const target = item.canvasVersion ? resolveVisibleShortcutCurrent(get().history, item) : item;
    if (!target || target.canvasVersion || !target.filename) {
      get().showToast(t("gallery.deleteFailed"), true);
      return;
    }
    const filename = target.filename;
    const current = get().currentImage;
    const visibleCurrent = current ? resolveVisibleShortcutCurrent(get().history, current) ?? current : null;
    const removingCurrent = visibleCurrent?.filename === filename;
    const replacement = removingCurrent
      ? getNeighborAfterRemoval(get().history, filename)
      : current;
    try {
      await deleteHistoryItem(filename);
      set((s: AppState) => {
        const multimodeSequences = removeImageFromMultimodeSequences(s.multimodeSequences, filename);
        const multimodePreviewFlightId =
          s.multimodePreviewFlightId && !multimodeSequences[s.multimodePreviewFlightId]
            ? null
            : s.multimodePreviewFlightId;
        return {
          history: s.history.filter((h) => h.filename !== filename),
          currentImage: replacement,
          multimodePreviewFlightId,
          multimodeSequences,
          trashPending: null,
        };
      });
      if (removingCurrent) saveSelectedFilename(replacement?.filename ?? null);
      get().showToast(t("gallery.movedToSystemTrash", { filename }));
    } catch (err) {
      console.error("[history] trash failed", err);
      get().showToast(t("gallery.deleteFailed"), true);
    }
  },

  trashHistorySequence: async (sequenceId: string) => {
    const targets = get().history.filter((item) =>
      item.sequenceId === sequenceId && !item.canvasVersion && Boolean(item.filename),
    );
    if (targets.length === 0) {
      get().showToast(t("gallery.deleteFailed"), true);
      return;
    }
    const ok = window.confirm(t("history.deleteSequenceConfirm", { count: targets.length }));
    if (!ok) return;
    const filenames = new Set(
      targets.map((item) => item.filename).filter((filename): filename is string => Boolean(filename)),
    );
    const current = get().currentImage;
    const removingCurrent = Boolean(current?.filename && filenames.has(current.filename));
    const removingPreview =
      get().multimodePreviewFlightId === `history:${sequenceId}` ||
      get().multimodePreviewFlightId === sequenceId;
    try {
      for (const filename of filenames) {
        await deleteHistoryItem(filename);
      }
      set((state: AppState) => {
        const nextSequences = { ...state.multimodeSequences };
        delete nextSequences[`history:${sequenceId}`];
        delete nextSequences[sequenceId];
        return {
          history: state.history.filter((item) => !item.filename || !filenames.has(item.filename)),
          currentImage: removingCurrent ? null : state.currentImage,
          multimodePreviewFlightId: removingPreview ? null : state.multimodePreviewFlightId,
          multimodeSequences: nextSequences,
          trashPending: null,
        };
      });
      if (removingCurrent) saveSelectedFilename(null);
      get().showToast(t("history.sequenceDeleted", { count: filenames.size }));
    } catch (err) {
      console.error("[history] sequence trash failed", err);
      get().showToast(t("gallery.deleteFailed"), true);
    }
  },

  restorePendingTrash: async () => {
    const pending = get().trashPending;
    if (!pending) return;
    try {
      await restoreHistoryItem(pending.filename, pending.trashId);
      get().addHistoryItem(pending.item);
      set(() => ({ trashPending: null }));
    } catch (err) {
      console.error("[history] restore failed", err);
      get().showToast(t("gallery.restoreFailed"), true);
    }
  },

  clearPendingTrash: () => {
    set(() => ({ trashPending: null }));
  },

  permanentlyDeleteHistoryItemByClick: async (item: GenerateItem) => {
    await get().permanentlyDeleteHistoryItemByShortcut(item);
  },

  permanentlyDeleteHistoryItemByShortcut: async (item: GenerateItem) => {
    const target = item.canvasVersion ? resolveVisibleShortcutCurrent(get().history, item) : item;
    if (!target || target.canvasVersion || !target.filename) {
      get().showToast(t("gallery.deleteFailed"), true);
      return;
    }
    const filename = target.filename;
    const ok = window.confirm(t("result.permanentDeleteConfirm", { filename }));
    if (!ok) return;
    const current = get().currentImage;
    const visibleCurrent = current ? resolveVisibleShortcutCurrent(get().history, current) ?? current : null;
    const removingCurrent = visibleCurrent?.filename === filename;
    const replacement = removingCurrent
      ? getNeighborAfterRemoval(get().history, filename)
      : current;
    try {
      await permanentlyDeleteHistoryItem(filename);
      set((s: AppState) => ({
        history: s.history.filter((h) => h.filename !== filename),
        currentImage: replacement,
        trashPending:
          s.trashPending?.filename === filename ? null : s.trashPending,
      }));
      if (removingCurrent) saveSelectedFilename(replacement?.filename ?? null);
      get().showToast(t("gallery.permanentDeleted", { filename }));
    } catch (err) {
      console.error("[history] permanent delete failed", err);
      get().showToast(t("gallery.deleteFailed"), true);
    }
  },

  removeFromHistory: (filename: string) => {
    const s = get();
    const history = s.history.filter((h) => h.filename !== filename);
    const stillCurrent =
      s.currentImage && s.currentImage.filename === filename ? null : s.currentImage;
    set(() => ({ history, currentImage: stillCurrent }));
    if (stillCurrent === null) saveSelectedFilename(null);
  },

  addHistoryItem: (item: GenerateItem) => {
    const s = get();
    const withDefaults: GenerateItem = {
      ...item,
      createdAt: item.createdAt || Date.now(),
    };
    const existing = findHistoryDuplicate(s.history, withDefaults);
    const merged = preserveHistoryMetadata(withDefaults, existing);
    const historyWithoutDuplicate = withoutHistoryDuplicate(s.history, merged);
    set((state: AppState) => ({
      history: retainHistoryItems([merged, ...historyWithoutDuplicate], state.loadedHistoryRetainLimit + 1),
      loadedHistoryRetainLimit: Math.max(
        state.loadedHistoryRetainLimit,
        Math.min(state.history.length + 1, state.loadedHistoryRetainLimit + 1),
      ),
    }));
  },

  importLocalImageToHistory: async (file: File) => {
    if (!file.type || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      get().showToast(t("toast.localImportInvalid"), true);
      return null;
    }
    try {
      const item = await importLocalImage(file);
      get().addHistoryItem(item);
      set(() => ({ currentImage: item, unseenGeneratedCount: 0 }));
      if (item.filename) saveSelectedFilename(item.filename);
      get().showToast(t("toast.localImportSuccess"));
      return item;
    } catch {
      get().showToast(t("toast.localImportFailed"), true);
      return null;
    }
  },

  hydrateHistory: () => {
    void (async () => {
      try {
        const res = await getHistory({ limit: HISTORY_LIMIT });
        const history: GenerateItem[] = res.items.map((it: any) => ({
          ...it,
          image: it.image,
          filename: it.filename ?? null,
        }));
        set(() => ({ historyNextCursor: res.nextCursor, loadedHistoryRetainLimit: HISTORY_LIMIT }));
        if (history.length > 0) {
          const selected = loadSelectedFilename();
          const matched = selected
            ? history.find((it) => it.filename === selected)
            : null;
          const visibleHistory = getVisibleGalleryItems(history);
          const currentImage =
            (matched ? resolveVisibleShortcutCurrent(history, matched) : null) ??
            visibleHistory[0] ??
            null;
          set(() => ({
            history,
            currentImage,
            historyNextCursor: res.nextCursor,
            loadedHistoryRetainLimit: Math.max(HISTORY_LIMIT, history.length),
          }));
          if (currentImage?.filename !== selected) {
            saveSelectedFilename(currentImage?.filename ?? null);
          }
        }
      } catch (err) {
        console.warn("[history] load failed:", err);
      }
    })();
  },
});
