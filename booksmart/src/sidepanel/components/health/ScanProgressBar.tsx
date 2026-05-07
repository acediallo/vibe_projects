import type { ScanProgress } from '@shared/types';

interface Props {
  progress: ScanProgress;
}

export default function ScanProgressBar({ progress }: Props) {
  if (!progress.isScanning) return null;
  const total = progress.total || 0;
  const checked = progress.checked || 0;
  const pct = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded px-3 py-2">
      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span>
          Checking {checked} of {total}…
        </span>
        <span className="text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 rounded overflow-hidden">
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress.currentUrl && (
        <p className="mt-1 text-[10px] text-slate-400 truncate">
          {progress.currentUrl}
        </p>
      )}
    </div>
  );
}
