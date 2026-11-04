import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport } from "@/lib/assistant/evals";
import { getEvals } from "@/lib/content";
import { fill } from "@/lib/evals-view";
import { plural } from "@/lib/plural";
import { CaseTable } from "./CaseTable";

// The one point most suites miss stays visible; only the list collapses.
export function MustNotRefuse({ report }: { report: EvalReport }) {
  const m = getEvals().mustNotRefuse;
  const cases = report.results.filter((g) => g.case.group === "must-not-refuse");
  return (
    <section aria-labelledby="must-not-refuse" className="mt-16 max-w-3xl rounded-lg border-2 border-amber-500 p-5 sm:p-6">
      <h2 id="must-not-refuse" className="h-section">
        {m.heading}
      </h2>
      <p className="mt-3 font-semibold leading-7">{fill(m.lead, { count: cases.length })}</p>
      <Collapsible headingId="must-not-refuse-all" heading={m.list.heading} note={plural(cases.length, m.list.count)} className="!mt-4">
        <CaseTable rows={cases} />
      </Collapsible>
    </section>
  );
}
