export type BookmarkStatus =
  | 'alive'
  | 'dead'
  | 'redirect'
  | 'timeout'
  | 'unknown'
  | 'unchecked';

export type AgeCategory = 'fresh' | 'aging' | 'stale' | 'ancient';

export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'groq';

export type AutoScanInterval = 'daily' | 'weekly' | 'manual';

export type ReorgStatus =
  | 'pending'
  | 'partially_applied'
  | 'applied'
  | 'dismissed';

export interface BookmarkMeta {
  id: string;
  title: string;
  url: string;
  folderPath: string;
  dateAdded: number;
  lastChecked: number | null;
  status: BookmarkStatus;
  httpCode: number | null;
  lastVisited: number | null;
  visitCount: number;
  ageCategory: AgeCategory;
}

export interface Settings {
  aiProvider: AIProvider;
  aiApiKey: string | null;
  aiModel: string;
  autoScanInterval: AutoScanInterval;
  staleThresholdDays: number;
  maxConcurrentChecks: number;
  lastFullScan: number | null;
}

export interface SuggestionItem {
  bookmarkId: string;
  bookmarkTitle: string;
  currentFolder: string;
  suggestedFolder: string;
  reason: string;
  applied: boolean;
}

export interface ReorgSuggestion {
  id: string;
  createdAt: number;
  suggestions: SuggestionItem[];
  status: ReorgStatus;
}

export interface ScanProgress {
  isScanning: boolean;
  total: number;
  checked: number;
  currentUrl: string | null;
  startedAt: number | null;
}

export type BookmarksMetaMap = Record<string, BookmarkMeta>;

export type BackgroundMessage =
  | { type: 'START_SCAN' }
  | { type: 'RECHECK_IDS'; ids: string[] }
  | { type: 'GET_PROGRESS' }
  | { type: 'REQUEST_REORG' }
  | { type: 'APPLY_SUGGESTION'; suggestionId: string; itemIndex: number }
  | { type: 'TEST_API_KEY'; provider: AIProvider; apiKey: string; model: string };

export interface ScanCounts {
  alive: number;
  dead: number;
  stale: number;
}

export type BroadcastMessage =
  | { type: 'SCAN_PROGRESS'; progress: ScanProgress }
  | { type: 'SCAN_COMPLETE'; counts: ScanCounts }
  | { type: 'BOOKMARKS_META_UPDATED' };
