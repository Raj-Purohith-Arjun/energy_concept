import type { ReactNode } from "react";

// Native <details>, closed by default, around a section that keeps its own
// heading. Server-rendered; no JavaScript.
export function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="mt-8">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold">{title}</summary>
      {children}
    </details>
  );
}
