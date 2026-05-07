import {
  DEFAULT_SETTINGS,
  SCAN_REQUEST_SPACING_MS,
  SCAN_TIMEOUT_MS,
  STORAGE_KEYS,
} from '@shared/constants';
import { getAgeCategory, sleep } from '@shared/utils';
import type {
  BookmarksMetaMap,
  BookmarkStatus,
  BroadcastMessage,
  ScanCounts,
  ScanProgress,
  Settings,
} from '@shared/types';

interface FlatBookmark {
  id: string;
  title: string;
  url: string;
  folderPath: string;
  dateAdded: number;
}

interface CheckResult {
  status: BookmarkStatus;
  httpCode: number | null;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000];

let scanInProgress = false;

export function isScanRunning(): boolean {
  return scanInProgress;
}

export async function startScan(): Promise<void> {
  if (scanInProgress) return;
  scanInProgress = true;
  try {
    const settings = await loadSettings();
    const tree = await chrome.bookmarks.getTree();
    const flat = flattenTree(tree);

    const existingMeta = await loadMeta();
    const existingProgress = await loadProgress();

    const startedAt =
      existingProgress.isScanning && existingProgress.startedAt
        ? existingProgress.startedAt
        : Date.now();

    const meta = reconcileMeta(flat, existingMeta);
    await saveMeta(meta);

    const toCheck = flat.filter((fb) => {
      const m = meta[fb.id];
      return !m.lastChecked || m.lastChecked < startedAt;
    });

    let checked = flat.length - toCheck.length;
    await saveProgress({
      isScanning: true,
      total: flat.length,
      checked,
      currentUrl: null,
      startedAt,
    });

    await processInPool(
      toCheck,
      Math.max(1, settings.maxConcurrentChecks),
      SCAN_REQUEST_SPACING_MS,
      async (fb) => {
        const result = await checkUrlWithBackoff(fb.url);
        meta[fb.id] = {
          ...meta[fb.id],
          status: result.status,
          httpCode: result.httpCode,
          lastChecked: Date.now(),
        };
        await saveMeta(meta);
        checked++;
        const progress: ScanProgress = {
          isScanning: true,
          total: flat.length,
          checked,
          currentUrl: fb.url,
          startedAt,
        };
        await saveProgress(progress);
        broadcast({ type: 'SCAN_PROGRESS', progress });
      },
    );

    await saveProgress({
      isScanning: false,
      total: flat.length,
      checked,
      currentUrl: null,
      startedAt: null,
    });
    await saveSettings({ ...settings, lastFullScan: Date.now() });
    broadcast({ type: 'SCAN_COMPLETE', counts: countMeta(meta) });
    broadcast({ type: 'BOOKMARKS_META_UPDATED' });
  } finally {
    scanInProgress = false;
  }
}

function countMeta(meta: BookmarksMetaMap): ScanCounts {
  let alive = 0;
  let dead = 0;
  let stale = 0;
  for (const m of Object.values(meta)) {
    if (m.status === 'alive') alive++;
    if (m.status === 'dead') dead++;
    if (m.ageCategory === 'stale') stale++;
  }
  return { alive, dead, stale };
}

export async function resumeIfPending(): Promise<void> {
  const progress = await loadProgress();
  if (progress.isScanning) {
    void startScan();
  }
}

export async function rescanIds(ids: string[]): Promise<void> {
  if (scanInProgress || ids.length === 0) return;
  scanInProgress = true;
  try {
    const settings = await loadSettings();
    const meta = await loadMeta();
    const targets = ids.filter((id) => meta[id] != null);

    const startedAt = Date.now();
    let checked = 0;
    await saveProgress({
      isScanning: true,
      total: targets.length,
      checked,
      currentUrl: null,
      startedAt,
    });

    await processInPool(
      targets,
      Math.max(1, settings.maxConcurrentChecks),
      SCAN_REQUEST_SPACING_MS,
      async (id) => {
        const url = meta[id].url;
        const result = await checkUrlWithBackoff(url);
        meta[id] = {
          ...meta[id],
          status: result.status,
          httpCode: result.httpCode,
          lastChecked: Date.now(),
        };
        await saveMeta(meta);
        checked++;
        const progress: ScanProgress = {
          isScanning: true,
          total: targets.length,
          checked,
          currentUrl: url,
          startedAt,
        };
        await saveProgress(progress);
        broadcast({ type: 'SCAN_PROGRESS', progress });
      },
    );

    await saveProgress({
      isScanning: false,
      total: targets.length,
      checked,
      currentUrl: null,
      startedAt: null,
    });
    broadcast({ type: 'BOOKMARKS_META_UPDATED' });
  } finally {
    scanInProgress = false;
  }
}

