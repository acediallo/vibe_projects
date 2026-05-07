import { Inbox, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBooksmartStore } from '@shared/store';
import FolderTree from './FolderTree';
import SuggestionList from './SuggestionList';

export default function OrganizeTab() {
  const metaMap = useBooksmartStore((s) => s.bookmarksMeta);
  const settings = useBooksmartStore((s) => s.settings);
  const reorgSuggestions = useBooksmartStore((s) => s.reorgSuggestions);

  const metas = useMemo(() => Object.values(metaMap), [metaMap]);
  const activeSuggestion = reorgSuggestions.find((s) => s.status === 'pending');

  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKey = !!settings.aiApiKey;

  async function requestReorg(): Promise<void> {
    setRequesting(true);
    setError(null);
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: 'REQUEST_REORG',
      })) as { ok: boolean; error?: string } | undefined;
      if (!resp?.ok) {
        setError(resp?.error ?? 'Failed to request suggestions.');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRequesting(false);
    }
  }

  function notImplemented(): void {
    setError('AI features not implemented yet.');
  }

  if (metas.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center px-6 py-10 text-center">
        <Inbox size={28} className="text-slate-300 mb-3" />
        <h3 className="text-sm font-semibold text-slate-700">
          Run a scan first
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
          We need to know your bookmarks before suggesting a tidier folder
          structure. Open the Health tab and click Scan Now.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-3 py-3 space-y-3 overflow-y-auto">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Current Folders
        </h2>
        <FolderTree metas={metas} />
      </section>

      <section>
        <button
          onClick={() => void requestReorg()}
          disabled={!hasKey || requesting || metas.length === 0}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={14} />
          {requesting ? 'Analyzing your bookmarks…' : 'Suggest Reorganization with AI'}
        </button>
        {!hasKey && (
          <p className="mt-2 text-xs text-slate-500">
            Set up your API key in Settings to use AI features.
          </p>
        )}
        {metas.length === 0 && hasKey && (
          <p className="mt-2 text-xs text-slate-500">
            Run a scan first so we know what to organize.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-status-dead">{error}</p>}
      </section>

      {activeSuggestion && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Suggestions
          </h2>
          <SuggestionList
            suggestion={activeSuggestion}
            onApply={notImplemented}
            onDismiss={notImplemented}
            onApplyAll={notImplemented}
            onDismissAll={notImplemented}
          />
        </section>
      )}
    </div>
  );
}
