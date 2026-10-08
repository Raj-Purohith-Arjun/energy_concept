import { getSite } from "@/lib/content";
import { isForwardLooking, type Fact } from "@/lib/schemas";
import { UnverifiedMarker } from "./FactParts";

// The figure plus its mandatory markers. Used by <Fact> and the /facts page.
// `value` is the full display string; `unit` qualifies `numeric` and is kept
// as data for a later count-up, so it is not appended to the visible text.
export function FactValue({ fact }: { fact: Fact }) {
  const { factUi, forwardLooking } = getSite();
  return (
    <>
      <span
        className="fact-value font-semibold tabular-nums"
        data-numeric={fact.numeric}
        data-unit={fact.unit}
      >
        {fact.value}
      </span>
      {isForwardLooking(fact) && (
        // `data-forward-looking` turns on this page's footnote (see template.tsx).
        <span
          data-forward-looking=""
          className="ml-1.5 inline-block rounded border border-amber-400 bg-amber-100 px-1.5 align-middle text-xs font-semibold text-amber-950"
        >
          {factUi.kinds[fact.kind]}
          <span aria-hidden="true">{forwardLooking.marker}</span>
        </span>
      )}
      {!fact.verified && <UnverifiedMarker />}
    </>
  );
}
