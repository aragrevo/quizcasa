import Link from "next/link";
import { Rocket, Star } from "@/components/art";

export function ReviewCard({ dueCount }: { dueCount: number }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#18181a] p-6 sm:p-8 mb-8 shadow-xl ring-1 ring-white/5">
      <svg viewBox="0 0 300 200" className="absolute right-0 bottom-0 h-full w-auto" aria-hidden>
        <path d="M120 200 C140 150 190 150 220 120 C250 92 270 70 300 64 V200Z" fill="#2a2a2d" />
        <Star x={150} y={40} size={0.8} color="#ff7f32" rotate={10} />
        <Star x={170} y={70} size={0.45} color="#a970ff" />
        <Star x={200} y={150} size={0.7} color="#ff7f32" rotate={-8} />
        <Star x={236} y={175} size={0.5} color="#a970ff" />
        <Star x={286} y={128} size={0.5} color="#ffc845" />
      </svg>
      <Rocket className="absolute -right-4 -top-4 size-36 sm:size-48" />

      <div className="relative max-w-[62%] sm:max-w-[65%]">
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-white/80 mb-2">
          {dueCount ? "Sigue donde lo dejaste…" : "Estás al día"}
        </p>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
          {dueCount ? "Repaso de hoy" : "Nada pendiente hoy"}
        </h2>
        <p className="text-sm text-white/85 mb-5">
          {dueCount
            ? `Tienes ${dueCount} pregunta${dueCount === 1 ? "" : "s"} para repasar hoy, así no se te olvidan antes del examen.`
            : "Las preguntas que falles volverán aquí para repasarlas. ¡Elige un tema y juega!"}
        </p>
        {dueCount > 0 && (
          <Link
            href="/jugar?modo=repaso"
            className="inline-flex items-center gap-3 rounded-xl bg-[#1a7fe0] px-5 py-3 font-extrabold text-white shadow-lg active:scale-95 transition"
          >
            Empezar repaso <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </section>
  );
}
