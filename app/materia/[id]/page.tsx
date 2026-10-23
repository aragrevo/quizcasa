"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subject, Topic } from "@/lib/types";
import { BackLink, Page, buttonClass, inputClass } from "@/components/ui";

type TopicRow = Topic & { questions: { count: number }[] };

export default function SubjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");

  async function load() {
    const [{ data: s }, { data: t }] = await Promise.all([
      supabase.from("subjects").select("*").eq("id", id).single(),
      supabase.from("topics").select("*, questions(count)").eq("subject_id", id).order("created_at", { ascending: false }),
    ]);
    setSubject(s);
    setTopics((t as TopicRow[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data } = await supabase
      .from("topics")
      .insert({ subject_id: id, title: title.trim(), exam_date: examDate || null })
      .select()
      .single();
    if (data) router.push(`/tema/${data.id}`);
  }

  async function deleteSubject() {
    if (!confirm(`¿Borrar ${subject?.name} con todos sus temas y preguntas?`)) return;
    await supabase.from("subjects").delete().eq("id", id);
    router.push("/");
  }

  if (!subject) return <Page>Cargando…</Page>;

  return (
    <Page>
      <BackLink href="/" label="Materias" />
      <div className="rounded-2xl p-5 text-white mb-6" style={{ background: subject.color }}>
        <span className="text-4xl">{subject.emoji}</span>
        <h1 className="text-3xl font-black">{subject.name}</h1>
      </div>

      <form onSubmit={addTopic} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input className={inputClass} placeholder="Nuevo tema (ej: La Revolución Francesa)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="date" className={`${inputClass} sm:w-44`} value={examDate} onChange={(e) => setExamDate(e.target.value)} title="Fecha del examen (opcional)" />
        <button className={buttonClass}>Agregar</button>
      </form>

      <div className="space-y-3">
        {topics.map((t) => {
          const count = t.questions[0]?.count ?? 0;
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-card p-5 ring-1 ring-white/10 shadow-sm">
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
        })}
        {!topics.length && <p className="text-muted text-center py-8">Aún no hay temas. Crea uno y sube fotos de tus apuntes.</p>}
      </div>

      <button onClick={deleteSubject} className="mt-10 text-sm text-k-red font-bold">Borrar materia</button>
    </Page>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}
