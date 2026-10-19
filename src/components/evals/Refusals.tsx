import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport } from "@/lib/assistant/evals";
import { getAssistant, getEvals } from "@/lib/content";
import { groupLabel } from "@/lib/evals-view";
import { plural } from "@/lib/plural";
import { REFUSAL_CATEGORIES } from "@/lib/schemas";
import { CaseTable } from "./CaseTable";
import { QuestionLink } from "./QuestionLink";

// The assistant's planned-figure reason ends "...read it here:" because a source
// link follows it there. No link follows here, so drop that last sentence.
const withoutLinkLead = (text: string) => text.replace(/\s*[^.]*:\s*$/, "");

// One block per refusal category, with the assistant's own explanation and the
// first test question in that category as a live example. Collapsed.
export function Refusals({ report }: { report: EvalReport }) {
  const r = getEvals().refusals;
  const why = getAssistant().refusals;
  const rows = REFUSAL_CATEGORIES.map((category) => ({
    category,
    cases: report.results.filter((g) => g.case.group === category),
  }));
  const all = rows.flatMap((row) => row.cases);
  return (
    <Collapsible headingId="refusals" heading={r.heading} note={plural(all.length, r.count)}>
      <p className="mt-3 max-w-3xl leading-7">{r.intro}</p>
      <p className="mt-2 max-w-3xl font-semibold leading-7">{r.expected}</p>
      <div className="mt-6 grid gap-6">
        {rows.map(({ category, cases }) => (
          <article key={category} aria-labelledby={`refusal-${category}`} className="border-l-4 border-current/30 pl-4">
            <h3 id={`refusal-${category}`} className="font-semibold">
              {groupLabel(category)} <span className="font-normal">· {plural(cases.length, r.count)}</span>
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6">{withoutLinkLead(why[category].why)}</p>
            {cases[0] && (
              <p className="mt-2 text-sm [overflow-wrap:anywhere]">
                <span className="font-semibold">{r.example}: </span>
                <QuestionLink question={cases[0].case.question} />
              </p>
            )}
          </article>
        ))}
      </div>
      <CaseTable rows={all} />
    </Collapsible>
  );
}
