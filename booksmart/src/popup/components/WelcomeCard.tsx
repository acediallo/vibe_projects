import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { ScanProgress } from '@shared/types';

interface Props {
  scanProgress: ScanProgress;
}

export default function WelcomeCard({ scanProgress }: Props) {
  const [scanRequested, setScanRequested] = useState(false);

  function setupAi(): void {
    chrome.runtime.openOptionsPage();
  }

  async function startScan(): Promise<void> {
    setScanRequested(true);
    try {
      await chrome.runtime.sendMessage({ type: 'START_SCAN' });
    } catch {
      setScanRequested(false);
    }
  }

  const isScanning = scanProgress.isScanning || scanRequested;
  const total = scanProgress.total || 0;
  const checked = scanProgress.checked || 0;
  const pct = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0;

  return (
    <div className="px-5 py-6 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-accent/15 text-accent flex items-center justify-center mb-3">
        <Sparkles size={22} />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Welcome to Booksmart</h2>
      <p className="text-sm text-slate-500 mt-1 mb-5 max-w-[260px]">
        Audit dead links, surface what matters, and let AI tidy your folders.
      </p>

      {isScanning ? (
        <div className="w-full">
          <div className="h-1.5 w-full bg-slate-200 rounded overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {total > 0 ? `Checking ${checked} of ${total}…` : 'Starting scan…'}
          </p>
          {scanProgress.currentUrl && (
            <p className="mt-1 text-[10px] text-slate-400 truncate">
              {scanProgress.currentUrl}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={() => void startScan()}
            className="w-full py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent/90"
          >
            Run your first scan
          </button>
          <button
            onClick={setupAi}
            className="w-full py-2 rounded border border-slate-300 text-sm text-slate-700 hover:bg-slate-100"
          >
            Set up AI features
          </button>
        </div>
      )}
    </div>
  );
}
