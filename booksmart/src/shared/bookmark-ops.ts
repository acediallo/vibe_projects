import { ARCHIVE_FOLDER_NAME } from './constants';

const ARCHIVE_ID_KEY = 'archive_folder_id';
const OTHER_BOOKMARKS_ID = '2';

export async function ensureArchiveFolder(): Promise<string> {
  const got = await chrome.storage.local.get(ARCHIVE_ID_KEY);
  const cachedId = got[ARCHIVE_ID_KEY] as string | undefined;
  if (cachedId) {
    try {
      const [node] = await chrome.bookmarks.get(cachedId);
      if (node && node.url == null) return cachedId;
    } catch {
      // Cached id no longer valid — fall through to recreate.
    }
  }

  const children = await chrome.bookmarks.getChildren(OTHER_BOOKMARKS_ID);
  const existing = children.find(
    (n) => n.url == null && n.title === ARCHIVE_FOLDER_NAME,
  );
  if (existing) {
    await chrome.storage.local.set({ [ARCHIVE_ID_KEY]: existing.id });
    return existing.id;
  }

  const created = await chrome.bookmarks.create({
    parentId: OTHER_BOOKMARKS_ID,
    title: ARCHIVE_FOLDER_NAME,
  });
  await chrome.storage.local.set({ [ARCHIVE_ID_KEY]: created.id });
  return created.id;
}

export async function moveToArchive(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const folderId = await ensureArchiveFolder();
  for (const id of ids) {
    try {
      await chrome.bookmarks.move(id, { parentId: folderId });
    } catch {
      // Bookmark may have been removed elsewhere — skip.
    }
  }
}

export async function deleteBookmarks(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await chrome.bookmarks.remove(id);
    } catch {
      // Already gone.
    }
  }
}
