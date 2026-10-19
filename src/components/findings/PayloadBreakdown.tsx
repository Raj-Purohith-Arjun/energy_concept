import { Fact } from "@/components/ui/Fact";
import { FactText } from "@/components/ui/FactText";
import { getFact, getFindings } from "@/lib/content";
import { isTodo, type PayloadPage } from "@/lib/schemas";
import { FactOrPending } from "./FactOrPending";

// getFindings() has already checked that totals and parts are verified byte
// facts with a numeric, so the `as number` reads below are safe.
const kib = (id: string) => getFact(id).numeric as number;
const shade = (video: boolean) => (video ? "bg-current" : "bg-current/35");

function PayloadRow({ page, scale, totalLabel }: { page: PayloadPage; scale: number; totalLabel: string }) {
  const measured = !isTodo(page.total);
  return (
    <li className="border-t border-current/15 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">{page.label}</h3>
        <p>
          {totalLabel}: <FactOrPending factRef={page.total} />
        </p>
      </div>
      {measured && page.parts.length > 0 && (
        <>
          {/* Decorative: the same figures are in the list below as text. */}
          <div
            aria-hidden="true"
            className="mt-3 flex h-4 gap-0.5 overflow-hidden rounded-sm"
            style={{ width: `${(kib(page.total) / scale) * 100}%` }}
          >
            {page.parts.map((part) => (
              <span
                key={part.fact}
                className={`${shade(part.video)} min-w-px`}
                style={{ width: `${(kib(part.fact) / kib(page.total)) * 100}%` }}
              />
            ))}
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            {page.parts.map((part) => (
              <div key={part.fact}>
                <dt className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className={`${shade(part.video)} inline-block size-3 rounded-sm`} />
                  {part.label}
                </dt>
                <dd className="mt-1">
                  <Fact id={part.fact} />
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </li>
  );
}

export function PayloadBreakdown() {
  const { payload } = getFindings();
  // One scale for every bar: the heaviest measured page is full width.
  const scale = Math.max(...payload.pages.filter((p) => !isTodo(p.total)).map((p) => kib(p.total)));
  return (
    <section aria-labelledby="payload" className="mt-12">
      <h2 id="payload" className="text-2xl font-semibold tracking-tight">
        {payload.heading}
      </h2>
      {payload.body.map((text) => (
        <p key={text} className="mt-3 max-w-3xl leading-7">
          <FactText text={text} />
        </p>
      ))}
      <ul className="mt-8 grid gap-8">
        {payload.pages.map((page) => (
          <PayloadRow key={page.label} page={page} scale={scale} totalLabel={payload.totalLabel} />
        ))}
      </ul>
      <p className="mt-6 max-w-3xl text-sm leading-6">{payload.scaleNote}</p>
    </section>
  );
}
