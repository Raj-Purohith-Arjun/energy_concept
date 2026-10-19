import { FactText } from "@/components/ui/FactText";
import { getFindings } from "@/lib/content";
import { Collapsible } from "./Collapsible";

// Collapsed for skimming but still prominent: a bordered block, linked from the
// page intro. The link targets the list inside, which opens the <details>.
export function Caveats() {
  const { heading, count, points } = getFindings().caveats;
  return (
    <Collapsible
      headingId="caveats-heading"
      heading={heading}
      countLabel={count}
      count={points.length}
      className="max-w-3xl rounded-lg border-2 border-amber-500 px-5 sm:px-6"
    >
      <ul id="caveats" className="mb-5 mt-2 grid scroll-mt-40 list-disc gap-3 pl-5 leading-7">
        {points.map((point) => (
          <li key={point}>
            <FactText text={point} />
          </li>
        ))}
      </ul>
    </Collapsible>
  );
}
