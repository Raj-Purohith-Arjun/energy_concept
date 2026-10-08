import type { ReactNode } from "react";
import { getSite, type Fact } from "@/lib/content";
import type { BasisSource } from "@/lib/schemas";
import { BasisText, IsoDate, SourceLink } from "@/components/ui/FactParts";
import { FactValue } from "@/components/ui/FactValue";

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
    <li className="flex flex-col gap-3 rounded-lg border border-current/15 p-5 text-sm leading-6">
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

// Facts that EnergyX publishes with more than one figure, each figure next to
// its own basis. Framing is deliberately neutral; see factsPage.sameSubject.
export function SameSubject({ facts }: { facts: Fact[] }) {
  const copy = getSite().factsPage.sameSubject;
  return (
    <section aria-labelledby="same-subject" className="mt-16">
      <h2 id="same-subject" className="text-2xl font-semibold tracking-tight">
        {copy.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{copy.body}</p>

      {facts.map((fact) => (
        <article key={fact.id} aria-labelledby={`same-${fact.id}`} className="mt-8">
          <h3 id={`same-${fact.id}`} className="text-lg font-semibold">
            {fact.label}
          </h3>
          <ul className="mt-4 grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
            <Figure
              value={<FactValue fact={fact} />}
              basis={fact.basis}
              basisSource={fact.basisSource}
              url={fact.source.url}
              title={fact.source.title}
              accessed={fact.source.accessed}
            />
            {fact.alsoPublishedAs.map((alt) => (
              <Figure
                key={`${alt.value}|${alt.url}`}
                value={<span className="font-semibold tabular-nums">{alt.value}</span>}
                basis={alt.basis}
                basisSource={alt.basisSource}
                url={alt.url}
                accessed={alt.accessed}
              />
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
