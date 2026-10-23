import Link from "next/link";
import type { Topic } from "@/lib/types";

export function TopicCard({ topic: t, count }: { topic: Topic; count: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-5 ring-1 ring-white/10 shadow-sm">
      <Link href={`/tema/${t.id}`} className="flex-1 min-w-0 active:opacity-70">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted mb-1">Tema</p>
        <p className="text-lg font-extrabold leading-snug">{t.title}</p>
        <p className="text-sm text-muted mt-1">
          {count} pregunta{count === 1 ? "" : "s"}
          {t.exam_date && ` · Examen ${new Date(t.exam_date + "T00:00").toLocaleDateString("es")}`}
        </p>
      </Link>
      <Link
        href={`/tema/${t.id}`}
        aria-label="Ver preguntas"
        title="Ver preguntas"
        className="grid size-11 shrink-0 place-items-center rounded-full ring-1 ring-white/25 text-[#3b9cff] active:scale-95 transition"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5M11 7h9M11 13h9M11 19h9" />
        </svg>
      </Link>
      {count > 0 ? (
        <Link
          href={`/jugar?tema=${t.id}`}
          aria-label="Jugar"
          title="Jugar"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-[#1a7fe0] text-white shadow-lg active:scale-95 transition"
        >
          <PlayIcon />
        </Link>
      ) : (
        <span
          aria-label="Sin preguntas todavía"
          title="Sin preguntas todavía"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-white/10 text-white/40"
        >
          <PlayIcon />
        </span>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}
