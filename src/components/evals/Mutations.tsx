import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport, MutantResult } from "@/lib/assistant/evals";
import { ContentError, getEvals, labelFor } from "@/lib/content";
import { fill, groupLabel } from "@/lib/evals-view";
import { plural } from "@/lib/plural";

const FILE = "content/evals.json";

// Each guardrail switched off at build time, and how many test questions fail
// against the broken version. The most telling rows are shown open; the full
// table is collapsed.
export function Mutations({ report }: { report: EvalReport }) {
  const m = getEvals().mutation;
  const where = (mutant: MutantResult) =>
    Object.entries(mutant.byGroup)
      .sort(([, a], [, b]) => b - a)
      .map(([group, count]) => fill(m.groupCount, { count, label: groupLabel(group) }))
      .join(" · ");
  const highlights = m.highlights.map((id) => {
    const mutant = report.mutants.find((x) => x.id === id);
    if (!mutant) throw new ContentError(`${FILE}: mutation highlight "${id}" is not a mutant`);
    return mutant;
  });

  return (
    <section aria-labelledby="mutation" className="mt-16">
      <h2 id="mutation" className="text-2xl font-semibold tracking-tight">
        {m.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{m.intro}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {highlights.map((mutant) => (
          <li key={mutant.id} data-mutant={mutant.id} className="rounded-lg border-2 border-current/30 p-4">
            <p className="font-semibold">{labelFor(m.labels, mutant.id, FILE)}</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums">{mutant.failed}</p>
            <p className="text-sm">{mutant.failed === 0 ? m.missed : plural(mutant.failed, m.failed)}</p>
            <p className="mt-2 text-sm leading-6">{where(mutant)}</p>
          </li>
        ))}
      </ul>
      <Collapsible headingId="mutation-all" heading={m.full.heading} note={plural(report.mutants.length, m.full.count)}>
        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-current/40 text-sm">
              <th scope="col" className="py-2 pr-3 font-semibold">{m.columns.mutant}</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">{m.columns.failed}</th>
              <th scope="col" className="hidden py-2 font-semibold sm:table-cell">{m.columns.where}</th>
            </tr>
          </thead>
          <tbody>
            {report.mutants.map((mutant) => (
              <tr key={mutant.id} data-mutant-row={mutant.id} className="border-b border-current/15 align-top">
                <th scope="row" className="py-3 pr-3 font-normal">
                  {labelFor(m.labels, mutant.id, FILE)}
                  <span className="mt-1 block text-sm sm:hidden">{where(mutant)}</span>
                </th>
                <td className="py-3 pr-3 text-right text-2xl font-semibold tabular-nums">
                  {mutant.failed === 0 ? <span className="text-base text-red-700 dark:text-red-400">{m.missed}</span> : mutant.failed}
                </td>
                <td className="hidden py-3 text-sm sm:table-cell">{where(mutant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Collapsible>
    </section>
  );
}
