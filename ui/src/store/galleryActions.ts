import type { AppState } from "./appStateTypes";
import { toggleGalleryFavorite as apiToggleGalleryFavorite } from "../lib/api";
import {
  GALLERY_SCOPE_STORAGE_KEY,
  GALLERY_DEFAULT_SCOPE_STORAGE_KEY,
} from "./persistenceRegistry";

type GalleryScope = "current-session" | "all";

export const createGalleryActions = (
  set: (fn: (state: AppState) => Partial<AppState> | Partial<AppState>) => void,
  _get: () => AppState,
) => ({
  openGallery: () => {
    set((s) => ({ galleryOpen: true, galleryScope: s.galleryDefaultScope }));
  },

  closeGallery: () => {
    set(() => ({ galleryOpen: false }));
  },

  setGalleryScope: (scope: GalleryScope) => {
    try {
      localStorage.setItem(GALLERY_SCOPE_STORAGE_KEY, scope);
    } catch {}
    set(() => ({ galleryScope: scope }));
  },

  setGalleryDefaultScope: (scope: GalleryScope) => {
    try {
      localStorage.setItem(GALLERY_DEFAULT_SCOPE_STORAGE_KEY, scope);
      localStorage.setItem(GALLERY_SCOPE_STORAGE_KEY, scope);
    } catch {}
    set(() => ({ galleryDefaultScope: scope, galleryScope: scope }));
  },

  toggleGalleryFavorite: async (filename: string) => {
    try {
      const result = await apiToggleGalleryFavorite(filename);
      set((s) => {
        const next = new Set(s.galleryFavorites);
        if (result.isFavorite) next.add(filename);
        else next.delete(filename);
        return { galleryFavorites: next };
      });
      // Also update history items in place
      set((s) => ({
        history: s.history.map((h) =>
          h.filename === filename ? { ...h, isFavorite: result.isFavorite } : h,
        ),
      }));
    } catch (err) {
      console.error("[GalleryFavorite] toggle failed", err);
    }
  },
});
