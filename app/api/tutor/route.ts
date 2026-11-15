import { ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, geminiClient, geminiErrorResponse } from "@/lib/gemini";
import { buildSocraticPrompt } from "@/lib/prompts";
import type { Question } from "@/lib/types";

export const maxDuration = 60;

// Límites para que una conversación no dispare el consumo de la API.
const BodySchema = z.object({
  questionId: z.string().uuid(),
  chosen: z.string().max(500).nullable(),
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().min(1).max(2000) }))
    .min(1)
    .max(40),
});

type QuestionWithTopic = Question & { topics: { title: string; subjects: { name: string } | null } | null };

export async function POST(request: Request) {
  const ai = geminiClient();
  if (ai instanceof NextResponse) return ai;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  const { questionId, chosen, messages } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // El prompt se arma aquí con datos de la BD (RLS: solo preguntas del usuario),
  // nunca con texto del cliente.
  const { data } = await supabase
    .from("questions")
    .select("*, topics(title, subjects(name))")
    .eq("id", questionId)
    .single();
  const question = data as QuestionWithTopic | null;
  if (!question) return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });

  const { data: photos } = await supabase
    .from("photos")
    .select("extracted_text")
    .eq("topic_id", question.topic_id)
    .not("extracted_text", "is", null);

  const systemInstruction = buildSocraticPrompt({
    subject: question.topics?.subjects?.name ?? "",
    topic: question.topics?.title ?? "",
    question,
    // Solo se acepta una opción real de la pregunta.
    chosen: chosen !== null && question.options.includes(chosen) ? chosen : null,
    notes: (photos ?? []).map((p) => p.extracted_text as string),
  }) +
    // El chat de la app muestra texto plano (Claude.ai sí renderiza Markdown y LaTeX).
    `\n\nFormato: el chat solo muestra texto plano. No uses LaTeX ni Markdown (nada de $, \\text, **, # ni listas con -). Escribe las fórmulas con símbolos normales: ×, ÷, ², ³, √, π, ≤, ≥, y las fracciones como 3/4. Ejemplo: Soma = −5 + (−2,5) + 1 + 4,5`;

  let stream: AsyncGenerator<{ text?: string }>;
  try {
    stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      // Poco razonamiento: el tutor hace preguntas cortas y así responde antes.
      config: { systemInstruction, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
  } catch (error) {
    return geminiErrorResponse(error);
  }

  // Se reenvía el texto tal cual llega, en trozos, para que el chat lo vaya mostrando.
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
        controller.close();
      } catch (error) {
        console.error("Gemini stream error", error);
        controller.error(error);
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
