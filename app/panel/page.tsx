"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BackLink, Card, Page } from "@/components/ui";
import { ATTEMPT_FIELDS, summarize, type AttemptRow, type Bucket } from "@/lib/stats";

export default function PanelPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<AttemptRow[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    supabase
      .from("attempts")
      .select(ATTEMPT_FIELDS)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLoadedAt(Date.now());
        setRows((data as unknown as AttemptRow[]) ?? []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rows) return <Page>Cargando…</Page>;

  const { valid, subjects, weakTopics, mostMissed } = summarize(rows, loadedAt);

  return (
    <Page>
      <BackLink href="/" label="Inicio" />
      <h1 className="text-3xl font-black mb-1">Progreso</h1>
      <p className="text-muted mb-6">Últimos 30 días</p>

      {!valid.length ? (
        <p className="text-muted text-center py-12">Todavía no hay partidas. ¡A jugar el primer quiz!</p>
      ) : (
        <>
          <Card className="mb-6">
            <h2 className="font-black mb-3">Aciertos por materia</h2>
            <Bars buckets={subjects} />
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
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.color ?? "#46178f" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
