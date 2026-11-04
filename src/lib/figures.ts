import type { BasisSource, Fact } from "./schemas";

// Every figure EnergyX publishes for one fact, in display order: figures the
// source page states come before figures this registry only infers. A stable
// sort, so a fact whose main figure is already stated keeps its order.
// Display only; the registry (content/facts.json) is not reordered.

export interface Figure {
  value: string;
  basis: string;
  basisSource: BasisSource;
  url: string;
  title?: string;
  accessed: string;
  /** True for the registry's own `value`, which carries the kind and unverified markers. */
  primary: boolean;
}

export function orderedFigures(fact: Fact): Figure[] {
  const figures: Figure[] = [
    {
      value: fact.value,
      basis: fact.basis,
      basisSource: fact.basisSource,
      url: fact.source.url,
      title: fact.source.title,
      accessed: fact.source.accessed,
      primary: true,
    },
    ...fact.alsoPublishedAs.map((alt) => ({
      value: alt.value,
      basis: alt.basis,
      basisSource: alt.basisSource,
      url: alt.url,
      accessed: alt.accessed,
      primary: false,
    })),
  ];
  const rank = (f: Figure) => (f.basisSource === "stated" ? 0 : 1);
  return figures.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map(({ f }) => f);
}
