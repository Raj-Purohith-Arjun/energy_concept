import { getFindings } from "@/lib/content";
import { FactOrPending } from "./FactOrPending";

export function BeforeAfter() {
  const { comparison: c } = getFindings();
  return (
    <section aria-labelledby="before-after" className="mt-16">
      <h2 id="before-after" className="text-2xl font-semibold tracking-tight">
        {c.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{c.intro}</p>
      <table className="mt-6 w-full max-w-3xl border-collapse text-left">
        <caption className="mb-2 text-left text-sm">{c.caption}</caption>
        <thead>
          <tr className="border-b border-current/30">
            <th scope="col" className="py-2 pr-3 font-semibold">
              {c.columns.metric}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {c.columns.before}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {c.columns.after}
            </th>
          </tr>
        </thead>
        <tbody>
          {c.rows.map((row) => (
            <tr key={row.label} className="border-b border-current/15 align-top">
              <th scope="row" className="py-3 pr-3 font-normal">
                {row.label}
              </th>
              <td className="py-3 pr-3">
                <FactOrPending factRef={row.before} />
              </td>
              <td className="py-3">
                <FactOrPending factRef={row.after} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 max-w-3xl text-sm leading-6">{c.method}</p>
    </section>
  );
}
