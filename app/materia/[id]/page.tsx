"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subject, Topic } from "@/lib/types";
import { BackLink, Page, buttonClass, inputClass } from "@/components/ui";
import { TopicCard } from "@/components/TopicCard";

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
            <TopicCard key={t.id} topic={t} count={count} />
          );
        })}
        {!topics.length && <p className="text-muted text-center py-8">Aún no hay temas. Crea uno y sube fotos de tus apuntes.</p>}
      </div>

      <button onClick={deleteSubject} className="mt-10 text-sm text-k-red font-bold">Borrar materia</button>
    </Page>
  );
}
