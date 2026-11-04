import Link from "next/link";
import { plural } from "@/lib/plural";
import type { Fact, GapRow, GapsCopy, GapsFile } from "@/lib/schemas";

// The gap report (CLAUDE.md section 5): questions the assistant could not
// answer, grouped by subject, for a marketing lead. A server component that
// takes its data as props, so it renders the same in tests as on the page.
// Verdict first; the detail sits behind native <details>, no client code.

const UNMATCHED = "unmatched";

function subjectLabel(subject: string, copy: GapsCopy): string {
  if (subject === UNMATCHED) return copy.unmatchedSubject;
  const spaced = subject.replace(/-/g, " ");
  // Concept keys of three letters or fewer are acronyms (dle, lcp, cls).
  if (spaced.length <= 3) return spaced.toUpperCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function groupBySubject(rows: GapRow[]): Map<string, GapRow[]> {
  const groups = new Map<string, GapRow[]>();
  for (const row of rows) groups.set(row.subject, [...(groups.get(row.subject) ?? []), row]);
  return groups;
}

export function GapsReport({ gaps, facts, copy }: { gaps: GapsFile; facts: Fact[]; copy: GapsCopy }) {
  const labels = new Map(facts.map((f) => [f.id, f.label]));
  const groups = groupBySubject(gaps.gaps);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 lg:px-8">
      <h1 className="h-page">{copy.heading}</h1>
      <p className="verdict-lead mt-3 max-w-3xl">{copy.framing}</p>

      {gaps.gaps.length === 0 ? (
        <section aria-labelledby="gaps-empty" data-gaps-empty="" className="mt-10 rounded-lg border border-line p-5">
          <h2 id="gaps-empty" className="text-xl font-semibold">
            {copy.empty.heading}
          </h2>
          <p className="mt-2 max-w-3xl leading-7">{copy.empty.body}</p>
        </section>
      ) : (
        <>
          <p data-gaps-verdict="" className="mt-8 max-w-3xl border-l-4 border-current pl-4 text-xl font-semibold leading-8">
            {copy.verdict
              .replace("{questions}", plural(gaps.gaps.length, copy.questions))
              .replace("{subjects}", plural(groups.size, copy.subjects))}
          </p>
          <div className="mt-8 grid gap-4">
            {[...groups].map(([subject, rows]) => (
              <details key={subject} data-gap-subject={subject} className="rounded-lg border border-line p-5">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 text-lg font-semibold">
                  {subjectLabel(subject, copy)} <span className="font-normal text-muted">· {plural(rows.length, copy.questions)}</span>
                </summary>
                <div className="mt-4 grid gap-6">
                  {rows.map((row) => (
                    <article key={row.question} data-gap="" className="border-l-4 border-line pl-4">
                      <dl className="grid gap-2 text-sm leading-6 sm:grid-cols-[12rem_1fr]">
                        <dt className="font-semibold">{copy.columns.asked}</dt>
                        <dd className="[overflow-wrap:anywhere]">
                          <q>{row.question}</q>
                          {row.count > 1 && <span className="text-muted"> · {plural(row.count, copy.times)}</span>}
                        </dd>
                        <dt className="font-semibold">{copy.columns.nearest}</dt>
                        <dd>
                          {row.nearest.length === 0 ? (
                            copy.noNearest
                          ) : (
                            <ul className="list-disc pl-5">
                              {row.nearest.map((id) => (
                                <li key={id}>
                                  <Link href={`/facts#fact-${id}`} className="underline underline-offset-2">
                                    {labels.get(id) ?? id}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </dd>
                        <dt className="font-semibold">{copy.columns.suggested}</dt>
                        <dd>{copy.suggestedPlaceholder}</dd>
                      </dl>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
