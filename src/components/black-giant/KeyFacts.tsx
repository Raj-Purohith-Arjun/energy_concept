import Link from "next/link";
import { Fact } from "@/components/ui/Fact";
import { getBlackGiant, getFact } from "@/lib/content";

export function KeyFacts() {
  const { factsHeading, factIds, registryLink } = getBlackGiant();
  return (
    <section aria-labelledby="key-facts" className="mx-auto w-full max-w-5xl px-4 py-12 lg:px-8">
      <h2 id="key-facts" className="text-2xl font-semibold tracking-tight">
        {factsHeading}
      </h2>
      <dl className="mt-6 grid gap-6 sm:grid-cols-2">
        {factIds.map((id) => (
          <div key={id} className="border-t border-current/15 pt-4">
            <dt className="text-sm opacity-80">{getFact(id).label}</dt>
            <dd className="mt-1 text-xl">
              <Fact id={id} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-8">
        <Link href={registryLink.href} className="inline-flex min-h-11 items-center underline underline-offset-4">
          {registryLink.label}
        </Link>
      </p>
    </section>
  );
}

export function DeliveryNotes() {
  const { heading, points } = getBlackGiant().delivery;
  return (
    <section aria-labelledby="delivery" className="mx-auto w-full max-w-5xl px-4 pb-12 lg:px-8">
      <h2 id="delivery" className="text-2xl font-semibold tracking-tight">
        {heading}
      </h2>
      <ul className="mt-4 grid max-w-3xl list-disc gap-3 pl-5 leading-7">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  );
}
