import { AGE_THRESHOLD_DAYS } from './constants';
import type { AgeCategory, BookmarkMeta } from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let host = u.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return `${host}${path}${u.search}`.toLowerCase();
  } catch {
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }
}

export function getAgeCategory(dateAdded: number): AgeCategory {
  const ageDays = (Date.now() - dateAdded) / MS_PER_DAY;
  if (ageDays < AGE_THRESHOLD_DAYS.fresh) return 'fresh';
  if (ageDays < AGE_THRESHOLD_DAYS.aging) return 'aging';
  if (ageDays < AGE_THRESHOLD_DAYS.stale) return 'stale';
  return 'ancient';
}

export function getFaviconUrl(url: string, size = 16): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=${size}`;
  } catch {
    return '';
  }
}

export function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  if (maxLen <= 1) return str.slice(0, maxLen);
  return str.slice(0, maxLen - 1) + '…';
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function findDuplicateIds(metas: BookmarkMeta[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const m of metas) {
    const key = normalizeUrl(m.url);
    const list = groups.get(key) ?? [];
    list.push(m.id);
    groups.set(key, list);
  }
  const dups = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length >= 2) for (const id of ids) dups.add(id);
  }
  return dups;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'in the future';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  const year = Math.floor(day / 365);
  return `${year} year${year === 1 ? '' : 's'} ago`;
}
