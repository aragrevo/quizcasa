"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BackLink, Card, Page, buttonClass, inputClass } from "@/components/ui";

export default function CuentaPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Mínimo 6 caracteres");
    if (password !== repeat) return setError("Las contraseñas no coinciden");
    setStatus("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("idle");
      setError(error.message);
      return;
    }
    setPassword("");
    setRepeat("");
    setStatus("saved");
  }

  return (
    <Page>
      <BackLink href="/" label="Inicio" />
      <h1 className="text-3xl font-black mb-1">Cuenta</h1>
      <p className="text-muted mb-6">{email}</p>

      <Card>
        <h2 className="font-black mb-1">Contraseña</h2>
        <p className="text-sm text-muted mb-4">
          Con tu correo y esta contraseña se puede entrar desde cualquier celular, sin enlaces por correo.
        </p>
        <form onSubmit={save} className="space-y-3">
          <input type="email" value={email} autoComplete="username" readOnly hidden />
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            placeholder="Repite la contraseña"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
          {error && <p className="text-k-red text-sm">{error}</p>}
          {status === "saved" && <p className="text-k-green text-sm font-bold">✓ Contraseña guardada</p>}
          <button disabled={status === "saving"} className={buttonClass}>
            {status === "saving" ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      </Card>
    </Page>
  );
}
