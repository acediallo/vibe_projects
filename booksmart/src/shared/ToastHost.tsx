import { X } from 'lucide-react';
import { useToastStore, type ToastKind } from './toast-store';

const TONE_CLASS: Record<ToastKind, string> = {
  success: 'bg-status-alive',
  error: 'bg-status-dead',
  info: 'bg-slate-800',
};

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-3 py-2 rounded shadow-lg text-xs text-white pointer-events-auto ${TONE_CLASS[t.kind]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="opacity-70 hover:opacity-100 flex-shrink-0"
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
