import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport } from "@/lib/assistant/evals";
import { TECHNIQUES } from "@/lib/assistant/eval-cases";
import { ContentError, getEvals } from "@/lib/content";
import { outcomeText } from "@/lib/evals-view";
import { plural } from "@/lib/plural";
import { CaseTable } from "./CaseTable";
import { QuestionLink } from "./QuestionLink";

// Workaround techniques: what each tries, one real case (a live link) and its
// result, as plain visible lines rather than an arrow plus hidden text.
export function Adversarial({ report }: { report: EvalReport }) {
  const a = getEvals().adversarial;
  const cases = report.results.filter((g) => g.case.group === "adversarial");
  return (
    <Collapsible headingId="adversarial" heading={a.heading} note={plural(cases.length, a.count)}>
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
                {t.name} <span className="font-normal">· {plural(ofKind.length, a.count)}</span>
              </h3>
              <dl className="mt-1 grid gap-1 text-sm leading-6 sm:grid-cols-[8rem_1fr]">
                <dt className="font-semibold">{a.labels.attempts}</dt>
                <dd>{t.attempts}</dd>
                {example && (
                  <>
                    <dt className="font-semibold">{a.labels.example}</dt>
                    <dd className="[overflow-wrap:anywhere]">
                      <QuestionLink question={example.case.question} />
                    </dd>
                    <dt className="font-semibold">{a.labels.result}</dt>
                    <dd>{outcomeText(example.outcome)}</dd>
                  </>
                )}
              </dl>
            </article>
          );
        })}
      </div>
      <CaseTable rows={cases} />
    </Collapsible>
  );
}