function flattenTree(roots: chrome.bookmarks.BookmarkTreeNode[]): FlatBookmark[] {
  const out: FlatBookmark[] = [];
  function visit(node: chrome.bookmarks.BookmarkTreeNode, path: string): void {
    if (node.url) {
      out.push({
        id: node.id,
        title: node.title || node.url,
        url: node.url,
        folderPath: path,
        dateAdded: node.dateAdded ?? Date.now(),
      });
      return;
    }
    const nextPath = node.title
      ? path
        ? `${path}/${node.title}`
        : node.title
      : path;
    if (node.children) {
      for (const child of node.children) visit(child, nextPath);
    }
  }
  for (const root of roots) visit(root, '');
  return out;
}

function reconcileMeta(
  flat: FlatBookmark[],
  existing: BookmarksMetaMap,
): BookmarksMetaMap {
  const next: BookmarksMetaMap = {};
  for (const fb of flat) {
    const old = existing[fb.id];
    next[fb.id] = old
      ? {
          ...old,
          title: fb.title,
          url: fb.url,
          folderPath: fb.folderPath,
          dateAdded: fb.dateAdded,
          ageCategory: getAgeCategory(fb.dateAdded),
        }
      : {
          id: fb.id,
          title: fb.title,
          url: fb.url,
          folderPath: fb.folderPath,
          dateAdded: fb.dateAdded,
          lastChecked: null,
          status: 'unchecked',
          httpCode: null,
          lastVisited: null,
          visitCount: 0,
          ageCategory: getAgeCategory(fb.dateAdded),
        };
  }
  return next;
}

async function checkUrlWithBackoff(url: string): Promise<CheckResult> {
  for (let attempt = 0; ; attempt++) {
    const result = await checkUrl(url);
    if (result.httpCode !== 429) return result;
    if (attempt >= RETRY_DELAYS_MS.length) {
      return { status: 'unknown', httpCode: 429 };
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

async function checkUrl(url: string): Promise<CheckResult> {
  let res: Response | null = null;
  try {
    res = await doFetch(url, 'HEAD');
  } catch (err) {
    if (isTimeout(err)) return { status: 'timeout', httpCode: null };
    try {
      res = await doFetch(url, 'GET');
    } catch (err2) {
      if (isTimeout(err2)) return { status: 'timeout', httpCode: null };
      return { status: 'unknown', httpCode: null };
    }
  }

  if (res.status === 405) {
    try {
      res = await doFetch(url, 'GET');
    } catch (err) {
      if (isTimeout(err)) return { status: 'timeout', httpCode: null };
      return { status: 'unknown', httpCode: null };
    }
  }

  return mapStatus(res.status);
}

async function doFetch(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  return await fetch(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
  });
}

function isTimeout(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'TimeoutError';
}

function mapStatus(code: number): CheckResult {
  if (code >= 200 && code < 300) return { status: 'alive', httpCode: code };
  if (code === 301 || code === 302 || code === 308) {
    return { status: 'redirect', httpCode: code };
  }
  if (code === 429) return { status: 'unknown', httpCode: 429 };
  if (code === 404 || code === 410) return { status: 'dead', httpCode: code };
  if (code >= 500) return { status: 'dead', httpCode: code };
  return { status: 'unknown', httpCode: code };
}

async function processInPool<T>(
  items: T[],
  concurrency: number,
  spacingMs: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIdx = 0;
  let lastLaunched = 0;

  async function loop(): Promise<void> {
    while (true) {
      const i = nextIdx++;
      if (i >= items.length) return;
      const now = Date.now();
      const target = Math.max(now, lastLaunched + spacingMs);
      lastLaunched = target;
      if (target > now) await sleep(target - now);
      await worker(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => loop()),
  );
}

async function loadMeta(): Promise<BookmarksMetaMap> {
  const got = await chrome.storage.local.get(STORAGE_KEYS.bookmarksMeta);
  return (got[STORAGE_KEYS.bookmarksMeta] as BookmarksMetaMap) ?? {};
}

async function saveMeta(meta: BookmarksMetaMap): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.bookmarksMeta]: meta });
}

async function loadProgress(): Promise<ScanProgress> {
  const got = await chrome.storage.local.get(STORAGE_KEYS.scanProgress);
  return (
    (got[STORAGE_KEYS.scanProgress] as ScanProgress) ?? {
      isScanning: false,
      total: 0,
      checked: 0,
      currentUrl: null,
      startedAt: null,
    }
  );
}

async function saveProgress(p: ScanProgress): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.scanProgress]: p });
}

async function loadSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...((got[STORAGE_KEYS.settings] as Settings) ?? {}) };
}

async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: s });
}

function broadcast(msg: BroadcastMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // No receivers (popup/sidepanel closed) — swallow.
  });
}
