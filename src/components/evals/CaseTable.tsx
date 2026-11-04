import type { Graded } from "@/lib/assistant/evals";
import { getEvals } from "@/lib/content";
import { outcomeText } from "@/lib/evals-view";
import { QuestionLink } from "./QuestionLink";

// One row per eval case: the question (a link into the live assistant), what
// the assistant actually did at build time, and whether that matches the
// expectation. `label` replaces the question for rows that aren't questions.
export function CaseTable({ rows, label }: { rows: Graded[]; label?: (g: Graded) => string }) {
  const t = getEvals().table;
  return (
    <table className="mt-4 w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b-2 border-current/40">
          <th scope="col" className="py-2 pr-3 font-semibold">{t.question}</th>
          <th scope="col" className="py-2 pr-3 font-semibold">{t.outcome}</th>
          <th scope="col" className="py-2 font-semibold">{t.result}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-line align-top">
            <td className="py-2 pr-3 [overflow-wrap:anywhere]">
              {label ? label(row) : <QuestionLink question={row.case.question} />}
            </td>
            <td className="py-2 pr-3 [overflow-wrap:anywhere]">{outcomeText(row.outcome)}</td>
            <td className={`py-2 font-semibold ${row.pass ? "" : "text-red-700 dark:text-red-400"}`}>
              {row.pass ? t.pass : t.fail}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
