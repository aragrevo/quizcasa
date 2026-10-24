import { z } from "zod";

export const QuizSchema = z.object({
  transcription: z.string(),
  questions: z.array(
    z.object({
      kind: z.enum(["mc", "vf"]),
      prompt: z.string(),
      options: z.array(z.string()),
      correct_index: z.number().int(),
      explanation: z.string(),
      difficulty: z.number().int(),
    }),
  ),
});

export type Quiz = z.infer<typeof QuizSchema>;

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
      "difficulty": 1
    },
    {
      "kind": "vf",
      "prompt": "Afirmación para juzgar.",
      "options": ["Verdadero", "Falso"],
      "correct_index": 0,
      "explanation": "Por qué.",
      "difficulty": 2
    }
  ]
}
\`\`\``;
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
export function toQuestionRows(quiz: Quiz, topicId: string) {
  return quiz.questions
    // Respeta el idioma de "Verdadeiro/Falso" si vienen las dos opciones.
    .map((q) => (q.kind === "vf" && q.options.length !== 2 ? { ...q, options: ["Verdadero", "Falso"] } : q))
    .filter(
      (q) =>
        q.prompt.trim() &&
        (q.kind === "vf" || q.options.length >= 2) &&
        q.correct_index >= 0 &&
        q.correct_index < q.options.length,
    )
    .map((q) => ({
      topic_id: topicId,
      kind: q.kind,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      difficulty: Math.min(3, Math.max(1, q.difficulty)),
    }));
}
