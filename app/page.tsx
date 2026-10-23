"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/types";
import { Page, buttonClass, inputClass } from "@/components/ui";
import { ReviewCard } from "@/components/ReviewCard";

const COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#46178f", "#0aa3a3", "#e0598b"];
const EMOJIS = ["📐", "🧪", "🌍", "📜", "📖", "🧬", "🗣️", "🎨", "💻", "⚽"];

export default function Home() {
  const supabase = createClient();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);

  async function load() {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("subjects").select("*").order("created_at"),
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .lte("next_review", new Date().toISOString()),
    ]);
    setSubjects(data ?? []);
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
    location.href = "/login";
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

      <h2 className="font-black text-xl mb-3">Materias</h2>
      <div className="grid grid-cols-2 gap-3">
        {subjects.map((s) => (
          <Link
            key={s.id}
            href={`/materia/${s.id}`}
            className="rounded-2xl p-4 text-white shadow-md active:scale-95 transition aspect-[4/3] flex flex-col justify-between"
            style={{ background: s.color }}
          >
            <span className="text-4xl">{s.emoji}</span>
            <span className="font-black text-lg leading-tight">{s.name}</span>
          </Link>
        ))}
        <button
          onClick={() => setAdding(true)}
          className="rounded-2xl border-2 border-dashed border-white/20 aspect-[4/3] font-bold text-muted"
        >
          + Nueva materia
        </button>
      </div>

      {adding && (
        <form onSubmit={addSubject} className="mt-4 bg-card rounded-2xl p-4 space-y-3 animate-pop">
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
                className={`size-8 rounded-full ${color === c ? "ring-4 ring-offset-2 ring-black/30" : ""}`}
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
