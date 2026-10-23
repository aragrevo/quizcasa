"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="min-h-dvh bg-k-purple text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-5xl font-black text-center mb-2">QuizCasa</h1>
        <p className="text-center opacity-80 mb-8">Estudia jugando con tus propios apuntes</p>
        {status === "sent" ? (
          <div className="bg-white/10 rounded-2xl p-6 text-center animate-pop">
            <p className="text-3xl mb-2">📬</p>
            <p className="font-bold">Revisa tu correo</p>
            <p className="opacity-80 text-sm mt-1">Te enviamos un enlace para entrar a {email}</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 text-foreground space-y-4 shadow-xl">
            <label className="block font-bold text-gray-800">
              Correo de la familia
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-k-purple"
                placeholder="tucorreo@ejemplo.com"
              />
            </label>
            <button
              disabled={status === "sending"}
              className="w-full rounded-xl bg-gray-900 text-white font-black py-3 disabled:opacity-50"
            >
              {status === "sending" ? "Enviando…" : "Entrar con enlace mágico"}
            </button>
            {status === "error" && <p className="text-k-red text-sm">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
