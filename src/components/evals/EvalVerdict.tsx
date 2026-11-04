import type { EvalReport } from "@/lib/assistant/evals";
import { getEvals } from "@/lib/content";
import { fill, percent } from "@/lib/evals-view";

// Verdict first, like /findings, and honest about what a pass rate proves.
export function EvalVerdict({ report }: { report: EvalReport }) {
  const v = getEvals().verdict;
  const total = report.results.length;
  const rate = percent(report.passed, total);
  const caught = report.mutants.filter((m) => m.failed > 0).length;
  const stats = [
    { value: String(total), label: v.cases },
    { value: String(report.categoriesCovered), label: fill(v.categories, { total: report.categoriesTotal }) },
    // No mutants means nothing was switched off, so say nothing rather than "0 of 0".
    ...(report.mutants.length > 0
      ? [{ value: String(caught), label: fill(v.mutants, { total: report.mutants.length }) }]
      : []),
    { value: rate, label: v.passRate },
  ];
  return (
    <section aria-labelledby="eval-verdict" className="mt-8 rounded-lg border-2 border-line p-5 sm:p-6">
      <h2 id="eval-verdict" className="text-sm font-semibold uppercase tracking-wide">
        {v.heading}
      </h2>
      <dl className="mt-4 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse">
            <dt className="text-sm">{s.label}</dt>
            <dd className="text-3xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 max-w-3xl leading-7">
        {report.passed === total ? fill(v.allPass, { rate }) : fill(v.someFail, { failed: total - report.passed, total })}
      </p>
    </section>
  );
}
