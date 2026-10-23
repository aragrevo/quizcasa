"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { buildManualPrompt, parsePastedQuiz, toQuestionRows } from "@/lib/prompts";
import type { Photo, Question, Topic } from "@/lib/types";
import { BackLink, Card, Page, buttonClass, inputClass } from "@/components/ui";

type PhotoWithUrl = Photo & { url?: string };
type TopicWithSubject = Topic & { subjects: { name: string } | null };

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState<TopicWithSubject | null>(null);
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState(false);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    const [{ data: t }, { data: p }, { data: q }] = await Promise.all([
      supabase.from("topics").select("*, subjects(name)").eq("id", id).single(),
      supabase.from("photos").select("*").eq("topic_id", id).order("created_at"),
      supabase.from("questions").select("*").eq("topic_id", id).order("created_at"),
    ]);
    setTopic(t);
    setQuestions(q ?? []);
    const rows: PhotoWithUrl[] = p ?? [];
    if (rows.length) {
      const { data: signed } = await supabase.storage
        .from("photos")
        .createSignedUrls(rows.map((r) => r.storage_path), 3600);
      rows.forEach((r, i) => (r.url = signed?.[i]?.signedUrl ?? undefined));
    }
    setPhotos(rows);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    for (const file of Array.from(files)) {
      const blob = await compressImage(file);
      const path = `${user!.id}/${id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) {
        setMessage(`Error subiendo foto: ${error.message}`);
        continue;
      }
      await supabase.from("photos").insert({ topic_id: id, storage_path: path });
    }
    setUploading(false);
    load();
  }

  async function deletePhoto(photo: Photo) {
    await supabase.storage.from("photos").remove([photo.storage_path]);
    await supabase.from("photos").delete().eq("id", photo.id);
    load();
  }

  async function generate() {
    setGenerating(true);
    setMessage("");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: id }),
    });
    const body = await res.json().catch(() => ({ error: "Error inesperado" }));
    setGenerating(false);
    setMessage(res.ok ? `✨ ${body.created} preguntas nuevas. Revísalas abajo.` : body.error);
    load();
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(buildManualPrompt(topic?.subjects?.name ?? "", topic!.title));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function importPasted() {
    setMessage("");
    try {
      const quiz = parsePastedQuiz(pasted);
      const rows = toQuestionRows(quiz, id);
      if (!rows.length) throw new Error("No había preguntas válidas en la respuesta");
      const { error } = await supabase.from("questions").insert(rows);
      if (error) throw new Error(error.message);
      const newPhotoIds = photos.filter((p) => !p.extracted_text).map((p) => p.id);
      if (newPhotoIds.length) {
        await supabase.from("photos").update({ extracted_text: quiz.transcription }).in("id", newPhotoIds);
      }
      setPasted("");
      setMessage(`✨ ${rows.length} preguntas importadas. Revísalas abajo.`);
      load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function saveTopic(title: string, examDate: string) {
    await supabase.from("topics").update({ title, exam_date: examDate || null }).eq("id", id);
    setEditingTopic(false);
    load();
  }

  async function saveQuestion(q: Question) {
    await supabase
      .from("questions")
      .update({ prompt: q.prompt, options: q.options, correct_index: q.correct_index, explanation: q.explanation })
      .eq("id", q.id);
    setEditing(null);
    load();
  }

  async function deleteQuestion(qid: string) {
    await supabase.from("questions").delete().eq("id", qid);
    setQuestions((qs) => qs.filter((q) => q.id !== qid));
  }

  async function deleteTopic() {
    if (!confirm("¿Borrar este tema con sus fotos y preguntas?")) return;
    await supabase.storage.from("photos").remove(photos.map((p) => p.storage_path));
    await supabase.from("topics").delete().eq("id", id);
    router.push(`/materia/${topic!.subject_id}`);
  }

  if (!topic) return <Page>Cargando…</Page>;
  const pending = photos.filter((p) => !p.extracted_text).length;

  return (
    <Page>
      <BackLink href={`/materia/${topic.subject_id}`} label="Temas" />
      {editingTopic ? (
        <TopicEditor topic={topic} onSave={saveTopic} onCancel={() => setEditingTopic(false)} />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black mb-1">{topic.title}</h1>
            {topic.exam_date && (
              <p className="text-muted font-semibold mb-4">
                📅 Examen el {new Date(topic.exam_date + "T00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            )}
          </div>
          <button onClick={() => setEditingTopic(true)} className="text-k-blue font-bold text-sm mt-2 shrink-0">✏️ Editar</button>
        </div>
      )}

      {questions.length > 0 && (
        <Link
          href={`/jugar?tema=${id}`}
          className="block text-center rounded-2xl bg-k-purple text-white text-2xl font-black py-5 my-4 shadow-lg active:scale-95 transition"
        >
          ▶ ¡Jugar! ({questions.length})
        </Link>
      )}

      <Card className="mb-6">
        <h2 className="font-black text-lg mb-3">1. Fotos de los apuntes</h2>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-white/5">
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" className="size-full object-cover" />
              )}
              {p.extracted_text && (
                <span className="absolute bottom-1 left-1 text-xs bg-k-green text-white rounded px-1">✓ usada</span>
              )}
              <button onClick={() => deletePhoto(p)} className="absolute top-1 right-1 size-6 rounded-full bg-black/60 text-white text-xs">✕</button>
            </div>
          ))}
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} />
        <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <div className="flex gap-2">
          <button disabled={uploading} onClick={() => cameraInput.current?.click()} className={`${buttonClass} flex-1`}>📷 Tomar foto</button>
          <button disabled={uploading} onClick={() => galleryInput.current?.click()} className={`${buttonClass} flex-1 !bg-k-blue`}>🖼️ Galería</button>
        </div>
        {uploading && <p className="text-sm text-muted mt-2">Subiendo…</p>}
      </Card>

      <Card className="mb-6">
        <h2 className="font-black text-lg mb-1">2. Crear preguntas con Claude.ai</h2>
        <ol className="text-sm text-muted list-decimal pl-5 mb-3 space-y-1">
          <li>Copia el prompt y pégalo en un chat nuevo de claude.ai.</li>
          <li>Adjunta en ese chat las mismas fotos del tema.</li>
          <li>Copia la respuesta completa de Claude y pégala aquí abajo.</li>
        </ol>
        <button onClick={copyPrompt} className={`${buttonClass} w-full py-3 mb-3`}>
          {copied ? "✓ Prompt copiado" : "📋 Copiar prompt"}
        </button>
        <textarea
          className={`${inputClass} font-mono text-xs`}
          rows={5}
          placeholder="Pega aquí la respuesta de Claude (el bloque JSON)"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button disabled={!pasted.trim()} onClick={importPasted} className={`${buttonClass} w-full py-3 mt-2 !bg-k-green`}>
          ⬇️ Importar preguntas
        </button>
        {message && <p className="mt-3 font-semibold">{message}</p>}
        <details className="mt-4 text-sm">
          <summary className="text-muted cursor-pointer">Generar automáticamente (requiere API key de Claude)</summary>
          <button disabled={!pending || generating} onClick={generate} className={`${buttonClass} w-full py-2 mt-2 !bg-k-blue`}>
            {generating ? "🤖 Leyendo tus apuntes… (puede tardar 1 minuto)" : pending ? `✨ Generar con ${pending} foto(s) nueva(s)` : "Sube fotos nuevas para generar más"}
          </button>
        </details>
      </Card>

      {questions.length > 0 && (
        <>
          <h2 className="font-black text-lg mb-1">3. Revisa las preguntas</h2>
          <p className="text-sm text-muted mb-3">La IA puede leer mal la letra a mano: corrige o borra lo que no esté bien.</p>
          <div className="space-y-3">
            {questions.map((q, i) =>
              editing === q.id ? (
                <QuestionEditor key={q.id} question={q} onSave={saveQuestion} onCancel={() => setEditing(null)} />
              ) : (
                <Card key={q.id}>
                  <p className="font-bold mb-2">{i + 1}. {q.prompt}</p>
                  <ul className="text-sm space-y-1 mb-2">
                    {q.options.map((o, j) => (
                      <li key={j} className={j === q.correct_index ? "font-bold text-k-green" : "text-muted"}>
                        {j === q.correct_index ? "✓" : "·"} {o}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted italic mb-2">{q.explanation}</p>
                  <div className="flex gap-4 text-sm font-bold">
                    <button onClick={() => setEditing(q.id)} className="text-k-blue">Editar</button>
                    <button onClick={() => deleteQuestion(q.id)} className="text-k-red">Borrar</button>
                  </div>
                </Card>
              ),
            )}
          </div>
        </>
      )}

      <button onClick={deleteTopic} className="mt-10 text-sm text-k-red font-bold">Borrar tema</button>
    </Page>
  );
}

function QuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: Question;
  onSave: (q: Question) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState(question);
  return (
    <Card className="space-y-2 ring-2 ring-k-purple">
      <textarea className={inputClass} rows={2} value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} />
      {q.options.map((o, j) => (
        <label key={j} className="flex items-center gap-2">
          <input type="radio" checked={q.correct_index === j} onChange={() => setQ({ ...q, correct_index: j })} />
          <input
            className={inputClass}
            value={o}
            disabled={q.kind === "vf"}
            onChange={(e) => setQ({ ...q, options: q.options.map((x, k) => (k === j ? e.target.value : x)) })}
          />
        </label>
      ))}
      <textarea className={inputClass} rows={2} value={q.explanation} placeholder="Explicación" onChange={(e) => setQ({ ...q, explanation: e.target.value })} />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 font-bold text-muted">Cancelar</button>
        <button onClick={() => onSave(q)} className={buttonClass}>Guardar</button>
      </div>
    </Card>
  );
}

function TopicEditor({
  topic,
  onSave,
  onCancel,
}: {
  topic: Topic;
  onSave: (title: string, examDate: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(topic.title);
  const [examDate, setExamDate] = useState(topic.exam_date ?? "");
  return (
    <Card className="space-y-2 mb-4 ring-2 ring-k-purple">
      <label className="block text-sm font-bold">
        Nombre del tema
        <input className={`${inputClass} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm font-bold">
        Fecha del examen (opcional)
        <input type="date" className={`${inputClass} mt-1`} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 font-bold text-muted">Cancelar</button>
        <button disabled={!title.trim()} onClick={() => onSave(title.trim(), examDate)} className={buttonClass}>Guardar</button>
      </div>
    </Card>
  );
}
