import { Search } from 'lucide-react';
import type { AgeCategory, BookmarkStatus } from '@shared/types';

export type StatusFilter = 'all' | BookmarkStatus;
export type AgeFilter = 'all' | AgeCategory;

interface Props {
  status: StatusFilter;
  age: AgeFilter;
  query: string;
  onStatusChange: (s: StatusFilter) => void;
  onAgeChange: (a: AgeFilter) => void;
  onQueryChange: (q: string) => void;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'alive', label: 'Alive' },
  { value: 'dead', label: 'Dead' },
  { value: 'redirect', label: 'Redirect' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'unchecked', label: 'Unchecked' },
];

const AGE_OPTIONS: { value: AgeFilter; label: string }[] = [
  { value: 'all', label: 'All ages' },
  { value: 'fresh', label: 'Fresh (<30d)' },
  { value: 'aging', label: 'Aging' },
  { value: 'stale', label: 'Stale' },
  { value: 'ancient', label: 'Ancient (>1y)' },
];

export default function FilterBar({
  status,
  age,
  query,
  onStatusChange,
  onAgeChange,
  onQueryChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search title or URL…"
          className="w-full pl-7 pr-2 py-1.5 text-sm rounded border border-slate-200 bg-white focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:border-accent"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={age}
          onChange={(e) => onAgeChange(e.target.value as AgeFilter)}
          className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:border-accent"
        >
          {AGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
