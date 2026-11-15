import { z } from "zod";
import type { Bucket, Summary } from "@/lib/stats";
import type { Question } from "@/lib/types";

export const QuestionSchema = z.object({
  kind: z.enum(["mc", "vf"]),
  prompt: z.string(),
  options: z.array(z.string()),
  correct_index: z.number().int(),
  explanation: z.string(),
  // Opcional para que los JSON pegados antes de existir el campo sigan valiendo.
  option_feedback: z.array(z.string()).optional(),
  difficulty: z.number().int(),
});

export const QuizSchema = z.object({
  transcription: z.string(),
  questions: z.array(QuestionSchema),
});

export type Quiz = z.infer<typeof QuizSchema>;
type GeneratedQuestion = z.infer<typeof QuestionSchema>;

// "source" es la posición (desde 0) de la pregunta original en la lista enviada.
export const VariantsSchema = z.object({
  variants: z.array(QuestionSchema.extend({ source: z.number().int() })),
});

const OPTION_FEEDBACK_RULE = `- "option_feedback": una frase corta por cada opción, en el mismo orden que "options". En cada opción incorrecta, explica el error o la confusión que lleva a elegirla (por ejemplo: "Confundes la fotosíntesis con la respiración: la respiración es la que libera energía."). En la opción correcta, deja "".`;

export function buildSystemPrompt() {
  return `Eres un profesor de secundaria (12-15 años) que prepara a un alumno para sus exámenes.
Recibes fotos del cuaderno o del libro de un tema. Tu trabajo:

1. Transcribe el contenido relevante de las fotos (campo "transcription"). Si algo no se lee, indícalo con [ilegible] en lugar de inventarlo.
2. Crea entre 18 y 20 preguntas basadas SOLO en ese contenido, en el mismo idioma del material (si está en portugués, usa portugués de Portugal y los mismos términos del libro).

Reglas para las preguntas:
- Mezcla tipos: ~75% opción múltiple ("mc", exactamente 4 opciones) y ~25% verdadero/falso ("vf", options = ["Verdadero", "Falso"]).
- "correct_index" es la posición (desde 0) de la opción correcta. Reparte la posición correcta entre las 4 opciones.
- Pregunta por comprensión, no solo por memoria literal: causas, relaciones, aplicar un concepto, ejemplos. Incluye algunas de memoria (fechas, definiciones) si el tema las tiene.
- Los distractores deben ser plausibles (errores típicos de un alumno), nunca absurdos ni "todas las anteriores".
- Enunciados cortos y claros (máximo ~25 palabras), apropiados para la edad.
- "explanation": 1-2 frases que expliquen por qué la respuesta es correcta, como lo diría un buen profesor.
${OPTION_FEEDBACK_RULE}
- "difficulty": 1 (fácil), 2 (media) o 3 (difícil). Aproximadamente un tercio de cada una.
- Si el contenido incluye ejercicios (matemáticas, física), crea ejercicios similares con números distintos y opciones con los errores de cálculo típicos.`;
}

// Versión para pegar en Claude.ai junto con las fotos, cuando no hay API key.
export function buildManualPrompt(subject: string, topic: string) {
  return `${buildSystemPrompt()}

Materia: ${subject}
Tema: ${topic}

Las fotos van adjuntas. Responde SOLO con un bloque de código JSON con exactamente esta forma, sin texto antes ni después:

\`\`\`json
{
  "transcription": "texto transcrito de las fotos",
  "questions": [
    {
      "kind": "mc",
      "prompt": "¿Pregunta?",
      "options": ["opción A", "opción B", "opción C", "opción D"],
      "correct_index": 2,
      "explanation": "Por qué es correcta.",
      "option_feedback": ["Error que lleva a elegir A.", "Error que lleva a elegir B.", "", "Error que lleva a elegir D."],
      "difficulty": 1
    },
    {
      "kind": "vf",
      "prompt": "Afirmación para juzgar.",
      "options": ["Verdadero", "Falso"],
      "correct_index": 0,
      "explanation": "Por qué.",
      "option_feedback": ["", "Error que lleva a elegir Falso."],
      "difficulty": 2
    }
  ]
}
\`\`\``;
}

