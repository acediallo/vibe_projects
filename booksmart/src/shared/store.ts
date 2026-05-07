import { create } from 'zustand';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants';
import type {
  BookmarkMeta,
  BookmarksMetaMap,
  ReorgSuggestion,
  ScanProgress,
  Settings,
} from './types';

const INITIAL_SCAN_PROGRESS: ScanProgress = {
  isScanning: false,
  total: 0,
  checked: 0,
  currentUrl: null,
  startedAt: null,
};

interface BooksmartState {
  bookmarksMeta: BookmarksMetaMap;
  settings: Settings;
  scanProgress: ScanProgress;
  reorgSuggestions: ReorgSuggestion[];
  hydrated: boolean;
  loadFromStorage: () => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  updateBookmarkMeta: (id: string, patch: Partial<BookmarkMeta>) => Promise<void>;
  removeBookmarkMeta: (id: string) => Promise<void>;
  clearAllData: () => Promise<void>;
}

export const useBooksmartStore = create<BooksmartState>((set, get) => ({
  bookmarksMeta: {},
  settings: DEFAULT_SETTINGS,
  scanProgress: INITIAL_SCAN_PROGRESS,
  reorgSuggestions: [],
  hydrated: false,

  loadFromStorage: async () => {
    try {
      const stored = await chrome.storage.local.get([
        STORAGE_KEYS.bookmarksMeta,
        STORAGE_KEYS.settings,
        STORAGE_KEYS.reorgSuggestions,
        STORAGE_KEYS.scanProgress,
      ]);
      set({
        bookmarksMeta: stored[STORAGE_KEYS.bookmarksMeta] ?? {},
        settings: {
          ...DEFAULT_SETTINGS,
          ...(stored[STORAGE_KEYS.settings] ?? {}),
        },
        reorgSuggestions: stored[STORAGE_KEYS.reorgSuggestions] ?? [],
        scanProgress: stored[STORAGE_KEYS.scanProgress] ?? INITIAL_SCAN_PROGRESS,
        hydrated: true,
      });
    } catch (err) {
      console.error('[Booksmart] failed to load from storage', err);
      set({ hydrated: true });
    }
  },

  saveSettings: async (patch) => {
    const next: Settings = { ...get().settings, ...patch };
    set({ settings: next });
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
  },

  updateBookmarkMeta: async (id, patch) => {
    const current = get().bookmarksMeta[id];
    const merged = { ...current, ...patch, id } as BookmarkMeta;
    const next: BookmarksMetaMap = { ...get().bookmarksMeta, [id]: merged };
    set({ bookmarksMeta: next });
    await chrome.storage.local.set({ [STORAGE_KEYS.bookmarksMeta]: next });
  },

  removeBookmarkMeta: async (id) => {
    const next: BookmarksMetaMap = { ...get().bookmarksMeta };
    delete next[id];
    set({ bookmarksMeta: next });
    await chrome.storage.local.set({ [STORAGE_KEYS.bookmarksMeta]: next });
  },

  clearAllData: async () => {
    set({
      bookmarksMeta: {},
      settings: DEFAULT_SETTINGS,
      reorgSuggestions: [],
      scanProgress: INITIAL_SCAN_PROGRESS,
    });
    await chrome.storage.local.remove(Object.values(STORAGE_KEYS));
  },
}));

if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  void useBooksmartStore.getState().loadFromStorage();
}
