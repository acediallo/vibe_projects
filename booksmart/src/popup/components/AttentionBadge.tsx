import { AlertTriangle } from 'lucide-react';

interface Props {
  deadCount: number;
  staleCount: number;
}

async function openSidePanel(): Promise<void> {
  try {
    const win = await chrome.windows.getCurrent();
    if (win.id != null) {
      await chrome.sidePanel.open({ windowId: win.id });
    }
  } catch {
    // Side panel API unavailable or no active window — silently ignore.
  }
  window.close();
}

export default function AttentionBadge({ deadCount, staleCount }: Props) {
  if (deadCount === 0 && staleCount === 0) return null;

  const parts: string[] = [];
  if (deadCount > 0) parts.push(`${deadCount} dead link${deadCount === 1 ? '' : 's'}`);
  if (staleCount > 0) parts.push(`${staleCount} stale`);

  return (
    <button
      onClick={() => void openSidePanel()}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent/10 text-accent hover:bg-accent/20 text-xs font-medium border-t border-accent/30"
    >
      <AlertTriangle size={14} />
      <span>{parts.join(' · ')}</span>
    </button>
  );
}
