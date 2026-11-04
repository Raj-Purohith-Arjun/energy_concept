import type { ReactNode } from "react";
import { getSite, type Fact } from "@/lib/content";
import { ApprovalState, BasisText, IsoDate, SourceLink } from "@/components/ui/FactParts";
import { FigureValue } from "@/components/facts/FigureValue";
import { orderedFigures } from "@/lib/figures";

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="font-semibold">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

// One registry entry with everything shown inline (no disclosure needed here).
export function FactCard({ fact }: { fact: Fact }) {
  const { factUi: ui, factsPage } = getSite();
  const headingId = `fact-${fact.id}`;
  // The figure the source page states leads; an inferred one follows, labelled.
  const [lead, ...others] = orderedFigures(fact);
  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-current/15 p-5">
      <h3 id={headingId} className="text-sm font-medium opacity-80">
        {fact.label}
      </h3>
      <p className="mt-1 text-2xl">
        <FigureValue fact={fact} figure={lead} />
        {others.map((figure) => (
          <span key={figure.value} className="ml-3 text-base opacity-80">
            {ui.alsoPublished} <FigureValue fact={fact} figure={figure} />
            {figure.basisSource === "inferred" && ` (${ui.inferred})`}
          </span>
        ))}
      </p>
      <dl className="mt-4 grid gap-3 text-sm leading-6">
        <Row term={ui.basis}>
          <BasisText basis={fact.basis} basisSource={fact.basisSource} />
        </Row>
        <Row term={factsPage.labels.kind}>{ui.kinds[fact.kind]}</Row>
        <Row term={ui.source}>
          <SourceLink url={fact.source.url} title={fact.source.title} />
        </Row>
        <Row term={ui.accessed}>
          <IsoDate iso={fact.source.accessed} />
        </Row>
        <Row term={factsPage.labels.owner}>{fact.owner}</Row>
        <Row term={factsPage.labels.status}>
          {fact.verified ? ui.verified : ui.unverified} · <ApprovalState approvedAt={fact.approvedAt} />
        </Row>
      </dl>
    </article>
  );
}