// Tutor socrático para pegar en Claude.ai cuando el alumno falla una pregunta:
// le hace razonar hasta llegar él mismo a la respuesta, en vez de dársela.
export function buildSocraticPrompt({
  subject,
  topic,
  question,
  chosen,
  notes,
}: {
  subject: string;
  topic: string;
  question: Pick<Question, "prompt" | "options" | "correct_index" | "explanation" | "option_feedback">;
  // Texto de la opción que eligió; null si se le acabó el tiempo o no se sabe.
  chosen: string | null;
  // Transcripciones de los apuntes del tema (photos.extracted_text).
  notes: string[];
}) {
  const uniqueNotes = uniqueTexts(notes);
  // Error típico detrás de la opción que eligió, si la pregunta lo tiene.
  const chosenFeedback = chosen === null ? "" : (question.option_feedback?.[question.options.indexOf(chosen)] ?? "");
  const options = question.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n");
  return `Eres un tutor de secundaria (12-15 años) que usa el método socrático. Un alumno acaba de fallar una pregunta de su quiz de estudio. Tu objetivo es que razone hasta llegar ÉL MISMO a la respuesta correcta y la entienda, no que la memorice.

REGLA PRINCIPAL: nunca le des la respuesta directamente, aunque te la pida.

Materia: ${subject}
Tema: ${topic}

Pregunta:
${question.prompt}

Opciones:
${options}

${chosen === null ? "El alumno no respondió: se le acabó el tiempo." : `El alumno eligió: ${chosen}`}

Solo para ti (NO la reveles):
- Respuesta correcta: ${question.options[question.correct_index]}
- Explicación: ${question.explanation}${chosenFeedback ? `\n- Error probable detrás de su elección: ${chosenFeedback}` : ""}

${uniqueNotes.length ? `Apuntes que estudió el alumno (transcritos de sus fotos). Básate en ellos y usa sus mismos términos:\n"""\n${uniqueNotes.join("\n\n")}\n"""` : "No hay transcripción de sus apuntes: básate en lo que se enseña en secundaria sobre este tema."}

Cómo llevar la conversación:
1. Empieza preguntándole por qué eligió esa opción${chosen === null ? " (o qué respondería ahora y por qué)" : ""}.
2. Haz UNA sola pregunta por mensaje, corta, que le lleve desde su error hacia la idea correcta usando sus apuntes.
3. Si se atasca 2 o 3 veces seguidas, dale una pista más directa, pero sigue sin decirle la respuesta.
4. Cuando llegue a la respuesta correcta, pídele que la explique con sus propias palabras.
5. Para terminar, hazle una pregunta nueva parecida, con otra redacción, para comprobar que lo entendió. Corrígela con él.

Escribe en el mismo idioma que la pregunta y los apuntes (si están en portugués, usa portugués de Portugal y los términos del libro). Tono cercano y animado, mensajes cortos, sin sermones. Empieza ya con tu primera pregunta.`;
}

// Al importar a mano, todas las fotos de una tanda guardan la misma transcripción.
function uniqueTexts(texts: string[]) {
  return [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
}

// Variantes de preguntas que el alumno falla mucho: el mismo concepto con otra
// redacción y otros distractores, para que no reconozca la respuesta de memoria.
export function buildVariantsPrompt({
  subject,
  topic,
  questions,
  notes,
}: {
  subject: string;
  topic: string;
  questions: Pick<Question, "kind" | "prompt" | "options" | "correct_index" | "explanation" | "difficulty">[];
  notes: string[];
}) {
  const uniqueNotes = uniqueTexts(notes);
  const list = questions
    .map(
      (q, i) =>
        `[${i}] (${q.kind}, dificultad ${q.difficulty}) ${q.prompt}\n` +
        q.options.map((o, j) => `   ${j === q.correct_index ? "✓" : "-"} ${o}`).join("\n") +
        `\n   Explicación: ${q.explanation}`,
    )
    .join("\n\n");
  return `Eres un profesor de secundaria (12-15 años) que prepara a un alumno para sus exámenes.
El alumno falla una y otra vez estas preguntas de su quiz y empieza a reconocer la respuesta correcta por su texto, sin entenderla. Crea UNA variante de cada pregunta que obligue a razonar el mismo concepto de nuevo.

Materia: ${subject}
Tema: ${topic}

Preguntas originales (✓ = correcta):
${list}

${uniqueNotes.length ? `Apuntes del alumno (transcritos de sus fotos). Básate en ellos y usa sus mismos términos:\n"""\n${uniqueNotes.join("\n\n")}\n"""` : "No hay transcripción de sus apuntes: básate en lo que se enseña en secundaria sobre este tema."}

Reglas para cada variante:
- "source": el número entre corchetes de la pregunta original. Exactamente una variante por pregunta.
- Mismo concepto y misma dificultad, pero con otra redacción Y otro enfoque: pregunta inversa, aplicar la idea a un ejemplo o caso concreto, causa↔efecto, o en ejercicios los mismos pasos con números distintos.
- Si se puede, no repitas el texto exacto de la respuesta correcta original: reformúlala.
- Mismo tipo que la original. "mc": exactamente 4 opciones, con distractores nuevos y plausibles (errores típicos de un alumno), nunca absurdos ni "todas las anteriores". "vf": options = ["Verdadero", "Falso"] (o "Verdadeiro"/"Falso" en portugués); la afirmación puede pasar a ser verdadera o falsa.
- "correct_index" es la posición (desde 0) de la opción correcta. Reparte la posición correcta entre las opciones.
- Enunciados cortos y claros (máximo ~25 palabras), apropiados para la edad.
- "explanation": 1-2 frases que expliquen por qué la respuesta es correcta.
${OPTION_FEEDBACK_RULE}
- Mismo idioma que las preguntas y los apuntes (si están en portugués, usa portugués de Portugal y los términos del libro).`;
}

// Lee la respuesta pegada desde Claude.ai: tolera texto o bloques \`\`\`json alrededor.
export function parsePastedQuiz(text: string): Quiz {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No encontré el JSON en lo que pegaste");
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("El JSON está incompleto o mal formado. Copia la respuesta completa de Claude");
  }
  const parsed = QuizSchema.safeParse(data);
  if (!parsed.success) throw new Error("El JSON no tiene el formato esperado de preguntas");
  return parsed.data;
}

