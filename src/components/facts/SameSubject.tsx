import type { ReactNode } from "react";
import { getSite, type Fact } from "@/lib/content";
import type { BasisSource } from "@/lib/schemas";
import { BasisText, IsoDate, SourceLink } from "@/components/ui/FactParts";
import { FigureValue } from "@/components/facts/FigureValue";
import { orderedFigures } from "@/lib/figures";

interface FigureProps {
  value: ReactNode;
  basis: string;
  basisSource: BasisSource;
  url: string;
  title?: string;
  accessed: string;
}

function Figure({ value, basis, basisSource, url, title, accessed }: FigureProps) {
  const ui = getSite().factUi;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line p-5 text-sm leading-6">
      <p className="text-2xl">{value}</p>
      <p>
        <span className="font-semibold">{ui.basis}: </span>
        <BasisText basis={basis} basisSource={basisSource} />
      </p>
      <p>
        <span className="font-semibold">{ui.source}: </span>
        <SourceLink url={url} title={title} />
        {" · "}
        <IsoDate iso={accessed} />
      </p>
    </li>
  );
}

// Every published figure for one fact, each next to its own basis. Also used
// by /findings.
export function PublishedFigures({ fact }: { fact: Fact }) {
  return (
    <ul className="mt-4 grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
      {orderedFigures(fact).map((figure) => (
        <Figure
          key={`${figure.value}|${figure.url}`}
          value={<FigureValue fact={fact} figure={figure} />}
          basis={figure.basis}
          basisSource={figure.basisSource}
          url={figure.url}
          title={figure.title}
          accessed={figure.accessed}
        />
      ))}
    </ul>
  );
}

// Facts that EnergyX publishes with more than one figure, each figure next to
// its own basis. Framing is deliberately neutral; see factsPage.sameSubject.
export function SameSubject({ facts }: { facts: Fact[] }) {
  const copy = getSite().factsPage.sameSubject;
  return (
    <section aria-labelledby="same-subject" className="mt-16">
      <h2 id="same-subject" className="h-section">
        {copy.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{copy.body}</p>

      {facts.map((fact) => (
        <article key={fact.id} aria-labelledby={`same-${fact.id}`} className="mt-8">
          <h3 id={`same-${fact.id}`} className="text-lg font-semibold">
            {fact.label}
          </h3>
          <PublishedFigures fact={fact} />
        </article>
      ))}
    </section>
  );
}
