import { Collapsible } from "@/components/findings/Collapsible";
import type { EvalReport } from "@/lib/assistant/evals";
import { getEvals, labelFor } from "@/lib/content";
import { CaseTable } from "./CaseTable";

// The only place a model can plug in, tested with deliberately broken models.
export function ModelSlot({ report }: { report: EvalReport }) {
  const m = getEvals().modelSlot;
  const cases = report.results.filter((g) => g.case.group === "model-slot");
  return (
    <section aria-labelledby="model-slot" className="mt-16">
      <h2 id="model-slot" className="text-2xl font-semibold tracking-tight">
        {m.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{m.intro}</p>
      <p className="mt-2 max-w-3xl font-semibold leading-7">{m.expected}</p>
      <Collapsible headingId="model-slot-all" heading={m.all} countLabel={m.count} count={cases.length}>
        <CaseTable rows={cases} label={(g) => labelFor(m.stubs, g.case.stub ?? "", "content/evals.json")} />
      </Collapsible>
    </section>
  );
}
