"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { nextReviewState } from "@/lib/leitner";
import type { Question } from "@/lib/types";

const SECONDS = 20;
const MAX_QUESTIONS = 20;
const ANSWER_STYLES = [
  { bg: "bg-k-red", shape: "▲" },
  { bg: "bg-k-blue", shape: "◆" },
  { bg: "bg-k-yellow", shape: "●" },
  { bg: "bg-k-green", shape: "■" },
];

type Result = { question: Question; chosen: number | null; correct: boolean; points: number };

function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Empieza por lo fácil y sube de dificultad, mezclando dentro de cada nivel.
function orderByDifficulty(qs: Question[]) {
  return [1, 2, 3].flatMap((d) => shuffle(qs.filter((q) => q.difficulty === d)));
}

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 180;
    osc.type = ok ? "triangle" : "sawtooth";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Sin audio disponible: el juego sigue igual.
  }
}

export default function PlayPage() {
  return (
    <Suspense>
      <Game />
    </Suspense>
  );
}

function Game() {
  const params = useSearchParams();
  const topicId = params.get("tema");
  const supabase = createClient();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"countdown" | "question" | "feedback" | "end">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const [results, setResults] = useState<Result[]>([]);
  const [streak, setStreak] = useState(0);
  const startedAt = useRef(0);

  const loadQuestions = useCallback(async () => {
    let query = supabase.from("questions").select("*");
    query = topicId ? query.eq("topic_id", topicId) : query.lte("next_review", new Date().toISOString());
    const { data } = await query;
    // Primero se elige una muestra al azar y luego se ordena: si se ordenara antes,
    // recortar a MAX_QUESTIONS dejaría siempre fuera las difíciles.
    const sample = shuffle(data ?? []).slice(0, MAX_QUESTIONS);
    setQuestions(topicId ? orderByDifficulty(sample) : sample);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  function restart(qs: Question[]) {
    setQuestions(qs);
    setIndex(0);
    setResults([]);
    setStreak(0);
    setCountdown(3);
    setPhase("countdown");
  }

  useEffect(() => {
    if (phase !== "countdown" || !questions?.length) return;
    if (countdown === 0) {
      setPhase("question");
      setTimeLeft(SECONDS);
      startedAt.current = Date.now();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown, questions]);

  const answer = useCallback(
    (chosen: number | null) => {
      if (!questions || phase !== "question") return;
      const q = questions[index];
      const elapsed = Date.now() - startedAt.current;
      const correct = chosen === q.correct_index;
      const newStreak = correct ? streak + 1 : 0;
      // Puntaje tipo Kahoot: 500 por acertar + hasta 500 por rapidez + bonus de racha.
      const points = correct
        ? 500 + Math.round(500 * Math.max(0, 1 - elapsed / (SECONDS * 1000))) + Math.min(newStreak - 1, 5) * 100
        : 0;
      beep(correct);
      setStreak(newStreak);
      setResults((r) => [...r, { question: q, chosen, correct, points }]);
      setPhase("feedback");

      supabase.from("attempts").insert({ question_id: q.id, correct, time_ms: Math.min(elapsed, SECONDS * 1000) }).then();
      supabase.from("questions").update(nextReviewState(q.box, correct)).eq("id", q.id).then();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, phase, index, streak],
  );

  useEffect(() => {
    if (phase !== "question") return;
    if (timeLeft === 0) {
      answer(null);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, answer]);

  function next() {
    if (!questions) return;
    if (index + 1 >= questions.length) {
      setPhase("end");
    } else {
      setIndex(index + 1);
      setTimeLeft(SECONDS);
      startedAt.current = Date.now();
      setPhase("question");
    }
  }

  const backHref = topicId ? `/tema/${topicId}` : "/";
  const score = results.reduce((s, r) => s + r.points, 0);

  if (!questions) return <Screen>Cargando…</Screen>;

  if (!questions.length) {
    return (
      <Screen>
        <p className="text-5xl mb-4">🎉</p>
        <p className="text-2xl font-black mb-6">No hay preguntas pendientes</p>
        <Link href={backHref} className="rounded-xl bg-white text-k-purple font-black px-6 py-3">Volver</Link>
      </Screen>
    );
  }

  if (phase === "countdown") {
    return (
      <Screen>
        <p className="text-xl font-bold opacity-80 mb-4">{topicId ? "¿Listo?" : "Repaso de hoy"}</p>
        <p key={countdown} className="text-9xl font-black animate-pop">{countdown || "¡Ya!"}</p>
      </Screen>
    );
  }

  if (phase === "end") {
    const correctCount = results.filter((r) => r.correct).length;
    const pct = Math.round((correctCount / results.length) * 100);
    const missed = results.filter((r) => !r.correct);
    return (
      <Screen>
        <div className="w-full max-w-lg">
          <p className="text-6xl text-center mb-2 animate-pop">{pct >= 80 ? "🏆" : pct >= 50 ? "💪" : "📚"}</p>
          <p className="text-center text-4xl font-black">{score.toLocaleString("es")} pts</p>
          <p className="text-center text-lg opacity-90 mb-6">
            {correctCount} de {results.length} correctas ({pct}%)
            {pct >= 80 ? " · ¡Excelente!" : pct >= 50 ? " · ¡Vas bien!" : " · Repasemos lo que falló"}
          </p>
          {missed.length > 0 && (
            <div className="bg-white/10 rounded-2xl p-4 mb-6 space-y-3 max-h-[40dvh] overflow-y-auto text-left">
              <p className="font-black">Para repasar:</p>
              {missed.map((r) => (
                <div key={r.question.id} className="text-sm">
                  <p className="font-bold">{r.question.prompt}</p>
                  <p className="text-green-300">✓ {r.question.options[r.question.correct_index]}</p>
                  <p className="opacity-80 italic">{r.question.explanation}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-3">
            {missed.length > 0 && (
              <button onClick={() => restart(shuffle(missed.map((r) => r.question)))} className="rounded-xl bg-k-yellow font-black py-3">
                🔁 Repetir las {missed.length} falladas
              </button>
            )}
            <button onClick={() => restart(orderByDifficulty(questions))} className="rounded-xl bg-white/20 font-black py-3">
              Jugar otra vez
            </button>
            <Link href={backHref} className="text-center font-bold opacity-80 py-2">Salir</Link>
          </div>
        </div>
      </Screen>
    );
  }

  const q = questions[index];
  const last = results[results.length - 1];

  return (
    <main className="min-h-dvh bg-k-purple text-white flex flex-col p-3 gap-3">
      <div className="flex items-center justify-between font-black">
        <Link href={backHref} className="opacity-70">✕</Link>
        <span>{index + 1} / {questions.length}</span>
        <span>{score.toLocaleString("es")} pts {streak >= 2 && `🔥${streak}`}</span>
      </div>

      <div className="bg-white text-gray-900 rounded-2xl p-5 min-h-32 flex items-center justify-center text-center shadow-lg">
        <p className="text-xl sm:text-2xl font-extrabold">{q.prompt}</p>
      </div>

      {phase === "question" && (
        <div className="flex justify-center">
          <span className={`size-14 rounded-full flex items-center justify-center text-2xl font-black ${timeLeft <= 5 ? "bg-k-red animate-pulse" : "bg-white/20"}`}>
            {timeLeft}
          </span>
        </div>
      )}

      {phase === "feedback" && last && (
        <div className={`rounded-2xl p-4 text-center animate-pop ${last.correct ? "bg-k-green" : "bg-k-red"}`}>
          <p className="text-2xl font-black">
            {last.correct ? `¡Correcto! +${last.points}` : last.chosen === null ? "⏰ Se acabó el tiempo" : "Incorrecto"}
          </p>
          {!last.correct && <p className="font-bold">Respuesta: {q.options[q.correct_index]}</p>}
          <p className="text-sm mt-1 opacity-95">{q.explanation}</p>
        </div>
      )}

      <div className={`grid gap-3 flex-1 ${q.options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {q.options.map((option, i) => {
          const style = ANSWER_STYLES[i % ANSWER_STYLES.length];
          const dim = phase === "feedback" && i !== q.correct_index && i !== last?.chosen;
          return (
            <button
              key={i}
              disabled={phase !== "question"}
              onClick={() => answer(i)}
              className={`${style.bg} rounded-2xl p-4 flex items-center gap-3 text-left font-extrabold text-lg shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-1 active:shadow-none transition min-h-16 ${dim ? "opacity-30" : ""}`}
            >
              <span className="text-2xl">{style.shape}</span>
              <span className="flex-1">{option}</span>
              {phase === "feedback" && i === q.correct_index && <span className="text-2xl">✓</span>}
              {phase === "feedback" && i === last?.chosen && !last.correct && <span className="text-2xl">✕</span>}
            </button>
          );
        })}
      </div>

      {phase === "feedback" && (
        <button onClick={next} className="rounded-xl bg-white text-k-purple font-black py-4 text-xl">
          {index + 1 >= questions.length ? "Ver resultados" : "Siguiente →"}
        </button>
      )}
    </main>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-k-purple text-white flex flex-col items-center justify-center p-4 text-center">
      {children}
    </main>
  );
}
