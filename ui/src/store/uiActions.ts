import type { AppState } from "./appStateTypes";
import type { ComposeSheetTab } from "./uiTypes";
import type { SettingsSection } from "../types";
import type { ImaErrorCode } from "../lib/errorCodes";
import { RIGHT_PANEL_OPEN_STORAGE_KEY } from "./persistenceRegistry";

export const createUiActions = (
  set: (fn: (state: AppState) => Partial<AppState> | Partial<AppState>) => void,
  _get: () => AppState,
) => ({
  showToast: (message: string, error = false) => {
    if (!error) return;
    const createdAt = Date.now();
    const entry = { message, error, id: createdAt + Math.random(), createdAt };
    set((s) => ({ toast: entry, toastLog: [...s.toastLog, entry] }));
  },

  dismissToast: (id: number) => {
    set((s) => {
      const toastLog = s.toastLog.filter((toast) => toast.id !== id);
      return {
        toastLog,
        toast: s.toast?.id === id ? toastLog[toastLog.length - 1] ?? null : s.toast,
      };
    });
  },

  showErrorCard: (code: ImaErrorCode, params?: { fallbackMessage?: string }) => {
    const createdAt = Date.now();
    const entry = { code, fallbackMessage: params?.fallbackMessage, id: createdAt + Math.random(), createdAt };
    set((s) => ({ errorCard: entry, errorCardLog: [...s.errorCardLog, entry] }));
  },

  dismissErrorCard: (id?: number) => {
    set((s) => {
      if (id == null) return { errorCard: null, errorCardLog: [] };
      const errorCardLog = s.errorCardLog.filter((card) => card.id !== id);
      return {
        errorCardLog,
        errorCard: s.errorCard?.id === id ? errorCardLog[errorCardLog.length - 1] ?? null : s.errorCard,
      };
    });
  },

  openSettings: (section: SettingsSection = "account") => {
    set(() => ({ settingsOpen: true, activeSettingsSection: section }));
  },

  closeSettings: () => {
    set(() => ({ settingsOpen: false }));
  },

  toggleSettings: () => {
    set((s) => ({
      settingsOpen: !s.settingsOpen,
      activeSettingsSection: s.settingsOpen ? s.activeSettingsSection : "account",
    }));
  },

  setActiveSettingsSection: (section: SettingsSection) => {
    set(() => ({ activeSettingsSection: section }));
  },

  openReadinessPopup: () => {
    set(() => ({ readinessPopupOpen: true }));
  },

  closeReadinessPopup: () => {
    set(() => ({ readinessPopupOpen: false }));
  },

  openComposeSheet: (tab: ComposeSheetTab = "prompt") => {
    set(() => ({ composeSheetOpen: true, composeSheetTab: tab }));
  },

  setComposeSheetTab: (tab: ComposeSheetTab) => {
    set(() => ({ composeSheetTab: tab }));
  },

  closeComposeSheet: () => {
    set(() => ({ composeSheetOpen: false }));
  },

  toggleRightPanel: () => {
    set((s) => {
      const next = !s.rightPanelOpen;
      try {
        localStorage.setItem(RIGHT_PANEL_OPEN_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return { rightPanelOpen: next };
    });
  },
});
