import { ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, geminiClient, geminiErrorResponse } from "@/lib/gemini";
import { buildVariantsPrompt, toQuestionRow, VariantsSchema } from "@/lib/prompts";
import type { Question } from "@/lib/types";

export const maxDuration = 120;

// Igual que el máximo de preguntas de una partida (MAX_MISSED).
const BodySchema = z.object({
  topicId: z.string().uuid(),
  questionIds: z.array(z.string().uuid()).min(1).max(15),
});

// Crea una variante de cada pregunta indicada y retira las originales.
export async function POST(request: Request) {
  const ai = geminiClient();
  if (ai instanceof NextResponse) return ai;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  const { topicId, questionIds } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // RLS: solo preguntas y apuntes del usuario.
  const [{ data: topic }, { data: qs }, { data: photos }] = await Promise.all([
    supabase.from("topics").select("title, subjects(name)").eq("id", topicId).single(),
    supabase.from("questions").select("*").in("id", questionIds).eq("topic_id", topicId).eq("retired", false),
    supabase.from("photos").select("extracted_text").eq("topic_id", topicId).not("extracted_text", "is", null),
  ]);
  const sources = (qs ?? []) as Question[];
  if (!topic || !sources.length) return NextResponse.json({ error: "Preguntas no encontradas" }, { status: 404 });

  const prompt = buildVariantsPrompt({
    subject: (topic.subjects as unknown as { name: string } | null)?.name ?? "",
    topic: topic.title,
    questions: sources,
    notes: (photos ?? []).map((p) => p.extracted_text as string),
  });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(VariantsSchema),
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
  const result = VariantsSchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json({ error: "Gemini devolvió una respuesta incompleta, inténtalo de nuevo" }, { status: 502 });
  }

  // Una variante por pregunta original; se descartan las repetidas o inválidas.
  const used = new Set<number>();
  const rows = [];
  const replaced: string[] = [];
  for (const v of result.data.variants) {
    const src = sources[v.source];
    const row = src && !used.has(v.source) ? toQuestionRow(v, topicId) : null;
    if (!src || !row) continue;
    used.add(v.source);
    replaced.push(src.id);
    // Mismo concepto: hereda el estado Leitner de la original.
    rows.push({ ...row, variant_of: src.variant_of ?? src.id, box: src.box, next_review: src.next_review });
  }
  if (!rows.length) return NextResponse.json({ error: "No se pudo crear ninguna variante válida" }, { status: 502 });

  // Primero se insertan las variantes y luego se retiran las originales: si algo
  // falla a mitad, como mucho queda un concepto duplicado, nunca uno perdido.
  const { data: inserted, error: insertError } = await supabase
    .from("questions")
    .insert(rows)
    .select("*, topics(title, subjects(name))");
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: retireError } = await supabase.from("questions").update({ retired: true }).in("id", replaced);
  if (retireError) console.error("No se pudieron retirar las originales", retireError.message);

  return NextResponse.json({ questions: inserted });
}
