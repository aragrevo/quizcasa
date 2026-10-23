import Link from "next/link";
import { Background } from "@/components/art";

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Background />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">{children}</main>
    </>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-block text-muted font-semibold mb-4">
      ← {label}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card rounded-2xl p-4 shadow-sm ${className}`}>{children}</div>;
}

export const inputClass =
  "w-full rounded-xl border-2 border-white/15 bg-transparent px-3 py-2 outline-none focus:border-k-purple";

export const buttonClass =
  "rounded-xl bg-k-purple text-white font-extrabold px-4 py-2 disabled:opacity-50 active:scale-95 transition";
