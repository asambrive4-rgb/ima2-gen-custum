import type { AppState } from "./appStateTypes";

export const selectGenerationControls = (s: AppState) => ({
  provider: s.provider,
  quality: s.quality,
  sizePreset: s.sizePreset,
  customW: s.customW,
  customH: s.customH,
  format: s.format,
  moderation: s.moderation,
  imageModel: s.imageModel,
  reasoningEffort: s.reasoningEffort,
  webSearchEnabled: s.webSearchEnabled,
  count: s.count,
  setProvider: s.setProvider,
  setQuality: s.setQuality,
  setSizePreset: s.setSizePreset,
  setCustomSize: s.setCustomSize,
  setFormat: s.setFormat,
  setModeration: s.setModeration,
  setImageModel: s.setImageModel,
  setReasoningEffort: s.setReasoningEffort,
  setWebSearchEnabled: s.setWebSearchEnabled,
  setCount: s.setCount,
});

export const selectReferenceImages = (s: AppState) => ({
  referenceImages: s.referenceImages,
  canvasReferenceImage: s.canvasReferenceImage,
  addReferences: s.addReferences,
  addReferenceDataUrl: s.addReferenceDataUrl,
  removeReference: s.removeReference,
  clearReferences: s.clearReferences,
});

export const selectCurrentImage = (s: AppState) => s.currentImage;

export const selectGalleryState = (s: AppState) => ({
  galleryOpen: s.galleryOpen,
  galleryScope: s.galleryScope,
  setGalleryScope: s.setGalleryScope,
  toggleGalleryFavorite: s.toggleGalleryFavorite,
});

export const selectInflightSummary = (s: AppState) => ({
  activeGenerations: s.activeGenerations,
  unseenGeneratedCount: s.unseenGeneratedCount,
  inFlight: s.inFlight,
  cancelInFlightJob: s.cancelInFlightJob,
});

export const selectThemeState = (s: AppState) => ({
  theme: s.theme,
  resolvedTheme: s.resolvedTheme,
  themeFamily: s.themeFamily,
  setTheme: s.setTheme,
});

export const selectPromptComposerState = (s: AppState) => ({
  prompt: s.prompt,
  setPrompt: s.setPrompt,
  insertedPrompts: s.insertedPrompts,
  insertPromptToComposer: s.insertPromptToComposer,
  removeInsertedPromptFromComposer: s.removeInsertedPromptFromComposer,
  clearInsertedPrompts: s.clearInsertedPrompts,
});

export const selectNodeGraphState = (s: AppState) => ({
  graphNodes: s.graphNodes,
  graphEdges: s.graphEdges,
  nodeSelectionMode: s.nodeSelectionMode,
  nodeBatchRunning: s.nodeBatchRunning,
  selectNodeGraph: s.selectNodeGraph,
  clearNodeSelection: s.clearNodeSelection,
});

export const selectHistoryState = (s: AppState) => ({
  history: s.history,
  currentImage: s.currentImage,
  loadedHistoryRetainLimit: s.loadedHistoryRetainLimit,
});

export const selectHistoryPaginationState = (s: AppState) => ({
  historyNextCursor: s.historyNextCursor,
  historyLoadingOlder: s.historyLoadingOlder,
  favoriteHistoryNextCursor: s.favoriteHistoryNextCursor,
  favoriteHistoryLoadingOlder: s.favoriteHistoryLoadingOlder,
});

export const selectGalleryOpenState = (s: AppState) => s.galleryOpen;

export const selectGalleryItems = (s: AppState) => ({
  history: s.history,
  galleryFavorites: s.galleryFavorites,
  galleryScope: s.galleryScope,
  activeSessionId: s.activeSessionId,
});

export const selectCanvasViewport = (s: AppState) => ({
  canvasOpen: s.canvasOpen,
  canvasZoom: s.canvasZoom,
  canvasPanX: s.canvasPanX,
  canvasPanY: s.canvasPanY,
  setCanvasZoom: s.setCanvasZoom,
  setCanvasPan: s.setCanvasPan,
});

export const selectSettingsModalState = (s: AppState) => ({
  settingsOpen: s.settingsOpen,
  activeSettingsSection: s.activeSettingsSection,
  openSettings: s.openSettings,
  closeSettings: s.closeSettings,
});

export const selectToastState = (s: AppState) => ({
  toast: s.toast,
  toastLog: s.toastLog,
  dismissToast: s.dismissToast,
});
