import { ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, geminiClient, geminiErrorResponse } from "@/lib/gemini";
import { buildLessonPrompt, LessonSchema, type Lesson } from "@/lib/prompts";

export const maxDuration = 120;

const BodySchema = z.object({ topicId: z.string().uuid() });

// Crea el repaso del tema a partir de sus apuntes y lo guarda en topics.lesson.
export async function POST(request: Request) {
  const ai = geminiClient();
  if (ai instanceof NextResponse) return ai;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  const { topicId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // RLS: solo el tema y los apuntes del usuario.
  const [{ data: topic }, { data: photos }] = await Promise.all([
    supabase.from("topics").select("title, subjects(name)").eq("id", topicId).single(),
    supabase.from("photos").select("extracted_text").eq("topic_id", topicId).not("extracted_text", "is", null),
  ]);
  if (!topic) return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  const notes = (photos ?? []).map((p) => p.extracted_text as string).filter((t) => t.trim());
  if (!notes.length) return NextResponse.json({ error: "Este tema aún no tiene apuntes transcritos" }, { status: 400 });

  const prompt = buildLessonPrompt({
    subject: (topic.subjects as unknown as { name: string } | null)?.name ?? "",
    topic: topic.title,
    notes,
  });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(LessonSchema),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    text = response.text;
  } catch (error) {
    return geminiErrorResponse(error);
  }

  let data: unknown = null;
  try {
    data = JSON.parse(text ?? "");
  } catch {
    // Se trata abajo como respuesta inválida.
  }
  const result = LessonSchema.safeParse(data);
  // El esquema no puede expresar rangos: se descartan las comprobaciones mal formadas.
  const cards = (result.success ? result.data.cards : []).filter(
    (c) =>
      c.title.trim() &&
      c.idea.trim() &&
      c.check.options.length >= 2 &&
      c.check.correct_index >= 0 &&
      c.check.correct_index < c.check.options.length,
  );
  if (cards.length < 3) {
    return NextResponse.json({ error: "Gemini devolvió un repaso incompleto, inténtalo de nuevo" }, { status: 502 });
  }

  const lesson: Lesson = { cards: cards.slice(0, 8) };
  const { error } = await supabase.from("topics").update({ lesson }).eq("id", topicId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lesson });
}
