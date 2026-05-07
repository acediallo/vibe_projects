import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBooksmartStore } from '@shared/store';
import { getFaviconUrl, truncateString } from '@shared/utils';
import type { BookmarkMeta } from '@shared/types';

interface Props {
  meta: BookmarkMeta;
  badge?: ReactNode;
}

export default function BookmarkRow({ meta, badge }: Props) {
  const removeBookmarkMeta = useBooksmartStore((s) => s.removeBookmarkMeta);

  function open(): void {
    void chrome.tabs.create({ url: meta.url });
    window.close();
  }

  async function remove(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    try {
      await chrome.bookmarks.remove(meta.id);
    } catch {
      // Bookmark may already be gone — fall through to meta cleanup.
    }
    await removeBookmarkMeta(meta.id);
  }

  const folderLabel = meta.folderPath.split('/').filter(Boolean).pop() ?? '';

  return (
    <div
      onClick={open}
      className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer"
    >
      <img
        src={getFaviconUrl(meta.url)}
        alt=""
        className="w-4 h-4 flex-shrink-0"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
      <span className="flex-1 truncate text-sm text-slate-800">
        {truncateString(meta.title, 40)}
      </span>
      {folderLabel && (
        <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
          {folderLabel}
        </span>
      )}
      {badge}
      <button
        onClick={remove}
        title="Delete bookmark"
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-status-dead transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
