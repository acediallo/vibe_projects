import type { AIProvider, Settings } from './types';

export const STORAGE_KEYS = {
  bookmarksMeta: 'bookmarks_meta',
  settings: 'settings',
  reorgSuggestions: 'reorg_suggestions',
  scanProgress: 'scan_progress',
} as const;

export const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-haiku-4-5-20251001',
  groq: 'llama-3.3-70b-versatile',
};

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'openai',
  aiApiKey: null,
  aiModel: DEFAULT_MODEL_BY_PROVIDER.openai,
  autoScanInterval: 'manual',
  staleThresholdDays: 180,
  maxConcurrentChecks: 5,
  lastFullScan: null,
};

export const AGE_THRESHOLD_DAYS = {
  fresh: 30,
  aging: 180,
  stale: 365,
} as const;

export const SCAN_TIMEOUT_MS = 8000;
export const SCAN_REQUEST_SPACING_MS = 300;
export const SCAN_MAX_RETRIES = 3;
export const AI_BATCH_SIZE = 100;

export const ARCHIVE_FOLDER_NAME = '_Booksmart Archive';
