import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport } from "@/lib/assistant/evals";
import { getEvals } from "@/lib/content";
import { fill } from "@/lib/evals-view";
import { CaseTable } from "./CaseTable";

// Why a refusal suite needs questions that must NOT be refused, with the
// refuse-everything mutant's result as the proof rather than an assertion.
export function MustNotRefuse({ report }: { report: EvalReport }) {
  const m = getEvals().mustNotRefuse;
  const cases = report.results.filter((g) => g.case.group === "must-not-refuse");
  const refuseAll = report.mutants.find((x) => x.id === "refuse-all");
  if (!refuseAll) throw new Error("evals: the refuse-all mutant is missing");
  return (
    <section aria-labelledby="must-not-refuse" className="mt-16 max-w-3xl rounded-lg border-2 border-amber-500 p-5 sm:p-6">
      <h2 id="must-not-refuse" className="text-2xl font-semibold tracking-tight">
        {m.heading}
      </h2>
      {m.body.map((p) => (
        <p key={p} className="mt-3 leading-7">
          {p}
        </p>
      ))}
      <p className="mt-3 font-semibold leading-7">
        {fill(m.proof, { count: refuseAll.byGroup["must-not-refuse"] ?? 0, total: cases.length })}
      </p>
      <Collapsible headingId="must-not-refuse-all" heading={m.all} countLabel={m.count} count={cases.length} className="!mt-4">
        <CaseTable rows={cases} />
      </Collapsible>
    </section>
  );
}
