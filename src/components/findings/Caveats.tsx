import { FactText } from "@/components/ui/FactText";
import { getFindings } from "@/lib/content";

// Deliberately prominent: a bordered block with its own heading, linked from
// the page intro, not small print at the bottom.
export function Caveats() {
  const { heading, points } = getFindings().caveats;
  return (
    <section
      id="caveats"
      aria-labelledby="caveats-heading"
      className="mt-16 max-w-3xl scroll-mt-24 rounded-lg border-2 border-amber-500 p-5 sm:p-6"
    >
      <h2 id="caveats-heading" className="text-2xl font-semibold tracking-tight">
        {heading}
      </h2>
      <ul className="mt-4 grid list-disc gap-3 pl-5 leading-7">
        {points.map((point) => (
          <li key={point}>
            <FactText text={point} />
          </li>
        ))}
      </ul>
    </section>
  );
}
