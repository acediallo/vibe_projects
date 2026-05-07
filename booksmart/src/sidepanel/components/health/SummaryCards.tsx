interface Props {
  alive: number;
  dead: number;
  stale: number;
  duplicates: number;
}

interface Card {
  label: string;
  value: number;
  color: string;
  border: string;
}

export default function SummaryCards({ alive, dead, stale, duplicates }: Props) {
  const cards: Card[] = [
    {
      label: 'Alive',
      value: alive,
      color: 'text-status-alive',
      border: 'border-l-status-alive',
    },
    {
      label: 'Dead',
      value: dead,
      color: 'text-status-dead',
      border: 'border-l-status-dead',
    },
    {
      label: 'Stale',
      value: stale,
      color: 'text-status-stale',
      border: 'border-l-status-stale',
    },
    {
      label: 'Duplicates',
      value: duplicates,
      color: 'text-status-duplicate',
      border: 'border-l-status-duplicate',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`bg-white border border-slate-200 border-l-4 ${c.border} rounded px-3 py-2`}
        >
          <div className={`text-xl font-semibold ${c.color}`}>{c.value}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}
