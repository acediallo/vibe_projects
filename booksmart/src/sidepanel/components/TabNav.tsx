import { Activity, FolderTree, Settings as SettingsIcon } from 'lucide-react';

export type TabKey = 'health' | 'organize' | 'settings';

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; icon: typeof Activity }[] = [
  { key: 'health', label: 'Health', icon: Activity },
  { key: 'organize', label: 'Organize', icon: FolderTree },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function TabNav({ active, onChange }: Props) {
  return (
    <nav className="flex border-b border-slate-200 bg-white flex-shrink-0">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
              isActive
                ? 'text-accent border-b-2 border-accent font-medium'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
