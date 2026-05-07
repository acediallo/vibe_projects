import { ArrowRight, Check, X } from 'lucide-react';
import type { SuggestionItem } from '@shared/types';

interface Props {
  item: SuggestionItem;
  onApply: () => void;
  onDismiss: () => void;
}

export default function SuggestionCard({ item, onApply, onDismiss }: Props) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded p-3 ${
        item.applied ? 'opacity-50' : ''
      }`}
    >
      <div className="text-sm text-slate-800 font-medium truncate">
        {item.bookmarkTitle}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
        <span className="bg-slate-100 px-1.5 rounded truncate max-w-[40%]">
          {item.currentFolder || '—'}
        </span>
        <ArrowRight size={10} className="flex-shrink-0" />
        <span className="bg-accent/10 text-accent px-1.5 rounded truncate max-w-[40%]">
          {item.suggestedFolder}
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-2 italic">{item.reason}</p>
      {!item.applied && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={onApply}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-status-alive text-white hover:bg-status-alive/90"
          >
            <Check size={12} /> Apply
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            <X size={12} /> Dismiss
          </button>
        </div>
      )}
      {item.applied && (
        <div className="mt-2 text-xs text-status-alive flex items-center gap-1">
          <Check size={12} /> Applied
        </div>
      )}
    </div>
  );
}
