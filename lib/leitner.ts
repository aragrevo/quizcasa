// Repaso espaciado tipo Leitner: cada acierto sube la pregunta de caja y la
// aleja en el tiempo; un fallo la devuelve a la caja 1 (vuelve mañana).
const INTERVAL_DAYS = [1, 1, 3, 7, 14, 30];
const MAX_BOX = INTERVAL_DAYS.length - 1;

export function nextReviewState(box: number, correct: boolean, now = new Date()) {
  const newBox = correct ? Math.min(box + 1, MAX_BOX) : 1;
  const next = new Date(now);
  next.setDate(next.getDate() + INTERVAL_DAYS[newBox]);
  // Desde el inicio de ese día, no a la hora exacta en que se respondió:
  // así lo fallado hoy aparece en el repaso desde primera hora de mañana.
  next.setHours(0, 0, 0, 0);
  return { box: newBox, next_review: next.toISOString() };
}
