import { getSite } from "@/lib/content";

// Server-rendered in normal flow with a fixed minimum height, so it is part of
// the first paint and never shifts layout. Deliberately not dismissible.
export function ConceptBanner() {
  const { banner } = getSite();
  return (
    <aside
      aria-label="Concept notice"
      className="flex min-h-8 items-center justify-center bg-neutral-100 px-4 py-1.5 text-center text-xs leading-5 font-medium text-neutral-900"
    >
      <p>{banner}</p>
    </aside>
  );
}
