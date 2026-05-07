import type { BookmarkMeta } from '@shared/types';
import BookmarkRow from './BookmarkRow';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  metas: BookmarkMeta[];
}

export default function RecentSection({ metas }: Props) {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const recent = metas
    .filter((m) => m.dateAdded >= cutoff)
    .sort((a, b) => b.dateAdded - a.dateAdded)
    .slice(0, 10);

  if (recent.length === 0) return null;

  return (
    <section className="px-1 pt-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-2 pb-1">
        Recent
      </h2>
      {recent.map((m) => (
        <BookmarkRow key={m.id} meta={m} />
      ))}
    </section>
  );
}
