import type { BookmarkMeta } from '@shared/types';
import BookmarkRow from './BookmarkRow';

interface Props {
  metas: BookmarkMeta[];
}

export default function FrequentSection({ metas }: Props) {
  const top = metas
    .filter((m) => m.visitCount > 0)
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 10);

  if (top.length === 0) return null;

  return (
    <section className="px-1 pt-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-2 pb-1">
        Most Used
      </h2>
      {top.map((m) => (
        <BookmarkRow
          key={m.id}
          meta={m}
          badge={
            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {m.visitCount}
            </span>
          }
        />
      ))}
    </section>
  );
}
