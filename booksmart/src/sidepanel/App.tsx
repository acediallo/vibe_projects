import { useEffect, useState } from 'react';
import ErrorBoundary from '@shared/ErrorBoundary';
import { useBooksmartStore } from '@shared/store';
import { useToastStore } from '@shared/toast-store';
import ToastHost from '@shared/ToastHost';
import type { BroadcastMessage } from '@shared/types';
import HealthTab from './components/health/HealthTab';
import OrganizeTab from './components/organize/OrganizeTab';
import SettingsTab from './components/settings/SettingsTab';
import TabNav, { type TabKey } from './components/TabNav';

export default function App() {
  const hydrated = useBooksmartStore((s) => s.hydrated);
  const [tab, setTab] = useState<TabKey>('health');

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

  return (
    <div className="flex flex-col h-screen bg-surface-light text-slate-900">
      <header className="bg-surface-dark text-white px-4 py-3 flex-shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Booksmart</h1>
        <p className="text-[11px] text-slate-300">
          Audit, organize, and surface what matters.
        </p>
      </header>

      <TabNav active={tab} onChange={setTab} />

      {!hydrated ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
          Loading…
        </div>
      ) : tab === 'health' ? (
        <ErrorBoundary label="Health tab crashed">
          <HealthTab />
        </ErrorBoundary>
      ) : tab === 'organize' ? (
        <ErrorBoundary label="Organize tab crashed">
          <OrganizeTab />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary label="Settings tab crashed">
          <SettingsTab />
        </ErrorBoundary>
      )}

      <ToastHost />
    </div>
  );
}
