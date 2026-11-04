import { templateComposer } from "@/lib/assistant/compose";
import { getComposedStore } from "@/lib/assistant/composed";
import { getAllFacts, getAssistant, getEvals } from "@/lib/content";
import { fill } from "@/lib/evals-view";

// Real model mistakes, from the append-only rejection log in
// data/composed.json: what it wrote, why the checks stopped it, and the
// template wording readers get instead. Nothing here is typed.
export async function Rejections() {
  const r = getEvals().rejections;
  const facts = new Map(getAllFacts().map((f) => [f.id, f]));
  // The same sentence rejected on several runs is one row with a count.
  const grouped = new Map<string, { factId: string; model: string; text: string; reason: string; count: number }>();
  for (const rej of getComposedStore().rejections) {
    const key = `${rej.factId}\u0000${rej.text}`;
    const row = grouped.get(key) ?? { ...rej, count: 0 };
    row.count += 1;
    grouped.set(key, row);
  }
  const rows = await Promise.all(
    [...grouped.values()].map(async (row) => {
      const fact = facts.get(row.factId);
      const published = fact ? [fact.value, ...fact.alsoPublishedAs.map((a) => a.value)] : [];
      const missing = published.filter((v) => !row.text.includes(v));
      const shipped = fact ? (await templateComposer({ facts: [fact], copy: getAssistant().answer })).text : "";
      return { ...row, label: fact?.label ?? row.factId, missing, shipped };
    }),
  );
  const allOmissions = rows.length > 0 && rows.every((row) => row.missing.length > 0);

  return (
    <section aria-labelledby="rejections" className="mt-16 rounded-lg border-2 border-red-700 p-5 sm:p-6 dark:border-red-400">
      <h2 id="rejections" className="text-2xl font-semibold tracking-tight">
        {r.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{rows.length > 0 ? r.intro : r.none}</p>
      {allOmissions && <p className="mt-3 max-w-3xl font-semibold leading-7">{r.allOmissions}</p>}
      <div className="mt-6 grid gap-6">
        {rows.map((row) => (
          <article key={`${row.factId}-${row.text}`} data-rejection={row.factId} className="border-l-4 border-current/30 pl-4">
            <h3 className="font-semibold">{row.label}</h3>
            <p className="text-sm opacity-80">{fill(r.writtenBy, { model: row.model })}</p>
            <dl className="mt-2 grid gap-2 text-sm leading-6 sm:grid-cols-[12rem_1fr]">
              <dt className="font-semibold">{r.columns.wrote}</dt>
              <dd className="[overflow-wrap:anywhere]">
                <q>{row.text}</q>
              </dd>
              <dt className="font-semibold">{r.columns.why}</dt>
              <dd>
                {row.missing.length > 0
                  ? fill(r.omitted, { missing: row.missing.map((v) => `“${v}”`).join(", ") })
                  : fill(r.other, { reason: row.reason })}
                {row.count > 1 && ` ${fill(r.times, { count: row.count })}`}
              </dd>
              <dt className="font-semibold">{r.columns.shipped}</dt>
              <dd className="[overflow-wrap:anywhere]">{row.shipped}</dd>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
