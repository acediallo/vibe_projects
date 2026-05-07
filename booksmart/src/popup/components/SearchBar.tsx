import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  onChange: (query: string) => void;
}

export default function SearchBar({ onChange }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const t = setTimeout(() => onChange(value.trim()), 200);
    return () => clearTimeout(t);
  }, [value, onChange]);

  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search bookmarks…"
        className="w-full pl-7 pr-2 py-1.5 text-sm rounded border border-slate-200 bg-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
