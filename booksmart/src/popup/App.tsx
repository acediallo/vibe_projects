import { Settings as SettingsIcon } from 'lucide-react';
import { useEffect } from 'react';
import ErrorBoundary from '@shared/ErrorBoundary';
import { useBooksmartStore } from '@shared/store';
import { useToastStore } from '@shared/toast-store';
import ToastHost from '@shared/ToastHost';
import type { BroadcastMessage } from '@shared/types';
import SmartShelf from './components/SmartShelf';
import WelcomeCard from './components/WelcomeCard';

export default function App() {
  const hydrated = useBooksmartStore((s) => s.hydrated);
  const settings = useBooksmartStore((s) => s.settings);
  const scanProgress = useBooksmartStore((s) => s.scanProgress);

  useEffect(() => {
    const storageHandler: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (_changes, area) => {
      if (area !== 'local') return;
      void useBooksmartStore.getState().loadFromStorage();
    };
    chrome.storage.onChanged.addListener(storageHandler);

    const messageHandler = (raw: unknown): void => {
      const msg = raw as BroadcastMessage;
      if (msg?.type === 'SCAN_COMPLETE') {
        const { alive, dead, stale } = msg.counts;
        useToastStore
          .getState()
          .push(`Scan complete: ${alive} alive, ${dead} dead, ${stale} stale`, 'success');
      }
    };
    chrome.runtime.onMessage.addListener(messageHandler);

    return () => {
      chrome.storage.onChanged.removeListener(storageHandler);
      chrome.runtime.onMessage.removeListener(messageHandler);
    };
  }, []);

  const showWelcome = settings.lastFullScan === null;

  return (
    <div className="flex flex-col h-[520px] w-[360px] bg-surface-light text-slate-900">
      <header className="bg-surface-dark text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Booksmart</h1>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          title="Settings"
          className="text-slate-300 hover:text-accent"
        >
          <SettingsIcon size={16} />
        </button>
      </header>

      {!hydrated ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
          Loading…
        </div>
      ) : (
        <ErrorBoundary label="Popup failed to render">
          {showWelcome ? <WelcomeCard scanProgress={scanProgress} /> : <SmartShelf />}
        </ErrorBoundary>
      )}

      <ToastHost />
    </div>
  );
}
