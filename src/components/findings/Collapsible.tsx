import type { ReactNode } from "react";

interface CollapsibleProps {
  headingId: string;
  heading: string;
  // A "{count} ..." template from content, filled with `count`.
  countLabel: string;
  count: number;
  className?: string;
  children: ReactNode;
}

// Native <details>, closed by default: the summary names the section and how
// many items it holds, so a skimming reader knows what they are skipping. No
// JavaScript; fragment links into a closed <details> open it in Chromium.
export function Collapsible({ headingId, heading, countLabel, count, className = "", children }: CollapsibleProps) {
  return (
    <section aria-labelledby={headingId} className={`mt-12 ${className}`}>
      <details>
        <summary className="flex min-h-11 cursor-pointer flex-wrap items-baseline gap-x-3 py-2">
          <h2 id={headingId} className="text-2xl font-semibold tracking-tight">
            {heading}
          </h2>
          <span className="text-sm">{countLabel.replace("{count}", String(count))}</span>
        </summary>
        {children}
      </details>
    </section>
  );
}
