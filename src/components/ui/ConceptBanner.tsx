import { getSite } from "@/lib/content";

// Server-rendered in normal flow with a fixed minimum height, so it is part of
// the first paint and never shifts layout. Deliberately not dismissible.
export function ConceptBanner() {
  const { banner, bannerLabel } = getSite();
  return (
    <aside
      aria-label={bannerLabel}
      className="flex min-h-8 items-center justify-center bg-surface px-4 py-2 text-center text-xs leading-5 font-medium text-foreground border-b border-line"
    >
      <p>{banner}</p>
    </aside>
  );
}
