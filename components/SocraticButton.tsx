"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "model"; text: string };

// Primer mensaje del alumno, que no se muestra: Gemini necesita que la
// conversación empiece con un turno del usuario.
const OPENER: Message = { role: "user", text: "Hola, fallé esta pregunta. ¿Me ayudas a entenderla?" };

// Botón "🤔 Entenderlo" que abre el chat con el tutor socrático (Gemini, /api/tutor).
// `getPrompt` arma el mismo prompt para copiarlo a Claude.ai si el chat falla.
export function SocraticButton({
  questionId,
  chosen,
  getPrompt,
  className = "",
}: {
  questionId: string;
  // Texto de la opción elegida; null si se acabó el tiempo o no se sabe.
  chosen: string | null;
  getPrompt: () => string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        🤔 Entenderlo
      </button>
      {open && <TutorChat questionId={questionId} chosen={chosen} getPrompt={getPrompt} onClose={() => setOpen(false)} />}
    </>
  );
}

function TutorChat({
  questionId,
  chosen,
  getPrompt,
  onClose,
}: {
  questionId: string;
  chosen: string | null;
  getPrompt: () => string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Envía la conversación (que siempre termina en un turno del alumno) y va
  // añadiendo la respuesta del tutor a medida que llega.
  async function send(history: Message[]) {
    setMessages([...history, { role: "model", text: "" }]);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, chosen, messages: history }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo hablar con el tutor");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "model", text }]);
      }
      if (!text.trim()) throw new Error("El tutor no respondió");
    } catch (e) {
      // Se quita la respuesta a medias para poder reintentar el mismo turno.
      setMessages(history);
      setError((e as Error).message || "Se cortó la conexión");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Evita el doble envío del modo estricto de React en desarrollo.
    if (started.current) return;
    started.current = true;
    send([OPENER]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, error]);

  function submit() {
    const text = draft.trim();
    if (!text || busy || error) return;
    setDraft("");
    send([...messages, { role: "user", text }]);
  }

  function copyForClaude() {
    // Síncrono en el clic: iOS Safari rechaza el portapapeles tras un await.
    navigator.clipboard.writeText(getPrompt()).then(() => setCopied(true), () => setError("No se pudo copiar"));
    window.open("https://claude.ai/new", "_blank", "noopener");
  }

  const visible = messages.slice(1);

  return (
    <div role="dialog" aria-modal="true" aria-label="Tutor" className="fixed inset-0 z-50 flex flex-col bg-background text-foreground text-left">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="font-black text-lg">🤔 Vamos a entenderlo</p>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="size-9 rounded-full bg-white/10 font-black">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visible.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
              m.role === "user" ? "ml-auto bg-k-purple text-white" : "bg-card"
            }`}
          >
            {m.text || <span className="opacity-60">…</span>}
          </div>
        ))}
        {error && (
          <div className="rounded-2xl bg-k-red/20 p-3 text-sm">
            <p className="font-bold mb-2">{error}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => send(messages)} className="rounded-lg bg-white/15 px-3 py-1 font-bold">
                Reintentar
              </button>
              <button type="button" onClick={copyForClaude} className="rounded-lg bg-white/15 px-3 py-1 font-bold">
                {copied ? "✓ Copiado: pégalo en Claude" : "Seguir en Claude.ai"}
              </button>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <textarea
          rows={1}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Escribe tu respuesta…"
          aria-label="Tu respuesta"
          className="flex-1 resize-none rounded-xl border-2 border-white/15 bg-transparent px-3 py-2 outline-none focus:border-k-purple"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy || !!error}
          className="rounded-xl bg-k-purple px-4 font-black text-white disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
