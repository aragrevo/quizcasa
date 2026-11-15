import { ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, geminiClient, geminiErrorResponse } from "@/lib/gemini";
import { buildReportPrompt } from "@/lib/prompts";
import { ATTEMPT_FIELDS, summarize, type AttemptRow } from "@/lib/stats";

export const maxDuration = 60;

const DAYS = 14;

// Resumen para el padre de cómo va el estudio, con los datos del propio usuario (RLS).
export async function POST() {
  const ai = geminiClient();
  if (ai instanceof NextResponse) return ai;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const now = Date.now();
  const since = new Date(now - DAYS * 86400000);
  const today = new Date(now).toLocaleDateString("en-CA");
  const [{ data: attempts }, { data: topics }] = await Promise.all([
    supabase.from("attempts").select(ATTEMPT_FIELDS).gte("created_at", since.toISOString()),
    supabase
      .from("topics")
      .select("title, exam_date, subjects(name)")
      .gte("exam_date", today)
      .order("exam_date")
      .limit(5),
  ]);

  const summary = summarize((attempts as unknown as AttemptRow[]) ?? [], now);
  if (!summary.valid.length) {
    return NextResponse.json({ error: `No hay partidas en los últimos ${DAYS} días` }, { status: 400 });
  }

  const exams = (topics ?? []).map((t) => ({
    topic: t.title,
    subject: (t.subjects as unknown as { name: string } | null)?.name ?? "",
    date: t.exam_date as string,
  }));

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildReportPrompt({ summary, days: DAYS, exams }),
      config: { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    const text = response.text?.trim();
    if (!text) return NextResponse.json({ error: "Gemini no devolvió el resumen, inténtalo de nuevo" }, { status: 502 });
    return NextResponse.json({ text });
  } catch (error) {
    return geminiErrorResponse(error);
  }
}
