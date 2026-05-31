import type { CanvasExportBackground, HexColor } from "../types/canvas";
import type {
  Count,
  Format,
  GenerateItem,
  HistoryStripLayout,
  ImageModel,
  Moderation,
  Provider,
  Quality,
  ResolvedTheme,
  SettingsSection,
  SizePreset,
  ThemeFamily,
  ThemePreference,
  UIMode,
  VideoResolutionUI,
} from "../types";
import type { HistoryCursor, SessionSummary } from "../lib/api";
import type { ReasoningEffort } from "../lib/reasoning";
import type { ClientNodeId } from "../lib/graph";
import type { NodeBatchMode } from "../lib/nodeBatch";
import type { Locale } from "../i18n";
import type { ImaErrorCode } from "../lib/errorCodes";
import type { GalleryShortcutAction } from "../lib/galleryShortcuts";
import type { GraphNode, GraphEdge, GraphSaveReason } from "./graphTypes";
import type { MultimodeSequenceState } from "./multimodeTypes";
import type {
  ToastEntry,
  ToastState,
  ErrorCardEntry,
  ComposeSheetTab,
  TrashPendingState,
  CustomSizeConfirmState,
  MetadataRestoreState,
} from "./uiTypes";
import type { PersistedInFlight } from "./inflightHelpers";
import type { InsertedPrompt } from "./generationDefaults";
import type { GalleryScope } from "./useAppStore";

export interface GenerationState {
  provider: Provider;
  quality: Quality;
  sizePreset: SizePreset;
  customW: number;
  customH: number;
  format: Format;
  moderation: Moderation;
  imageModel: ImageModel;
  reasoningEffort: ReasoningEffort;
  webSearchEnabled: boolean;
  count: Count;
  multimode: boolean;
  multimodeMaxImages: Count;
  multimodeSequences: Record<string, MultimodeSequenceState>;
  multimodeAbortControllers: Record<string, AbortController>;
  multimodePreviewFlightId: string | null;
  promptMode: "auto" | "direct";
  prompt: string;
  setProvider: (p: Provider) => void;
  setQuality: (q: Quality) => void;
  setSizePreset: (s: SizePreset) => void;
  setCustomSize: (w: number, h: number) => void;
  setFormat: (f: Format) => void;
  setModeration: (m: Moderation) => void;
  setImageModel: (m: ImageModel) => void;
  setReasoningEffort: (e: ReasoningEffort) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  setCount: (c: Count) => void;
  setMultimode: (enabled: boolean) => void;
  setMultimodeMaxImages: (c: Count) => void;
  generateMultimode: (sizeOverride?: string) => Promise<void>;
  cancelMultimode: () => void;
  setPromptMode: (m: "auto" | "direct") => void;
  setPrompt: (p: string) => void;
  insertedPrompts: InsertedPrompt[];
  insertPromptToComposer: (prompt: InsertedPrompt) => void;
  removeInsertedPromptFromComposer: (id: string) => void;
  moveInsertedPromptInComposer: (id: string, direction: "up" | "down") => void;
  clearInsertedPrompts: () => void;
  generate: () => Promise<void>;
  runGenerate: (sizeOverride?: string) => Promise<void>;
  confirmCustomSizeAdjustment: () => Promise<void>;
  cancelCustomSizeAdjustment: () => void;
  getResolvedSize: () => string;
}

export interface ReferenceState {
  referenceImages: string[];
  canvasReferenceImage: string | null;
  addReferences: (files: File[]) => Promise<void>;
  addReferenceDataUrl: (dataUrl: string) => void;
  removeReference: (index: number) => void;
  clearReferences: () => void;
  useCurrentAsReference: () => Promise<void>;
  useImageAsReference: (item: GenerateItem) => Promise<void>;
  attachCanvasVersionReference: (item: GenerateItem) => Promise<void>;
}

export interface InflightState {
  activeGenerations: number;
  unseenGeneratedCount: number;
  inFlight: PersistedInFlight[];
  cancelInFlightJob: (requestId: string) => Promise<void>;
  startInFlightPolling: () => void;
  reconcileInflight: () => Promise<void>;
  reconcileGraphPending: () => Promise<void>;
  syncFromStorage: () => void;
}

