import { getSite } from "@/lib/content";

// Rendered on every page by template.tsx but hidden by default. CSS reveals it
// only when its own page frame contains a forward-looking chip, so pages kept
// mounted in hidden <Activity> trees can't switch it on for the visible page.
export function ForwardLookingNote() {
  const { marker, note } = getSite().forwardLooking;
  return (
    <div className="fl-footnote mx-auto w-full max-w-5xl border-t border-line px-4 py-6 text-sm lg:px-8">
      <p>
        <span aria-hidden="true">{marker} </span>
        {note}
      </p>
    </div>
  );
}