// El esquema no puede expresar "4 opciones" ni rangos: se valida aquí.
// Devuelve null si la pregunta no es válida.
export function toQuestionRow(q: GeneratedQuestion, topicId: string) {
  // Respeta el idioma de "Verdadeiro/Falso" si vienen las dos opciones.
  const options = q.kind === "vf" && q.options.length !== 2 ? ["Verdadero", "Falso"] : q.options;
  const valid =
    q.prompt.trim() &&
    (q.kind === "vf" || options.length >= 2) &&
    q.correct_index >= 0 &&
    q.correct_index < options.length;
  if (!valid) return null;
  // Sin una frase por opción no se puede saber a cuál corresponde cada una.
  const feedback = q.option_feedback?.length === options.length ? q.option_feedback.map((f) => f.trim()) : [];
  return {
    topic_id: topicId,
    kind: q.kind,
    prompt: q.prompt,
    options,
    correct_index: q.correct_index,
    explanation: q.explanation,
    option_feedback: feedback,
    difficulty: Math.min(3, Math.max(1, q.difficulty)),
  };
}

export function toQuestionRows(quiz: Quiz, topicId: string) {
  return quiz.questions.map((q) => toQuestionRow(q, topicId)).filter((r) => r !== null);
}

// Resumen para el padre a partir de las estadísticas del panel (lib/stats.ts).
export function buildReportPrompt({
  summary,
  days,
  exams,
}: {
  summary: Summary;
  days: number;
  // Exámenes próximos: tema, materia y fecha (YYYY-MM-DD).
  exams: { topic: string; subject: string; date: string }[];
}) {
  const pct = (b: Bucket) => `${Math.round((b.correct / b.total) * 100)}% de ${b.total} respuestas`;
  return `Eres un tutor que informa a un padre sobre cómo estudia su hijo de secundaria (12-15 años) con una app de quizzes con repaso espaciado.

Datos de los últimos ${days} días:
- Respuestas: ${summary.valid.length}, aciertos ${summary.accuracy}%.
- Racha actual: ${summary.streak} días seguidos estudiando. Minutos en los últimos 7 días: ${summary.minutesWeek}.

Aciertos por materia:
${summary.subjects.map((b) => `- ${b.label}: ${pct(b)}`).join("\n") || "- (sin datos)"}

Temas más flojos:
${summary.weakTopics.map((b) => `- ${b.label}: ${pct(b)}`).join("\n") || "- (sin datos)"}

Preguntas que más falla (con la respuesta correcta):
${summary.mostMissed.map((b) => `- ${b.label} → ${b.answer} (falló ${b.total - b.correct} de ${b.total})`).join("\n") || "- (ninguna)"}

Próximos exámenes:
${exams.map((e) => `- ${e.date}: ${e.subject} · ${e.topic}`).join("\n") || "- (ninguno registrado)"}

Escribe un resumen de 4 a 6 frases en español, cercano y concreto, sin sermones:
1. Qué domina y cómo va la constancia.
2. Qué temas le cuestan y qué conceptos concretos falla (deduce la idea de fondo de las preguntas falladas, no las copies).
3. Qué conviene repasar antes del próximo examen, si hay alguno.
Usa solo estos datos; no inventes notas ni temas. Formato: texto plano, sin Markdown (nada de **, # ni listas).`;
}
