import type { EvalReport } from "@/lib/assistant/evals";
import { ContentError, getEvals } from "@/lib/content";
import { fill, outcomeText, questionText } from "@/lib/evals-view";
import { askHref } from "./QuestionLink";

// One click from the real thing. The questions come from content but must be
// eval cases, and "what you'll see" is that case's actual result at build.
export function TryIt({ report }: { report: EvalReport }) {
  const t = getEvals().tryIt;
  const items = t.questions.map(({ question, note }) => {
    const result = report.results.find((r) => r.case.question === question);
    if (!result) throw new ContentError(`content/evals.json: tryIt question "${question}" is not an eval case`);
    return { question, note, outcome: outcomeText(result.outcome) };
  });
  return (
    <section aria-labelledby="try-it" className="mt-8">
      <h2 id="try-it" className="text-2xl font-semibold tracking-tight">
        {t.heading}
      </h2>
      <p className="mt-2 max-w-3xl leading-7">{t.intro}</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.question}>
            <a
              href={askHref(item.question)}
              className="flex h-full min-h-11 flex-col rounded-lg border-2 border-current/30 p-4 hover:border-current"
            >
              <span className="text-lg font-semibold underline underline-offset-4">{questionText(item.question)}</span>
              <span className="mt-1 text-sm">{item.note}</span>
              <span className="mt-3 text-sm font-semibold">{fill(t.expect, { outcome: item.outcome })}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