export interface HistoryState {
  currentImage: GenerateItem | null;
  applyMergedCanvasImage: (item: GenerateItem) => void;
  addGeneratedHistoryItem: (item: GenerateItem) => Promise<void>;
  history: GenerateItem[];
  historyNextCursor: HistoryCursor | null;
  historyLoadingOlder: boolean;
  favoriteHistoryNextCursor: HistoryCursor | null;
  favoriteHistoryLoadingOlder: boolean;
  loadedHistoryRetainLimit: number;
  loadOlderHistory: () => Promise<void>;
  loadFavoriteHistory: () => Promise<void>;
  loadOlderFavoriteHistory: () => Promise<void>;
  selectHistory: (item: GenerateItem) => void;
  showHistorySequence: (sequenceId: string) => void;
  markGeneratedResultsSeen: () => void;
  selectHistoryShortcutTarget: (action: GalleryShortcutAction) => void;
  trashHistoryItem: (item: GenerateItem) => Promise<void>;
  trashHistorySequence: (sequenceId: string) => Promise<void>;
  restorePendingTrash: () => Promise<void>;
  clearPendingTrash: () => void;
  permanentlyDeleteHistoryItemByClick: (item: GenerateItem) => Promise<void>;
  permanentlyDeleteHistoryItemByShortcut: (item: GenerateItem) => Promise<void>;
  removeFromHistory: (filename: string) => void;
  addHistoryItem: (item: GenerateItem) => void;
  importLocalImageToHistory: (file: File) => Promise<GenerateItem | null>;
  hydrateHistory: () => void;
}

export interface GalleryState {
  galleryOpen: boolean;
  openGallery: () => void;
  closeGallery: () => void;
  galleryScope: GalleryScope;
  galleryDefaultScope: GalleryScope;
  setGalleryScope: (scope: GalleryScope) => void;
  setGalleryDefaultScope: (scope: GalleryScope) => void;
  galleryFavorites: Set<string>;
  toggleGalleryFavorite: (filename: string) => Promise<void>;
}

export interface SettingsState {
  settingsOpen: boolean;
  activeSettingsSection: SettingsSection;
  readinessPopupOpen: boolean;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  setActiveSettingsSection: (section: SettingsSection) => void;
  openReadinessPopup: () => void;
  closeReadinessPopup: () => void;
  uiMode: UIMode;
  setUIMode: (m: UIMode) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  workspaceProfile: import("../lib/workspaceProfile").WorkspaceProfile;
  setWorkspaceProfile: (profile: import("../lib/workspaceProfile").WorkspaceProfile) => void;
  browserId: string;
}

export interface ThemeState {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  themeFamily: ThemeFamily;
  historyStripLayout: HistoryStripLayout;
  setTheme: (theme: ThemePreference) => void;
  setThemeFamily: (family: ThemeFamily) => void;
  setHistoryStripLayout: (layout: HistoryStripLayout) => void;
  syncThemeFromStorage: () => void;
  syncThemeFamilyFromStorage: () => void;
  refreshResolvedTheme: () => void;
}

export interface PromptLibraryState {
  promptBuilderOpen: boolean;
  togglePromptBuilder: () => void;
  promptLibraryOpen: boolean;
  setPromptLibraryOpen: (open: boolean) => void;
  togglePromptLibrary: () => void;
  promptLibrary: { prompts: import("../lib/api").PromptItem[]; folders: import("../lib/api").PromptFolder[] };
  promptLibraryLoading: boolean;
  loadPromptLibrary: () => Promise<void>;
  savePromptToLibrary: (payload: { name?: string; text: string; tags?: string[]; folderId?: string; mode?: "auto" | "direct" }) => Promise<void>;
  deletePromptFromLibrary: (id: string) => Promise<void>;
  togglePromptFavorite: (id: string) => Promise<void>;
  importPromptsToLibrary: (files: File[]) => Promise<void>;
}

export interface CanvasState {
  canvasOpen: boolean;
  canvasZoom: number;
  canvasPanX: number;
  canvasPanY: number;
  canvasExportBackground: CanvasExportBackground;
  canvasExportMatteColor: HexColor;
  openCanvas: () => void;
  closeCanvas: () => void;
  setCanvasZoom: (zoom: number) => void;
  resetCanvasZoom: () => void;
  setCanvasPan: (x: number, y: number) => void;
  resetCanvasPan: () => void;
  setCanvasExportBackground: (mode: CanvasExportBackground) => void;
  setCanvasExportMatteColor: (color: HexColor) => void;
  referenceLibraryItems: import("../lib/api").ReferenceLibraryItem[];
  referenceLibraryLoading: boolean;
  loadReferenceLibrary: () => Promise<void>;
  addLibraryItemAsReference: (item: import("../lib/api").ReferenceLibraryItem) => Promise<void>;
  deleteLibraryItem: (id: string) => Promise<void>;
  clearReferenceLibrary: () => Promise<void>;
  referenceLibraryUploading: boolean;
  uploadLibraryImage: (file: File, autoUse: boolean) => Promise<void>;
}

