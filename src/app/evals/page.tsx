import type { Metadata } from "next";
import { Adversarial } from "@/components/evals/Adversarial";
import { CaseTable } from "@/components/evals/CaseTable";
import { Composer } from "@/components/evals/Composer";
import { EvalVerdict } from "@/components/evals/EvalVerdict";
import { ModelSlot } from "@/components/evals/ModelSlot";
import { MustNotRefuse } from "@/components/evals/MustNotRefuse";
import { Mutations } from "@/components/evals/Mutations";
import { Refusals } from "@/components/evals/Refusals";
import { Rejections } from "@/components/evals/Rejections";
import { TryIt } from "@/components/evals/TryIt";
import { Collapsible } from "@/components/findings/Collapsible";
import { evalReport } from "@/lib/assistant/evals";
import { getEvals } from "@/lib/content";
import { plural } from "@/lib/plural";

export const metadata: Metadata = {
  title: getEvals().title,
};

// The eval suite, run at build time: every count, rate and example below comes
// from running src/lib/assistant/eval-cases.ts through the real pipeline, once
// as shipped and once per mutant. Ordered strongest first: try it, a real model
// error caught, guardrails switched off; then the pass rate in context; the
// rest collapsed. Static HTML; no client JS.
export default async function EvalsPage() {
  const page = getEvals();
  const report = await evalReport();
  const other = report.results.filter((g) => g.case.group === "answer" || g.case.group === "draft" || g.case.group === "no-answer");
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{page.heading}</h1>
      <p className="mt-3 max-w-3xl leading-7">{page.intro}</p>
      <TryIt report={report} />
      <Rejections />
      <Mutations report={report} />
      <EvalVerdict report={report} />
      <p className="mt-6 max-w-3xl border-l-4 border-current pl-4 text-lg font-semibold leading-8">{page.model}</p>
      <MustNotRefuse report={report} />
      <Refusals report={report} />
      <Adversarial report={report} />
      <ModelSlot report={report} />
      <Composer report={report} />
      <Collapsible headingId="other-cases" heading={page.other.heading} note={plural(other.length, page.other.count)}>
        <p className="mt-3 max-w-3xl leading-7">{page.other.intro}</p>
        <CaseTable rows={other} />
      </Collapsible>
    </div>
  );
}
