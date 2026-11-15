// Estadísticas de los intentos, usadas por el inicio y el panel.

export const ATTEMPT_FIELDS =
  "correct, time_ms, created_at, questions(id, prompt, options, correct_index, topics(id, title, subjects(name, emoji, color)))";

export type AttemptRow = {
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

export type Bucket = { label: string; color?: string; total: number; correct: number };

function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function computeStreak(days: Set<string>, now: number) {
  const d = new Date(now);
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

// `now` es el momento de la carga: "últimos 7 días" y la racha se calculan respecto a él.
export function summarize(rows: AttemptRow[], now: number) {
  const valid = rows.filter((r) => r.questions);
  const weekAgo = now - 7 * 86400000;
  const thisWeek = valid.filter((r) => new Date(r.created_at).getTime() >= weekAgo);
  const minutesWeek = Math.round(thisWeek.reduce((s, r) => s + r.time_ms, 0) / 60000);
  const streak = computeStreak(new Set(valid.map((r) => dayKey(new Date(r.created_at)))), now);
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

  return { valid, thisWeek, minutesWeek, streak, accuracy, subjects: [...bySubject.values()], weakTopics, mostMissed };
}