export interface VideoState {
  videoModelSelected: string | false;
  videoDuration: number;
  videoResolution: VideoResolutionUI;
  videoAspectRatio: string;
  videoProgress: number | null;
  selectVideoModel: (model?: string) => void;
  setVideoDuration: (n: number) => void;
  setVideoResolution: (r: VideoResolutionUI) => void;
  setVideoAspectRatio: (a: string) => void;
  activeVideoRefCount: () => number;
  runVideoGenerate: (nodeId?: string) => Promise<void>;
  animateImage: (filename: string, prompt?: string) => Promise<void>;
}

export interface GraphState {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  setGraphNodes: (n: GraphNode[]) => void;
  setGraphEdges: (e: GraphEdge[]) => void;
  nodeSelectionMode: boolean;
  nodeBatchRunning: boolean;
  nodeBatchStopping: boolean;
  toggleNodeSelectionMode: () => void;
  selectAllGraphNodes: () => void;
  selectNodeGraph: (clientId: ClientNodeId, additive: boolean) => void;
  clearNodeSelection: () => void;
  runNodeBatch: (mode: NodeBatchMode) => Promise<void>;
  cancelNodeBatch: () => void;
  addRootNode: () => ClientNodeId;
  createRootNodeFromHistoryItem: (item: GenerateItem) => ClientNodeId;
  addChildNode: (parentClientId: ClientNodeId) => ClientNodeId;
  addSiblingNode: (sourceClientId: ClientNodeId) => ClientNodeId;
  duplicateBranchRoot: (sourceClientId: ClientNodeId) => ClientNodeId;
  addChildNodeAt: (
    parentClientId: ClientNodeId,
    position: { x: number; y: number },
    sourceHandle?: string | null,
  ) => ClientNodeId;
  connectNodes: (
    sourceClientId: ClientNodeId,
    targetClientId: ClientNodeId,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ) => void;
  updateNodePrompt: (clientId: ClientNodeId, prompt: string) => void;
  addNodeReferences: (clientId: ClientNodeId, files: File[]) => Promise<void>;
  addNodeReferenceDataUrl: (clientId: ClientNodeId, dataUrl: string) => void;
  removeNodeReference: (clientId: ClientNodeId, index: number) => void;
  clearNodeReferences: (clientId: ClientNodeId) => void;
  generateNode: (clientId: ClientNodeId) => Promise<void>;
  generateNodeInPlace: (clientId: ClientNodeId) => Promise<void>;
  generateNodeVariation: (clientId: ClientNodeId, sizeOverride?: string) => Promise<void>;
  runGenerateNode: (clientId: ClientNodeId, sizeOverride?: string) => Promise<void>;
  runGenerateNodeInPlace: (
    clientId: ClientNodeId,
    options?: {
      sizeOverride?: string;
      parentServerNodeIdOverride?: string | null;
      suppressToast?: boolean;
    },
  ) => Promise<string | null>;
  deleteNode: (clientId: ClientNodeId) => void;
  deleteNodes: (clientIds: ClientNodeId[]) => void;
  disconnectEdge: (edgeId: string) => void;
  disconnectEdges: (edgeIds: string[]) => void;
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSessionGraphVersion: number | null;
  sessionLoading: boolean;
  loadSessions: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  createAndSwitchSession: (title?: string) => Promise<void>;
  renameCurrentSession: (title: string) => Promise<void>;
  deleteSessionById: (id: string) => Promise<void>;
  scheduleGraphSave: () => void;
  flushGraphSave: (reason?: GraphSaveReason) => Promise<void>;
}

export interface ToastAndErrorState {
  trashPending: TrashPendingState;
  toast: ToastState;
  toastLog: ToastEntry[];
  customSizeConfirm: CustomSizeConfirmState;
  metadataRestore: MetadataRestoreState;
  readDroppedImageMetadata: (file: File, targetNodeId?: ClientNodeId | null) => Promise<boolean>;
  applyMetadataRestore: () => void;
  cancelMetadataRestore: () => void;
  addMetadataRestoreAsReference: () => void;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  composeSheetOpen: boolean;
  composeSheetTab: ComposeSheetTab;
  openComposeSheet: (tab?: ComposeSheetTab) => void;
  setComposeSheetTab: (tab: ComposeSheetTab) => void;
  closeComposeSheet: () => void;
  showToast: (message: string, error?: boolean) => void;
  dismissToast: (id: number) => void;
  errorCard: ErrorCardEntry | null;
  errorCardLog: ErrorCardEntry[];
  showErrorCard: (code: ImaErrorCode, params?: { fallbackMessage?: string }) => void;
  dismissErrorCard: (id?: number) => void;
}

export type AppState =
  GenerationState &
  ReferenceState &
  InflightState &
  HistoryState &
  GalleryState &
  SettingsState &
  ThemeState &
  PromptLibraryState &
  CanvasState &
  VideoState &
  GraphState &
  ToastAndErrorState;
