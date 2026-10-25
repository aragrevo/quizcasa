import type { Question } from "@/lib/types";

// Igual que el máximo de preguntas de una partida normal.
export const MAX_MISSED = 15;

export type QuestionWithAttempts = Question & { attempts: { correct: boolean }[] };

export function missCount(q: QuestionWithAttempts) {
  return q.attempts.filter((a) => !a.correct).length;
}

// Las preguntas falladas alguna vez, de más a menos fallos; a igual número de
// fallos va primero la que tiene peor porcentaje de acierto.
export function mostMissed(qs: QuestionWithAttempts[], limit = MAX_MISSED) {
  const missRate = (q: QuestionWithAttempts) => missCount(q) / q.attempts.length;
  return qs
    .filter((q) => missCount(q) > 0)
    .sort((a, b) => missCount(b) - missCount(a) || missRate(b) - missRate(a))
    .slice(0, limit);
}
