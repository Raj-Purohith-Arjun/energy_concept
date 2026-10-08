import type { Metadata } from "next";
import { FactCard } from "@/components/facts/FactCard";
import { SameSubject } from "@/components/facts/SameSubject";
import { getAllFacts, getSite } from "@/lib/content";

export const metadata: Metadata = {
  title: getSite().factsPage.title,
};

// Shows every fact, verified or not: the Unverified markers are part of the
// demo's transparency. Pages that must never show one use
// getFact(id, { requireVerified: true }) instead.
export default function FactsPage() {
  const page = getSite().factsPage;
  const facts = getAllFacts();
  const multiFigure = facts.filter((fact) => fact.alsoPublishedAs.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{page.heading}</h1>
      <p className="mt-3 max-w-3xl leading-7">{page.intro}</p>

      <section aria-labelledby="registry" className="mt-12">
        <h2 id="registry" className="text-2xl font-semibold tracking-tight">
          {page.registryHeading}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {facts.map((fact) => (
            <FactCard key={fact.id} fact={fact} />
          ))}
        </div>
      </section>

      {multiFigure.length > 0 && <SameSubject facts={multiFigure} />}
    </div>
  );
}
