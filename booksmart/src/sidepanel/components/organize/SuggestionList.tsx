import type { ReorgSuggestion } from '@shared/types';
import SuggestionCard from './SuggestionCard';

interface Props {
  suggestion: ReorgSuggestion;
  onApply: (index: number) => void;
  onDismiss: (index: number) => void;
  onApplyAll: () => void;
  onDismissAll: () => void;
}

export default function SuggestionList({
  suggestion,
  onApply,
  onDismiss,
  onApplyAll,
  onDismissAll,
}: Props) {
  const pending = suggestion.suggestions.filter((s) => !s.applied).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">{pending} pending</span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={onApplyAll}
            disabled={pending === 0}
            className="px-2 py-1 rounded bg-status-alive text-white hover:bg-status-alive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply All ({pending})
          </button>
          <button
            onClick={onDismissAll}
            disabled={pending === 0}
            className="px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Dismiss All
          </button>
        </div>
      </div>
      {suggestion.suggestions.map((item, i) => (
        <SuggestionCard
          key={`${item.bookmarkId}-${i}`}
          item={item}
          onApply={() => onApply(i)}
          onDismiss={() => onDismiss(i)}
        />
      ))}
    </div>
  );
}
