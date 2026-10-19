import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport } from "@/lib/assistant/evals";
import { TECHNIQUES } from "@/lib/assistant/eval-cases";
import { ContentError, getEvals } from "@/lib/content";
import { fill, outcomeText, questionText } from "@/lib/evals-view";
import { CaseTable } from "./CaseTable";

// Workaround techniques: what each tries, one real case and what happened.
export function Adversarial({ report }: { report: EvalReport }) {
  const a = getEvals().adversarial;
  const cases = report.results.filter((g) => g.case.group === "adversarial");
  return (
    <section aria-labelledby="adversarial" className="mt-16">
      <h2 id="adversarial" className="text-2xl font-semibold tracking-tight">
        {a.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{a.intro}</p>
      <div className="mt-6 grid gap-6">
        {TECHNIQUES.map((technique) => {
          const t = a.techniques[technique];
          if (!t) throw new ContentError(`content/evals.json: no label for technique "${technique}"`);
          const ofKind = cases.filter((g) => g.case.technique === technique);
          const example = ofKind[0];
          return (
            <article key={technique} aria-labelledby={`technique-${technique}`} className="border-l-4 border-current/30 pl-4">
              <h3 id={`technique-${technique}`} className="font-semibold">
                {t.name} <span className="font-normal">· {fill(a.count, { count: ofKind.length })}</span>
              </h3>
              <p className="mt-1 max-w-3xl text-sm leading-6">
                <span className="font-semibold">{a.columns.attempts}: </span>
                {t.attempts}
              </p>
              {example && (
                <p className="mt-2 text-sm [overflow-wrap:anywhere]">
                  <span className="font-semibold">{a.columns.example}: </span>
                  <q>{questionText(example.case.question)}</q>
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only">. {a.columns.outcome}: </span>
                  {outcomeText(example.outcome)}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <Collapsible headingId="adversarial-all" heading={a.all} countLabel={a.count} count={cases.length}>
        <CaseTable rows={cases} />
      </Collapsible>
    </section>
  );
}
