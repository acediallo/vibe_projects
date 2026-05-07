import {
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  Clock,
  Copy,
  CornerUpRight,
  XCircle,
} from 'lucide-react';
import type { BookmarkMeta, BookmarkStatus } from '@shared/types';
import { formatTimeAgo, getFaviconUrl, truncateString } from '@shared/utils';

interface Props {
  meta: BookmarkMeta;
  selected: boolean;
  isDuplicate: boolean;
  onToggle: (id: string) => void;
}

const STATUS_LABEL: Record<BookmarkStatus, string> = {
  alive: 'Alive',
  dead: 'Dead',
  redirect: 'Redirect',
  timeout: 'Timeout',
  unknown: 'Unknown',
  unchecked: 'Unchecked',
};

function StatusIcon({ status }: { status: BookmarkStatus }) {
  switch (status) {
    case 'alive':
      return <CheckCircle2 size={14} className="text-status-alive" />;
    case 'dead':
      return <XCircle size={14} className="text-status-dead" />;
    case 'redirect':
      return <CornerUpRight size={14} className="text-status-duplicate" />;
    case 'timeout':
      return <Clock size={14} className="text-status-stale" />;
    case 'unknown':
      return <CircleHelp size={14} className="text-status-unknown" />;
    case 'unchecked':
      return <CircleDashed size={14} className="text-status-unknown" />;
  }
}

export default function BookmarkTableRow({
  meta,
  selected,
  isDuplicate,
  onToggle,
}: Props) {
  function open(): void {
    void chrome.tabs.create({ url: meta.url });
  }

  return (
    <div
      className={`flex items-start gap-2 px-2 py-2 border-b border-slate-100 ${
        selected ? 'bg-accent/5' : 'hover:bg-slate-50'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(meta.id)}
        className="mt-1 accent-accent flex-shrink-0"
      />
      <div className="flex-shrink-0 mt-0.5" title={STATUS_LABEL[meta.status]}>
        <StatusIcon status={meta.status} />
      </div>
      <img
        src={getFaviconUrl(meta.url)}
        alt=""
        className="w-4 h-4 flex-shrink-0 mt-0.5"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
      <div className="flex-1 min-w-0">
        <button
          onClick={open}
          className="block text-left text-sm text-slate-800 hover:text-accent truncate w-full"
          title={meta.title}
        >
          {truncateString(meta.title, 80)}
        </button>
        <div className="text-[10px] text-slate-400 truncate" title={meta.url}>
          {meta.url}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {meta.folderPath && (
            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 rounded">
              {meta.folderPath}
            </span>
          )}
          {isDuplicate && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-status-duplicate">
              <Copy size={10} /> duplicate
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end text-[10px] text-slate-400 flex-shrink-0">
        <span>{formatTimeAgo(meta.dateAdded)}</span>
        {meta.lastChecked && (
          <span title={`Checked ${formatTimeAgo(meta.lastChecked)}`}>
            chk {formatTimeAgo(meta.lastChecked)}
          </span>
        )}
      </div>
    </div>
  );
}
