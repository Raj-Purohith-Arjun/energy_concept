import { PublishedFigures } from "@/components/facts/SameSubject";
import { FactText } from "@/components/ui/FactText";
import { getFact, getFindings } from "@/lib/content";
import { Collapsible } from "./Collapsible";

// Framing follows /facts: "same subject, different measures", never an error.
export function RegistryFindings() {
  const { heading, count, intro, cases } = getFindings().registry;
  return (
    <Collapsible headingId="registry-findings" heading={heading} countLabel={count} count={cases.length}>
      <p className="mt-3 max-w-3xl leading-7">{intro}</p>
      {cases.map((c, i) => (
        <article key={c.heading} aria-labelledby={`registry-case-${i}`} className="mt-10">
          <h3 id={`registry-case-${i}`} className="text-lg font-semibold">
            {c.heading}
          </h3>
          {c.body.map((text) => (
            <p key={text} className="mt-3 max-w-3xl leading-7">
              <FactText text={text} />
            </p>
          ))}
          {c.figures && <PublishedFigures fact={getFact(c.figures)} />}
        </article>
      ))}
    </Collapsible>
  );
}
