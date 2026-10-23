import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt, QuizSchema, toQuestionRows, type Quiz } from "@/lib/prompts";

export const maxDuration = 300;

// Las claves de usuario (sk-ant-usr...) no pertenecen a un workspace y necesitan indicarlo.
const anthropic = new Anthropic(
  process.env.ANTHROPIC_WORKSPACE_ID
    ? { defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } }
    : {},
);

export async function POST(request: Request) {
  const { topicId } = (await request.json()) as { topicId: string };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: topic } = await supabase
    .from("topics")
    .select("title, subjects(name)")
    .eq("id", topicId)
    .single();
  if (!topic) return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });

  const { data: photos } = await supabase
    .from("photos")
    .select("id, storage_path")
    .eq("topic_id", topicId)
    .is("extracted_text", null)
    .order("created_at");
  if (!photos?.length) {
    return NextResponse.json({ error: "No hay fotos nuevas: sube fotos del tema para generar preguntas" }, { status: 400 });
  }

  const images: Anthropic.Beta.BetaImageBlockParam[] = [];
  for (const photo of photos) {
    const { data: blob, error } = await supabase.storage.from("photos").download(photo.storage_path);
    if (error || !blob) {
      return NextResponse.json({ error: "No se pudo leer una foto" }, { status: 500 });
    }
    images.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: Buffer.from(await blob.arrayBuffer()).toString("base64"),
      },
    });
  }

  const subject = (topic.subjects as unknown as { name: string } | null)?.name ?? "";

  let quiz: Quiz;
  try {
    const response = await anthropic.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(QuizSchema) },
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            ...images,
            { type: "text", text: `Materia: ${subject}\nTema: ${topic.title}\n\nGenera el quiz.` },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Claude no pudo procesar estas fotos" }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return NextResponse.json({ error: "La respuesta llegó incompleta, inténtalo de nuevo" }, { status: 502 });
    }
    quiz = response.parsed_output;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "API key de Claude inválida" }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Demasiadas solicitudes, espera un minuto" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API error", error.status, error.message);
      const detail = (error.error as { error?: { message?: string } } | undefined)?.error?.message;
      return NextResponse.json({ error: `Error de Claude (${error.status}): ${detail ?? error.message}` }, { status: 502 });
    }
    throw error;
  }

  const rows = toQuestionRows(quiz, topicId);

  const { error: insertError } = await supabase.from("questions").insert(rows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Marca las fotos como procesadas para no generar preguntas repetidas.
  await supabase
    .from("photos")
    .update({ extracted_text: quiz.transcription })
    .in("id", photos.map((p) => p.id));

  return NextResponse.json({ created: rows.length });
}
