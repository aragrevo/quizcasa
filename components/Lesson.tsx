"use client";

import { useMemo, useState } from "react";
import type { Lesson as LessonData } from "@/lib/prompts";
import { shuffle } from "@/lib/shuffle";

const OPTION_COLORS = ["bg-k-red", "bg-k-blue", "bg-k-yellow", "bg-k-green"];

// Repaso obligatorio antes de jugar un tema: una tarjeta por idea clave y una
// pregunta de comprobación que hay que responder para pasar a la siguiente.
export function Lesson({ lesson, onDone }: { lesson: LessonData; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const card = lesson.cards[index];
  // Opciones barajadas en cada tarjeta, para que no se aprenda la posición.
  const order = useMemo(() => shuffle(card.check.options.map((_, i) => i)), [card]);
  const answered = chosen !== null;
  const last = index + 1 >= lesson.cards.length;

  function next() {
    if (last) return onDone();
    setIndex(index + 1);
    setChosen(null);
  }

  return (
    <main className="min-h-dvh bg-k-purple text-white flex flex-col p-3 gap-3">
      <div className="flex items-center gap-3 font-black">
        <span>📖 Repaso</span>
        <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${((index + (answered ? 1 : 0)) / lesson.cards.length) * 100}%` }} />
        </div>
        <span>{index + 1} / {lesson.cards.length}</span>
      </div>

      <div key={index} className="bg-white text-gray-900 rounded-2xl p-5 shadow-lg animate-pop">
        <p className="text-2xl font-black mb-2">{card.title}</p>
        <p className="text-lg leading-snug">{card.idea}</p>
        {card.example && <p className="mt-3 rounded-xl bg-gray-100 p-3 text-base">💡 {card.example}</p>}
      </div>

      <p className="font-black text-lg text-center mt-1">{card.check.prompt}</p>

      <div className="grid gap-3">
        {order.map((i, pos) => {
          const isCorrect = i === card.check.correct_index;
          const dim = answered && !isCorrect && i !== chosen;
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setChosen(i)}
              className={`${OPTION_COLORS[pos % OPTION_COLORS.length]} rounded-2xl p-4 flex items-center gap-3 text-left font-extrabold text-lg shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-1 active:shadow-none transition min-h-14 ${dim ? "opacity-30" : ""}`}
            >
              <span className="flex-1">{card.check.options[i]}</span>
              {answered && isCorrect && <span className="text-2xl">✓</span>}
              {answered && i === chosen && !isCorrect && <span className="text-2xl">✕</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <>
          <div className={`rounded-2xl p-4 text-center animate-pop ${chosen === card.check.correct_index ? "bg-k-green" : "bg-k-red"}`}>
            <p className="text-xl font-black">{chosen === card.check.correct_index ? "¡Bien!" : "Casi"}</p>
            <p className="text-sm mt-1">{card.check.explanation}</p>
          </div>
          <button onClick={next} className="rounded-xl bg-white text-k-purple font-black py-4 text-xl">
            {last ? "¡A jugar! →" : "Siguiente →"}
          </button>
        </>
      )}
    </main>
  );
}
