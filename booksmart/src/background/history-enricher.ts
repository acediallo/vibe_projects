import { STORAGE_KEYS } from '@shared/constants';
import type { BookmarksMetaMap, BroadcastMessage } from '@shared/types';

export async function enrichAll(): Promise<void> {
  const got = await chrome.storage.local.get(STORAGE_KEYS.bookmarksMeta);
  const meta: BookmarksMetaMap = (got[STORAGE_KEYS.bookmarksMeta] as BookmarksMetaMap) ?? {};

  for (const id of Object.keys(meta)) {
    const entry = meta[id];
    try {
      const visits = await chrome.history.getVisits({ url: entry.url });
      let lastVisited: number | null = null;
      for (const v of visits) {
        const t = v.visitTime ?? 0;
        if (t > (lastVisited ?? 0)) lastVisited = t;
      }
      meta[id] = {
        ...entry,
        visitCount: visits.length,
        lastVisited,
      };
    } catch {
      // chrome.history may not have data for this URL — leave entry as-is.
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.bookmarksMeta]: meta });
  const msg: BroadcastMessage = { type: 'BOOKMARKS_META_UPDATED' };
  chrome.runtime.sendMessage(msg).catch(() => {});
}
