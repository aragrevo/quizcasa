"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BackLink, Card, Page } from "@/components/ui";

type AttemptRow = {
  correct: boolean;
  time_ms: number;
  created_at: string;
  questions: {
    id: string;
    prompt: string;
    options: string[];
    correct_index: number;
    topics: { id: string; title: string; subjects: { name: string; emoji: string; color: string } };
  } | null;
};

type Bucket = { label: string; color?: string; total: number; correct: number };

function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function computeStreak(days: Set<string>) {
  const d = new Date();
  // Si hoy aún no estudió, la racha sigue viva desde ayer.
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function addTo(map: Map<string, Bucket>, key: string, label: string, correct: boolean, color?: string) {
  const b = map.get(key) ?? { label, color, total: 0, correct: 0 };
  b.total++;
  if (correct) b.correct++;
  map.set(key, b);
}

export default function PanelPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<AttemptRow[] | null>(null);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    supabase
      .from("attempts")
      .select("correct, time_ms, created_at, questions(id, prompt, options, correct_index, topics(id, title, subjects(name, emoji, color)))")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as unknown as AttemptRow[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rows) return <Page>Cargando…</Page>;

  const valid = rows.filter((r) => r.questions);
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = valid.filter((r) => new Date(r.created_at).getTime() >= weekAgo);
  const minutesWeek = Math.round(thisWeek.reduce((s, r) => s + r.time_ms, 0) / 60000);
  const streak = computeStreak(new Set(valid.map((r) => dayKey(new Date(r.created_at)))));
  const accuracy = valid.length ? Math.round((valid.filter((r) => r.correct).length / valid.length) * 100) : 0;

  const bySubject = new Map<string, Bucket>();
  const byTopic = new Map<string, Bucket>();
  const byQuestion = new Map<string, Bucket & { answer: string }>();
  for (const r of valid) {
    const q = r.questions!;
    const s = q.topics.subjects;
    addTo(bySubject, s.name, `${s.emoji} ${s.name}`, r.correct, s.color);
    addTo(byTopic, q.topics.id, `${s.emoji} ${q.topics.title}`, r.correct, s.color);
    const b = byQuestion.get(q.id) ?? { label: q.prompt, answer: q.options[q.correct_index], total: 0, correct: 0 };
    b.total++;
    if (r.correct) b.correct++;
    byQuestion.set(q.id, b);
  }

  const weakTopics = [...byTopic.values()].sort((a, b) => a.correct / a.total - b.correct / b.total).slice(0, 6);
  const mostMissed = [...byQuestion.values()]
    .filter((b) => b.total - b.correct > 0)
    .sort((a, b) => b.total - b.correct - (a.total - a.correct))
    .slice(0, 10);

  return (
    <Page>
      <BackLink href="/" label="Inicio" />
      <h1 className="text-3xl font-black mb-1">Progreso</h1>
      <p className="text-muted mb-6">Últimos 30 días</p>

      {!valid.length ? (
        <p className="text-muted text-center py-12">Todavía no hay partidas. ¡A jugar el primer quiz!</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Racha" value={`🔥 ${streak} día${streak === 1 ? "" : "s"}`} />
            <Stat label="Aciertos" value={`${accuracy}%`} />
            <Stat label="Respuestas (7 días)" value={String(thisWeek.length)} />
            <Stat label="Minutos (7 días)" value={String(minutesWeek)} />
          </div>

          <Card className="mb-6">
            <h2 className="font-black mb-3">Aciertos por materia</h2>
            <Bars buckets={[...bySubject.values()]} />
          </Card>

          <Card className="mb-6">
            <h2 className="font-black mb-3">Temas más flojos</h2>
            <Bars buckets={weakTopics} />
          </Card>

          {mostMissed.length > 0 && (
            <Card>
              <h2 className="font-black mb-3">Preguntas que más falla</h2>
              <ol className="space-y-3">
                {mostMissed.map((b, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-bold">{b.label}</p>
                    <p className="text-muted">
                      ✓ {b.answer} · falló {b.total - b.correct} de {b.total}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs text-muted font-bold">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </Card>
  );
}

function Bars({ buckets }: { buckets: Bucket[] }) {
  return (
    <div className="space-y-3">
      {buckets.map((b) => {
        const pct = Math.round((b.correct / b.total) * 100);
        return (
          <div key={b.label}>
            <div className="flex justify-between text-sm font-bold mb-1">
              <span>{b.label}</span>
              <span>{pct}% · {b.total} resp.</span>
            </div>
            <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.color ?? "#46178f" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
