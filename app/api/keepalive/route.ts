import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Supabase pausa los proyectos gratis tras 7 días sin actividad (p. ej. en vacaciones).
// Vercel Cron llama a esta ruta una vez al día (vercel.json) con una consulta mínima.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const supabase = createClient(
    supabaseUrl,
    supabaseKey,
  );
  const { error } = await supabase.from("subjects").select("id").limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
