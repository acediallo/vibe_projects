import { useEffect } from 'react';
import ErrorBoundary from '@shared/ErrorBoundary';
import SettingsForm from '@shared/SettingsForm';
import { useBooksmartStore } from '@shared/store';
import ToastHost from '@shared/ToastHost';

export default function OptionsPage() {
  const hydrated = useBooksmartStore((s) => s.hydrated);

  useEffect(() => {
    const handler: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      _changes,
      area,
    ) => {
      if (area !== 'local') return;
      void useBooksmartStore.getState().loadFromStorage();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  return (
    <div className="min-h-screen bg-surface-light text-slate-900">
      <header className="bg-surface-dark text-white px-8 py-5">
        <h1 className="text-xl font-semibold tracking-tight">Booksmart Settings</h1>
        <p className="text-xs text-slate-300 mt-0.5">
          Configure AI provider, schedule, and storage.
        </p>
      </header>
      <main className="max-w-2xl mx-auto px-8 py-6">
        {!hydrated ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ErrorBoundary label="Settings failed to render">
            <SettingsForm />
          </ErrorBoundary>
        )}
      </main>
      <ToastHost />
    </div>
  );
}
