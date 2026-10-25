"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const fieldClass =
  "mt-1 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-k-purple";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // "password": entrar con contraseña (sirve en cualquier celular, también la app instalada).
  // "link": enlace mágico, solo funciona abriéndolo en este mismo navegador.
  const [mode, setMode] = useState<"password" | "link">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        setError(
          error.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos. Si aún no tienes contraseña, entra primero con el enlace y créala en ⚙️ Cuenta."
            : error.message,
        );
        return;
      }
      router.replace("/");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setBusy(false);
      if (error) setError(error.message);
      else setSent(true);
    }
  }

  function switchMode() {
    setMode(mode === "password" ? "link" : "password");
    setError("");
    setSent(false);
  }

  return (
    <main className="min-h-dvh bg-k-purple text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-5xl font-black text-center mb-2">QuizCasa</h1>
        <p className="text-center opacity-80 mb-8">Estudia jugando con tus propios apuntes</p>
        {sent ? (
          <div className="bg-white/10 rounded-2xl p-6 text-center animate-pop">
            <p className="text-3xl mb-2">📬</p>
            <p className="font-bold">Revisa tu correo</p>
            <p className="opacity-80 text-sm mt-1">
              Abre el enlace en este mismo dispositivo y navegador. Luego crea una contraseña en ⚙️ Cuenta.
            </p>
            <button onClick={switchMode} className="mt-4 text-sm font-bold underline">
              Volver
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 text-foreground space-y-4 shadow-xl">
            <label className="block font-bold text-gray-800">
              Correo de la familia
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
                placeholder="tucorreo@ejemplo.com"
              />
            </label>
            {mode === "password" && (
              <label className="block font-bold text-gray-800">
                Contraseña
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldClass}
                />
              </label>
            )}
            <button disabled={busy} className="w-full rounded-xl bg-gray-900 text-white font-black py-3 disabled:opacity-50">
              {busy ? "Un momento…" : mode === "password" ? "Entrar" : "Enviar enlace"}
            </button>
            {error && <p className="text-k-red text-sm">{error}</p>}
            <button type="button" onClick={switchMode} className="block w-full text-center text-sm font-bold text-k-purple">
              {mode === "password" ? "¿Sin contraseña? Entrar con enlace por correo" : "Entrar con contraseña"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
