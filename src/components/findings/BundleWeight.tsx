import Link from "next/link";
import { BasisText } from "@/components/ui/FactParts";
import { FactText } from "@/components/ui/FactText";
import { FactValue } from "@/components/ui/FactValue";
import { getFact, getFindings } from "@/lib/content";

// Local first-load JavaScript, per route. Verdict and the "local, not deployed"
// caveat sit above the fold of the section; the attribution is collapsed.
// The per-route list shows label and value only (FactValue keeps the forward-
// looking chip and unverified marker); the shared basis is shown once, inside
// the details, and source/approval state is on /facts. Server component, native
// <details>: no client JS.
export function BundleWeight() {
  const { bundle } = getFindings();
  // The six routes share one measurement method, so one basis; if they ever
  // differ, each distinct basis is listed rather than one being dropped.
  const bases = new Map<string, ReturnType<typeof getFact>>();
  for (const route of bundle.routes) {
    const fact = getFact(route.fact);
    bases.set(`${fact.basisSource}|${fact.basis}`, fact);
  }
  return (
    <section aria-labelledby="bundle" className="mt-12">
      <h2 id="bundle" className="h-section">
        {bundle.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">
        <FactText text={bundle.verdict} />
      </p>
      <p className="mt-3 max-w-3xl leading-7">{bundle.method}</p>
      <h3 className="mt-6 font-semibold">{bundle.routesLabel}</h3>
      <dl className="mt-2 grid max-w-3xl gap-x-6 gap-y-2 sm:grid-cols-2">
        {bundle.routes.map((route) => (
          <div key={route.fact} className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-line pt-2">
            <dt>{route.label}</dt>
            <dd>
              <FactValue fact={getFact(route.fact)} />
            </dd>
          </div>
        ))}
      </dl>
      <details className="mt-6 max-w-3xl">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{bundle.detailSummary}</summary>
        {bundle.detail.map((text) => (
          <p key={text} className="mt-3 leading-7">
            <FactText text={text} />
          </p>
        ))}
        <h3 className="mt-5 font-semibold">{bundle.basisHeading}</h3>
        {[...bases.entries()].map(([key, fact]) => (
          <p key={key} className="mt-2 leading-7">
            <BasisText basis={fact.basis} basisSource={fact.basisSource} />
          </p>
        ))}
        <p className="mt-3 leading-7">
          <Link href="/facts/" className="underline underline-offset-4">
            {bundle.factsLink}
          </Link>
        </p>
      </details>
    </section>
  );
}
