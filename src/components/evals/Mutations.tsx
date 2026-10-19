import type { EvalReport } from "@/lib/assistant/evals";
import { getEvals, labelFor } from "@/lib/content";
import { fill, groupLabel } from "@/lib/evals-view";

// The section that carries the page: each guardrail switched off at build
// time, and how many test questions fail against the broken version.
export function Mutations({ report }: { report: EvalReport }) {
  const m = getEvals().mutation;
  return (
    <section aria-labelledby="mutation" className="mt-12">
      <h2 id="mutation" className="text-2xl font-semibold tracking-tight">
        {m.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{m.intro}</p>
      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-current/40 text-sm">
            <th scope="col" className="py-2 pr-3 font-semibold">{m.columns.mutant}</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">{m.columns.failed}</th>
            <th scope="col" className="hidden py-2 font-semibold sm:table-cell">{m.columns.where}</th>
          </tr>
        </thead>
        <tbody>
          {report.mutants.map((mutant) => {
            const where = Object.entries(mutant.byGroup)
              .sort(([, a], [, b]) => b - a)
              .map(([group, count]) => fill(m.groupCount, { count, label: groupLabel(group) }))
              .join(", ");
            return (
              <tr key={mutant.id} data-mutant={mutant.id} className="border-b border-current/15 align-top">
                <th scope="row" className="py-3 pr-3 font-normal">
                  {labelFor(m.labels, mutant.id, "content/evals.json")}
                  <span className="mt-1 block text-sm sm:hidden">{where}</span>
                </th>
                <td className="py-3 pr-3 text-right text-2xl font-semibold tabular-nums">
                  {mutant.failed === 0 ? <span className="text-base text-red-700 dark:text-red-400">{m.missed}</span> : mutant.failed}
                </td>
                <td className="hidden py-3 text-sm sm:table-cell">{where}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
