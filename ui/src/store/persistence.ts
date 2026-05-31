import type { CanvasExportBackground, HexColor } from "../types/canvas";
import type {
  HistoryStripLayout,
  ImageModel,
  ThemeFamily,
  ThemePreference,
  UIMode,
  ResolvedTheme,
} from "../types";
import { THEME_FAMILIES } from "../types";
import { ENABLE_AGENT_MODE, ENABLE_CARD_NEWS_MODE, ENABLE_NODE_MODE } from "../lib/devMode";
import {
  DEFAULT_IMAGE_MODEL,
  isImageModel,
} from "../lib/imageModels";
import {
  DEFAULT_REASONING_EFFORT,
  isReasoningEffort,
  type ReasoningEffort,
} from "../lib/reasoning";
import {
  DEFAULT_WEB_SEARCH_ENABLED,
} from "../lib/webSearch";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  CANVAS_EXPORT_BG_KEY,
  HISTORY_STRIP_LAYOUT_STORAGE_KEY,
  IMAGE_MODEL_STORAGE_KEY,
  REASONING_EFFORT_STORAGE_KEY,
  RIGHT_PANEL_OPEN_STORAGE_KEY,
  SELECTED_FILENAME_STORAGE_KEY,
  THEME_FAMILY_STORAGE_KEY,
  THEME_STORAGE_KEY,
  UI_MODE_STORAGE_KEY,
  WEB_SEARCH_STORAGE_KEY,
} from "./persistenceRegistry";

export type GalleryScope = "current-session" | "all";

export function loadRightPanelOpen(): boolean {
  try {
    const raw = localStorage.getItem(RIGHT_PANEL_OPEN_STORAGE_KEY);
    if (raw === null) return true;
    return JSON.parse(raw) === true;
  } catch {
    return true;
  }
}

export function loadUIMode(): UIMode {
  try {
    const raw = localStorage.getItem(UI_MODE_STORAGE_KEY);
    if (raw === "agent") return ENABLE_AGENT_MODE ? raw : "classic";
    if (raw === "card-news") return ENABLE_CARD_NEWS_MODE ? raw : "classic";
    if (raw === "node") return ENABLE_NODE_MODE ? raw : "classic";
    if (raw === "classic") return raw;
  } catch {}
  return ENABLE_AGENT_MODE ? "agent" : "classic";
}

export function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "system" || raw === "dark" || raw === "light") return raw;
  } catch {}
  return "system";
}

export function loadThemeFamily(): ThemeFamily {
  try {
    const raw = localStorage.getItem(THEME_FAMILY_STORAGE_KEY);
    if (raw && (THEME_FAMILIES as readonly string[]).includes(raw)) {
      return raw as ThemeFamily;
    }
  } catch {}
  return "default";
}

export function loadHistoryStripLayout(): HistoryStripLayout {
  try {
    const raw = localStorage.getItem(HISTORY_STRIP_LAYOUT_STORAGE_KEY);
    if (raw === "rail" || raw === "horizontal" || raw === "sidebar") return raw;
  } catch {}
  return "rail";
}

export function loadGalleryScope(key: string): GalleryScope {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "current-session" || raw === "all") return raw;
  } catch {}
  return "current-session";
}

export function loadCanvasExportBackground(): { mode: CanvasExportBackground; matteColor: HexColor } {
  if (typeof window === "undefined") return { mode: "alpha", matteColor: "#ffffff" };
  try {
    const raw = window.localStorage.getItem(CANVAS_EXPORT_BG_KEY);
    if (!raw) return { mode: "alpha", matteColor: "#ffffff" };
    const parsed = JSON.parse(raw) as Partial<{ mode: CanvasExportBackground; matteColor: string }>;
    const mode: CanvasExportBackground = parsed.mode === "matte" ? "matte" : "alpha";
    const matteColor: HexColor =
      typeof parsed.matteColor === "string" && /^#[0-9a-fA-F]{6}$/.test(parsed.matteColor)
        ? (parsed.matteColor as HexColor)
        : "#ffffff";
    return { mode, matteColor };
  } catch {
    return { mode: "alpha", matteColor: "#ffffff" };
  }
}

export function persistCanvasExportBackground(mode: CanvasExportBackground, matteColor: HexColor): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CANVAS_EXPORT_BG_KEY, JSON.stringify({ mode, matteColor }));
  } catch {
    /* ignore quota / unavailable */
  }
}

export function loadImageModel(): ImageModel {
  try {
    const raw = localStorage.getItem(IMAGE_MODEL_STORAGE_KEY);
    if (isImageModel(raw)) return raw;
  } catch {}
  return DEFAULT_IMAGE_MODEL;
}

export function saveImageModel(model: ImageModel): void {
  try {
    localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, model);
  } catch {}
}

export function loadReasoningEffort(): ReasoningEffort {
  try {
    const raw = localStorage.getItem(REASONING_EFFORT_STORAGE_KEY);
    if (isReasoningEffort(raw)) return raw;
  } catch {}
  return DEFAULT_REASONING_EFFORT;
}

export function saveReasoningEffort(effort: ReasoningEffort): void {
  try {
    localStorage.setItem(REASONING_EFFORT_STORAGE_KEY, effort);
  } catch {}
}

export function loadWebSearchEnabled(): boolean {
  try {
    const raw = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
    if (raw === "false") return false;
    if (raw === "true") return true;
  } catch {}
  return DEFAULT_WEB_SEARCH_ENABLED;
}

export function saveWebSearchEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(enabled));
  } catch {}
}

export function resolveThemePreference(theme: ThemePreference): ResolvedTheme {
  if (theme === "dark" || theme === "light") return theme;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function loadSelectedFilename(): string | null {
  try {
    const raw = localStorage.getItem(SELECTED_FILENAME_STORAGE_KEY);
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function saveSelectedFilename(filename: string | null): void {
  try {
    if (filename) localStorage.setItem(SELECTED_FILENAME_STORAGE_KEY, filename);
    else localStorage.removeItem(SELECTED_FILENAME_STORAGE_KEY);
  } catch {}
}

export function loadActiveSessionId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY);
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function saveActiveSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_SESSION_ID_STORAGE_KEY, id);
    else localStorage.removeItem(ACTIVE_SESSION_ID_STORAGE_KEY);
  } catch {}
}
