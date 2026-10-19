import { Fact } from "@/components/ui/Fact";
import { FactText } from "@/components/ui/FactText";
import { getFindings } from "@/lib/content";

// The 15-second version, above all prose: three before -> after pairs at
// display size, each still a <Fact> with its source panel.
export function Verdict() {
  const { verdict, comparison } = getFindings();
  return (
    <section aria-labelledby="verdict" className="mt-6 rounded-lg border-2 border-current/25 p-5 sm:p-6">
      <h2 id="verdict" className="text-sm font-semibold uppercase tracking-wide">
        {verdict.heading}
      </h2>
      <dl className="mt-4 grid gap-6 sm:grid-cols-3">
        {verdict.pairs.map((pair) => (
          <div key={pair.label}>
            <dt className="text-sm">{pair.label}</dt>
            <dd className="verdict-figures mt-1 text-2xl leading-tight sm:text-3xl">
              <span className="sr-only">{comparison.columns.before}: </span>
              <Fact id={pair.before} />
              <span aria-hidden="true" className="mx-2">
                →
              </span>
              <span className="sr-only">, {comparison.columns.after}: </span>
              <Fact id={pair.after} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 max-w-3xl leading-7">
        <FactText text={verdict.summary} />
      </p>
    </section>
  );
}
