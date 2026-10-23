"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/types";
import { Page, buttonClass, inputClass } from "@/components/ui";
import { ReviewCard } from "@/components/ReviewCard";
import { SubjectCard } from "@/components/SubjectCard";

const COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#46178f", "#0aa3a3", "#e0598b"];
type SubjectRow = Subject & { topics: { questions: { count: number }[] }[] };

const EMOJIS = ["📐", "🧪", "🌍", "📜", "📖", "🧬", "🗣️", "🎨", "💻", "⚽"];

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);

  async function load() {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("subjects").select("*, topics(questions(count))").order("created_at"),
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .lte("next_review", new Date().toISOString()),
    ]);
    setSubjects((data as SubjectRow[]) ?? []);
    setDueCount(count ?? 0);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await supabase.from("subjects").insert({ name: name.trim(), emoji, color });
    setName("");
    setAdding(false);
    load();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Page>
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black">QuizCasa</h1>
        <div className="flex gap-3 text-sm font-bold">
          <Link href="/panel" className="text-violet-300">📊 Progreso</Link>
          <button onClick={logout} className="text-muted">Salir</button>
        </div>
      </header>

      <ReviewCard dueCount={dueCount} />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted mb-3">Tus materias</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {subjects.map((s) => (
          <SubjectCard
            key={s.id}
            subject={s}
            topics={s.topics.length}
            questions={s.topics.reduce((sum, t) => sum + (t.questions[0]?.count ?? 0), 0)}
          />
        ))}
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 p-4 min-h-[88px] font-bold text-muted hover:border-white/30 hover:text-foreground transition"
          >
            <span className="grid size-8 place-items-center rounded-full bg-white/10 text-lg">+</span>
            Nueva materia
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={addSubject} className="mt-3 bg-card rounded-2xl p-4 space-y-3 ring-1 ring-white/10 animate-pop">
          <input autoFocus className={inputClass} placeholder="Ej: Matemáticas" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((em) => (
              <button type="button" key={em} onClick={() => setEmoji(em)}
                className={`text-2xl rounded-lg p-1 ${emoji === em ? "bg-white/20" : ""}`}>
                {em}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} aria-label={c}
                className={`size-8 rounded-full ${color === c ? "ring-2 ring-offset-2 ring-offset-[#262629] ring-white" : ""}`}
                style={{ background: c }} />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 font-bold text-muted">Cancelar</button>
            <button className={buttonClass}>Crear</button>
          </div>
        </form>
      )}
    </Page>
  );
}
