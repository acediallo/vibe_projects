import { Inbox, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { deleteBookmarks, moveToArchive } from '@shared/bookmark-ops';
import { useBooksmartStore } from '@shared/store';
import { useToastStore } from '@shared/toast-store';
import type { BookmarkMeta } from '@shared/types';
import { findDuplicateIds, formatTimeAgo } from '@shared/utils';
import BookmarkTable, {
  type SortColumn,
  type SortDir,
} from './BookmarkTable';
import BulkActionBar from './BulkActionBar';
import FilterBar, { type AgeFilter, type StatusFilter } from './FilterBar';
import ScanProgressBar from './ScanProgressBar';
import SummaryCards from './SummaryCards';

const STATUS_RANK: Record<BookmarkMeta['status'], number> = {
  dead: 0,
  timeout: 1,
  unknown: 2,
  redirect: 3,
  unchecked: 4,
  alive: 5,
};

export default function HealthTab() {
  const metaMap = useBooksmartStore((s) => s.bookmarksMeta);
  const scanProgress = useBooksmartStore((s) => s.scanProgress);
  const settings = useBooksmartStore((s) => s.settings);

  const metas = useMemo(() => Object.values(metaMap), [metaMap]);
  const duplicateIds = useMemo(() => findDuplicateIds(metas), [metas]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [query, setQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = metas.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (ageFilter !== 'all' && m.ageCategory !== ageFilter) return false;
      if (
        q &&
        !m.title.toLowerCase().includes(q) &&
        !m.url.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortColumn) {
        case 'status':
          return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) * dir;
        case 'title':
          return a.title.localeCompare(b.title) * dir;
        case 'age':
          return (a.dateAdded - b.dateAdded) * dir;
      }
    });
    return list;
  }, [metas, statusFilter, ageFilter, query, sortColumn, sortDir]);

  const counts = useMemo(() => {
    let alive = 0;
    let dead = 0;
    let stale = 0;
    for (const m of metas) {
      if (m.status === 'alive') alive++;
      if (m.status === 'dead') dead++;
      if (m.ageCategory === 'stale') stale++;
    }
    return { alive, dead, stale, duplicates: duplicateIds.size };
  }, [metas, duplicateIds]);

  function handleSort(column: SortColumn): void {
    if (column === sortColumn) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDir('asc');
    }
  }

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible(): void {
    setSelectedIds(new Set(visible.map((m) => m.id)));
  }

  function clearSelection(): void {
    setSelectedIds(new Set());
  }

  async function handleDelete(): Promise<void> {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${ids.length} bookmark${ids.length === 1 ? '' : 's'}? This removes them from Chrome too.`,
    );
    if (!confirmed) return;
    await deleteBookmarks(ids);
    const store = useBooksmartStore.getState();
    for (const id of ids) await store.removeBookmarkMeta(id);
    clearSelection();
    useToastStore
      .getState()
      .push(`${ids.length} bookmark${ids.length === 1 ? '' : 's'} deleted`, 'info');
  }

  async function handleArchive(): Promise<void> {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await moveToArchive(ids);
    clearSelection();
    useToastStore
      .getState()
      .push(`${ids.length} bookmark${ids.length === 1 ? '' : 's'} archived`, 'info');
  }

  async function handleRecheck(): Promise<void> {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await chrome.runtime.sendMessage({ type: 'RECHECK_IDS', ids });
    clearSelection();
    useToastStore.getState().push(`Re-checking ${ids.length}…`, 'info');
  }

  function startScan(): void {
    void chrome.runtime.sendMessage({ type: 'START_SCAN' });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-3 space-y-3 overflow-y-auto flex-1">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {settings.lastFullScan
              ? `Last scanned ${formatTimeAgo(settings.lastFullScan)}`
              : 'No scan yet'}
          </div>
          <button
            onClick={startScan}
            disabled={scanProgress.isScanning}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              size={12}
              className={scanProgress.isScanning ? 'animate-spin' : ''}
            />
            {scanProgress.isScanning ? 'Scanning…' : 'Scan Now'}
          </button>
        </div>

        <ScanProgressBar progress={scanProgress} />

        {metas.length === 0 ? (
          <div className="flex flex-col items-center text-center px-4 py-10 bg-white border border-slate-200 rounded">
            <Inbox size={28} className="text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">
              No bookmarks scanned yet
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
              Click <span className="font-medium">Scan Now</span> to audit your
              bookmark library and surface what needs attention.
            </p>
          </div>
        ) : (
          <>
            <SummaryCards {...counts} />

            <FilterBar
              status={statusFilter}
              age={ageFilter}
              query={query}
              onStatusChange={setStatusFilter}
              onAgeChange={setAgeFilter}
              onQueryChange={setQuery}
            />

            <BookmarkTable
              rows={visible}
              selectedIds={selectedIds}
              duplicateIds={duplicateIds}
              sortColumn={sortColumn}
              sortDir={sortDir}
              onToggleSelect={toggleSelect}
              onSort={handleSort}
              onSelectAll={selectAllVisible}
              onClearAll={clearSelection}
            />
          </>
        )}
      </div>

      <BulkActionBar
        count={selectedIds.size}
        onDelete={() => void handleDelete()}
        onArchive={() => void handleArchive()}
        onRecheck={() => void handleRecheck()}
        onClear={clearSelection}
      />
    </div>
  );
}
