import { ArrowDown, ArrowUp } from 'lucide-react';
import type { BookmarkMeta } from '@shared/types';
import BookmarkTableRow from './BookmarkTableRow';

export type SortColumn = 'status' | 'title' | 'age';
export type SortDir = 'asc' | 'desc';

interface Props {
  rows: BookmarkMeta[];
  selectedIds: Set<string>;
  duplicateIds: Set<string>;
  sortColumn: SortColumn;
  sortDir: SortDir;
  onToggleSelect: (id: string) => void;
  onSort: (column: SortColumn) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

const COLUMNS: { value: SortColumn; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title' },
  { value: 'age', label: 'Age' },
];

export default function BookmarkTable({
  rows,
  selectedIds,
  duplicateIds,
  sortColumn,
  sortDir,
  onToggleSelect,
  onSort,
  onSelectAll,
  onClearAll,
}: Props) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  return (
    <div className="bg-white border border-slate-200 rounded">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={allSelected ? onClearAll : onSelectAll}
          className="accent-accent"
          title={allSelected ? 'Deselect all' : 'Select all visible'}
        />
        <span className="text-slate-400">Sort:</span>
        {COLUMNS.map((c) => {
          const active = sortColumn === c.value;
          return (
            <button
              key={c.value}
              onClick={() => onSort(c.value)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                active ? 'bg-accent/10 text-accent' : 'hover:bg-slate-200'
              }`}
            >
              {c.label}
              {active &&
                (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
            </button>
          );
        })}
        <span className="ml-auto text-slate-400">{rows.length} shown</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 px-4 py-8 text-center">
          No bookmarks match these filters.
        </p>
      ) : (
        <div>
          {rows.map((m) => (
            <BookmarkTableRow
              key={m.id}
              meta={m}
              selected={selectedIds.has(m.id)}
              isDuplicate={duplicateIds.has(m.id)}
              onToggle={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
