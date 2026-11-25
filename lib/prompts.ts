import { z } from "zod";
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

// Repaso corto del tema que se muestra antes de cada partida: una tarjeta por
// idea clave, con una pregunta de comprobación para que no la pase sin leer.
export const LessonSchema = z.object({
  cards: z.array(
    z.object({
      title: z.string(),
      idea: z.string(),
      example: z.string(),
      check: z.object({
        prompt: z.string(),
        options: z.array(z.string()),
        correct_index: z.number().int(),
        explanation: z.string(),
      }),
    }),
  ),
});

export type Lesson = z.infer<typeof LessonSchema>;

// La app muestra texto plano (Claude.ai sí renderiza Markdown y LaTeX).
const PLAIN_TEXT_RULE = `Formato: la app solo muestra texto plano. No uses LaTeX ni Markdown (nada de $, \\text, **, # ni listas con -). Escribe las fórmulas con símbolos normales: ×, ÷, ², ³, √, π, ≤, ≥, y las fracciones como 3/4. Ejemplo: Soma = −5 + (−2,5) + 1 + 4,5`;

export function buildLessonPrompt({ subject, topic, notes }: { subject: string; topic: string; notes: string[] }) {
  return `Eres un profesor de secundaria (12-15 años). Antes de hacer un quiz, tu alumno va a repasar el tema con unas tarjetas cortas en el celular. Prepara ese repaso.

Materia: ${subject}
Tema: ${topic}

Apuntes del alumno (transcritos de sus fotos):
"""
${uniqueTexts(notes).join("\n\n")}
"""

Reglas:
- Entre 5 y 8 tarjetas ("cards"), una por idea clave del tema, en orden lógico (de lo básico a lo que se apoya en ello). Cubre lo más importante para el examen.
- Basa todo SOLO en los apuntes y usa sus mismos términos.
- "title": la idea en pocas palabras (máximo ~6).
- "idea": la explicación en 2-3 frases cortas y claras, como se lo explicarías a un alumno de esa edad.
- "example": un ejemplo concreto, un caso o, si es un ejercicio, un mini ejercicio resuelto paso a paso. Una o dos frases.
- "check": una pregunta rápida que compruebe que entendió ESA tarjeta (no que la memorizó). "options": 3 opciones, con distractores plausibles (errores típicos), nunca absurdos. "correct_index": posición (desde 0) de la correcta; repártela entre las opciones. "explanation": una frase de por qué es la correcta.
- Mismo idioma que los apuntes (si están en portugués, usa portugués de Portugal).
- Tono cercano y animado, sin sermones.
${PLAIN_TEXT_RULE}`;
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
