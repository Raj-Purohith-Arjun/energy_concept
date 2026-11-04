import type { ReactNode } from "react";

interface CollapsibleProps {
  headingId: string;
  heading: string;
  /** Shown beside the heading, e.g. "4 caveats" (already pluralised). */
  note: string;
  className?: string;
  children: ReactNode;
}

// Native <details>, closed by default: the summary names the section and how
// many items it holds, so a skimming reader knows what they are skipping. No
// JavaScript; fragment links into a closed <details> open it in Chromium.
export function Collapsible({ headingId, heading, note, className = "", children }: CollapsibleProps) {
  return (
    <section aria-labelledby={headingId} className={`mt-12 ${className}`}>
      <details>
        <summary className="flex min-h-11 cursor-pointer flex-wrap items-baseline gap-x-3 py-2">
          <h2 id={headingId} className="h-section">
            {heading}
          </h2>
          <span className="text-sm">{note}</span>
        </summary>
        {children}
      </details>
    </section>
  );
}
