import { Archive, RefreshCw, Trash2, X } from 'lucide-react';

interface Props {
  count: number;
  onDelete: () => void;
  onArchive: () => void;
  onRecheck: () => void;
  onClear: () => void;
}

export default function BulkActionBar({
  count,
  onDelete,
  onArchive,
  onRecheck,
  onClear,
}: Props) {
  if (count === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-surface-dark text-white px-3 py-2 flex items-center gap-2 text-xs">
      <span className="font-medium">{count} selected</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onRecheck}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
          title="Re-check selected"
        >
          <RefreshCw size={12} /> Re-check
        </button>
        <button
          onClick={onArchive}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
          title="Move to archive folder"
        >
          <Archive size={12} /> Archive
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-2 py-1 rounded bg-status-dead/80 hover:bg-status-dead"
          title="Delete bookmarks"
        >
          <Trash2 size={12} /> Delete
        </button>
        <button
          onClick={onClear}
          className="ml-1 p-1 rounded hover:bg-white/10"
          title="Clear selection"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
