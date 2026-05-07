import { useState } from 'react';
import { useBooksmartStore } from '@shared/store';
import AttentionBadge from './AttentionBadge';
import BookmarkRow from './BookmarkRow';
import FrequentSection from './FrequentSection';
import RecentSection from './RecentSection';
import SearchBar from './SearchBar';

const MAX_SEARCH_RESULTS = 50;

export default function SmartShelf() {
  const metaMap = useBooksmartStore((s) => s.bookmarksMeta);
  const metas = Object.values(metaMap);

  const [query, setQuery] = useState('');

  const dead = metas.reduce((n, m) => n + (m.status === 'dead' ? 1 : 0), 0);
  const stale = metas.reduce((n, m) => n + (m.ageCategory === 'stale' ? 1 : 0), 0);

  const filtered =
    query.length > 0
      ? metas
          .filter((m) => {
            const q = query.toLowerCase();
            return (
              m.title.toLowerCase().includes(q) || m.url.toLowerCase().includes(q)
            );
          })
          .slice(0, MAX_SEARCH_RESULTS)
      : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-slate-200 bg-white">
        <SearchBar onChange={setQuery} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered ? (
          filtered.length > 0 ? (
            <div className="p-1">
              {filtered.map((m) => (
                <BookmarkRow key={m.id} meta={m} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 px-4 py-6 text-center">
              No bookmarks match “{query}”.
            </p>
          )
        ) : (
          <>
            <RecentSection metas={metas} />
            <FrequentSection metas={metas} />
            {metas.length === 0 && (
              <p className="text-xs text-slate-500 px-4 py-6 text-center">
                No bookmarks yet.
              </p>
            )}
          </>
        )}
      </div>

      <AttentionBadge deadCount={dead} staleCount={stale} />
    </div>
  );
}
