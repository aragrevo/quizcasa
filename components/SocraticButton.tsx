"use client";

import { useState } from "react";

// Copia el prompt del tutor socrático y abre Claude.ai en otra pestaña.
// Todo ocurre de forma síncrona en el clic: iOS Safari rechaza el portapapeles
// y las ventanas nuevas si antes hay un await de red. Por eso `getPrompt` solo
// usa datos ya cargados.
export function SocraticButton({ getPrompt, className = "" }: { getPrompt: () => string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  function onClick() {
    navigator.clipboard.writeText(getPrompt()).then(
      () => setState("copied"),
      () => setState("error"),
    );
    window.open("https://claude.ai/new", "_blank", "noopener");
    setTimeout(() => setState("idle"), 4000);
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {state === "copied" ? "✓ Copiado: pégalo en Claude" : state === "error" ? "No se pudo copiar" : "🤔 Entenderlo con Claude"}
    </button>
  );
}
