import type { EvalReport } from "@/lib/assistant/evals";
import { getComposedStore } from "@/lib/assistant/composed";
import { getEvals } from "@/lib/content";
import { fill, runStats } from "@/lib/evals-view";

// Which model words answers today, whether the results above depend on it
// (computed: a template-only run is compared at build), the design decision
// behind it, the trade-off, and what the generating run actually looked like.
export function Composer({ report }: { report: EvalReport }) {
  const c = getEvals().composer;
  const { model, generatedAt, modelFacts, templateFacts } = report.composer;
  const stats = runStats(getComposedStore());
  return (
    <section aria-labelledby="composer" className="mt-16 max-w-3xl">
      <h2 id="composer" className="text-2xl font-semibold tracking-tight">
        {c.heading}
      </h2>
      <p className="mt-3 leading-7">
        {model
          ? fill(c.withModel, { model, date: generatedAt?.slice(0, 10) ?? "", modelFacts, templateFacts })
          : c.templateOnly}
      </p>
      <p className="mt-3 font-semibold leading-7" data-same-as-template={report.sameAsTemplate}>
        {report.sameAsTemplate ? c.unchanged : c.changed}
      </p>
      <h3 className="mt-6 text-lg font-semibold">{c.decisionHeading}</h3>
      <p className="mt-2 leading-7">{c.decision}</p>
      {stats && (
        <>
          <h3 className="mt-6 text-lg font-semibold">{c.tradeOffHeading}</h3>
          <p className="mt-2 leading-7">{fill(c.tradeOff, { median: stats.median })}</p>
          <p className="mt-3 text-sm leading-6">{fill(stats.errors > 0 ? c.opsErrors : c.opsNoErrors, { ...stats })}</p>
        </>
      )}
    </section>
  );
}
