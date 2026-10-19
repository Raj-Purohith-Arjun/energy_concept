import { getFindings } from "@/lib/content";
import { plural } from "@/lib/plural";
import { Collapsible } from "./Collapsible";

export function FirstWeek() {
  const { heading, count, intro, points } = getFindings().firstWeek;
  return (
    <Collapsible headingId="first-week" heading={heading} note={plural(points.length, count)}>
      <p className="mt-3 max-w-3xl leading-7">{intro}</p>
      <ol className="mt-4 grid max-w-3xl list-decimal gap-2 pl-5 leading-7">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>
    </Collapsible>
  );
}
