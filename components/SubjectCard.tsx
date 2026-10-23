import Link from "next/link";
import type { Subject } from "@/lib/types";

export function SubjectCard({ subject: s, topics, questions }: { subject: Subject; topics: number; questions: number }) {
  return (
    <Link
      href={`/materia/${s.id}`}
      className="group flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-white/10 shadow-sm active:scale-[0.98] transition"
    >
      <span
        className="grid size-14 shrink-0 place-items-center rounded-2xl text-3xl"
        style={{ background: `${s.color}33`, boxShadow: `inset 0 0 0 1px ${s.color}66` }}
      >
        {s.emoji}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-muted">Materia</span>
        <span className="block text-lg font-extrabold leading-snug line-clamp-2">{s.name}</span>
        <span className="block text-sm text-muted">
          {topics} tema{topics === 1 ? "" : "s"} · {questions} pregunta{questions === 1 ? "" : "s"}
        </span>
      </span>
      <span className="grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-white/25 text-[#3b9cff] group-hover:bg-white/5">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
