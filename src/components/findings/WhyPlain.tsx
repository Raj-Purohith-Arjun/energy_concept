import { FactText } from "@/components/ui/FactText";
import { getFindings } from "@/lib/content";

// Verdict first, in a plain block; the dated notes sit under it, small.
// Server component, no JavaScript. Not a <details>: the headline copy should
// be visible without a click.
export function WhyPlain() {
  const { heading, body, notesHeading, notes } = getFindings().whyPlain;
  return (
    <section aria-labelledby="why-plain-heading" className="mt-12 max-w-3xl">
      <h2 id="why-plain-heading" className="h-section">
        {heading}
      </h2>
      <p className="mt-3 leading-7">
        <FactText text={body} />
      </p>
      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide">{notesHeading}</h3>
      <ul className="mt-2 grid list-disc gap-2 pl-5 text-sm leading-6">
        {notes.map((note) => (
          <li key={note}>
            <FactText text={note} />
          </li>
        ))}
      </ul>
    </section>
  );
}
