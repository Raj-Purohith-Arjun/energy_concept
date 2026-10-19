import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport } from "@/lib/assistant/evals";
import { getEvals, labelFor } from "@/lib/content";
import { plural } from "@/lib/plural";
import { CaseTable } from "./CaseTable";

// The only place a model can plug in, tested with deliberately broken models.
// Rows are stub descriptions, not questions, so they are not linked.
export function ModelSlot({ report }: { report: EvalReport }) {
  const m = getEvals().modelSlot;
  const cases = report.results.filter((g) => g.case.group === "model-slot");
  return (
    <Collapsible headingId="model-slot" heading={m.heading} note={plural(cases.length, m.count)}>
      <p className="mt-3 max-w-3xl leading-7">{m.intro}</p>
      <p className="mt-2 max-w-3xl font-semibold leading-7">{m.expected}</p>
      <CaseTable rows={cases} label={(g) => labelFor(m.stubs, g.case.stub ?? "", "content/evals.json")} />
    </Collapsible>
  );
}
