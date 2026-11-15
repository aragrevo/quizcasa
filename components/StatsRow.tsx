import { Card } from "@/components/ui";
import type { summarize } from "@/lib/stats";

type Props = Pick<ReturnType<typeof summarize>, "streak" | "accuracy" | "thisWeek" | "minutesWeek">;

// Racha, aciertos (30 días), respuestas y minutos de los últimos 7 días.
export function StatsRow({ streak, accuracy, thisWeek, minutesWeek }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <Stat label="Racha" value={`🔥 ${streak} día${streak === 1 ? "" : "s"}`} />
      <Stat label="Aciertos (30 días)" value={`${accuracy}%`} />
      <Stat label="Respuestas (7 días)" value={String(thisWeek.length)} />
      <Stat label="Minutos (7 días)" value={String(minutesWeek)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs text-muted font-bold">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </Card>
  );
}
