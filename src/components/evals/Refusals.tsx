import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport } from "@/lib/assistant/evals";
import { getAssistant, getEvals } from "@/lib/content";
import { fill, groupLabel, questionText } from "@/lib/evals-view";
import { REFUSAL_CATEGORIES } from "@/lib/schemas";
import { CaseTable } from "./CaseTable";

// The assistant's planned-figure reason ends "...read it here:" because a source
// link follows it there. No link follows here, so drop that last sentence.
const withoutLinkLead = (text: string) => text.replace(/\s*[^.]*:\s*$/, "");

// One block per refusal category, with the assistant's own explanation and the
// first test question in that category as the example.
export function Refusals({ report }: { report: EvalReport }) {
  const r = getEvals().refusals;
  const why = getAssistant().refusals;
  const rows = REFUSAL_CATEGORIES.map((category) => ({
    category,
    cases: report.results.filter((g) => g.case.group === category),
  }));
  return (
    <section aria-labelledby="refusals" className="mt-16">
      <h2 id="refusals" className="text-2xl font-semibold tracking-tight">
        {r.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{r.intro}</p>
      <p className="mt-2 max-w-3xl font-semibold leading-7">{r.expected}</p>
      <div className="mt-6 grid gap-6">
        {rows.map(({ category, cases }) => (
          <article key={category} aria-labelledby={`refusal-${category}`} className="border-l-4 border-current/30 pl-4">
            <h3 id={`refusal-${category}`} className="font-semibold">
              {groupLabel(category)} <span className="font-normal">· {fill(r.count, { count: cases.length })}</span>
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6">{withoutLinkLead(why[category].why)}</p>
            {cases[0] && (
              <p className="mt-2 text-sm [overflow-wrap:anywhere]">
                <span className="font-semibold">{r.columns.example}: </span>
                <q>{questionText(cases[0].case.question)}</q>
              </p>
            )}
          </article>
        ))}
      </div>
      <Collapsible
        headingId="refusals-all"
        heading={r.all}
        countLabel={r.count}
        count={rows.reduce((n, row) => n + row.cases.length, 0)}
      >
        <CaseTable rows={rows.flatMap((row) => row.cases)} />
      </Collapsible>
    </section>
  );
}
