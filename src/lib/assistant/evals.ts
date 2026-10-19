import { getAllFacts, getAssistant } from "@/lib/content";
import { REFUSAL_CATEGORIES } from "@/lib/schemas";
import type { Composer } from "./compose";
import { EVAL_CASES, EVAL_NOW, type EvalCase, type EvalGroup, type Stub } from "./eval-cases";
import type { GateMutation } from "./mutation";
import { ask, type AssistantOutcome } from "./pipeline";

// Runs the eval suite. The unit tests assert gradeCase() on every case; /evals
// calls evalReport() at build time, so the page and the tests share one grader
// and cannot disagree.

// Stand-ins for a model in the composer slot, each misbehaving in one way.
const STUB_COMPOSERS: Record<Stub, Composer> = {
  "invents-number": async ({ facts }) => ({ text: "It is 99 MB.", citations: facts.map((f) => f.id) }),
  "number-in-words": async ({ facts }) => ({ text: "The page is forty megabytes.", citations: facts.map((f) => f.id) }),
  "cites-unretrieved": async ({ facts }) => ({
    text: facts.map((f) => f.value).join(" "),
    citations: ["ex-patents"],
  }),
  "no-citations": async ({ facts }) => ({ text: facts.map((f) => f.value).join(" "), citations: [] }),
  crashes: async () => {
    throw new Error("model timeout");
  },
};

export function runCase(c: EvalCase, mutation?: GateMutation): Promise<AssistantOutcome> {
  return ask(c.question, {
    facts: getAllFacts(),
    assistant: getAssistant(),
    compose: c.stub && STUB_COMPOSERS[c.stub],
    now: EVAL_NOW,
    warn: () => {},
    mutation,
  });
}

export function describeOutcome(o: AssistantOutcome): string {
  if (o.kind === "refuse") return `refuse:${o.category} (${o.trigger})`;
  if (o.kind === "answer") return `answer:${o.facts.map((f) => f.id).join(",")}`;
  return `none:${o.reason}`;
}

export interface Graded {
  case: EvalCase;
  outcome: AssistantOutcome;
  pass: boolean;
}

export function gradeCase(c: EvalCase, outcome: AssistantOutcome): Graded {
  const e = c.expect;
  let pass: boolean;
  if ("refuse" in e) {
    pass = outcome.kind === "refuse" && (e.refuse === "any" || outcome.category === e.refuse);
  } else if ("answer" in e) {
    const got = outcome.kind === "answer" ? outcome.facts.map((f) => f.id).sort() : null;
    pass = got !== null && JSON.stringify(got) === JSON.stringify([...e.answer].sort());
  } else if ("none" in e) {
    pass = outcome.kind === "no-answer" && outcome.reason === e.none;
  } else {
    pass = outcome.kind !== "refuse";
  }
  return { case: c, outcome, pass };
}

export async function runSuite(mutation?: GateMutation, cases = EVAL_CASES): Promise<Graded[]> {
  return Promise.all(cases.map(async (c) => gradeCase(c, await runCase(c, mutation))));
}

// Mutation testing: each mutant switches one guardrail off. A mutant is
// "caught" when at least one case fails. Labels live in content/evals.json.
export const MUTANTS: { id: string; mutation: GateMutation }[] = [
  { id: "prefilter-off", mutation: { prefilterOff: true } },
  ...REFUSAL_CATEGORIES.filter((c) => c !== "planned-figure").map((c) => ({
    id: `category-off:${c}`,
    mutation: { categoriesOff: [c] } as GateMutation,
  })),
  { id: "normalise-off", mutation: { normaliseOff: true } },
  { id: "planned-check-off", mutation: { plannedCheckOff: true } },
  { id: "postcheck-off", mutation: { postcheckOff: true } },
  { id: "refuse-all", mutation: { refuseAll: true } },
  { id: "refuse-none", mutation: { prefilterOff: true, plannedCheckOff: true } },
];

export interface MutantResult {
  id: string;
  failed: number;
  byGroup: Partial<Record<EvalGroup, number>>;
}

export interface EvalReport {
  results: Graded[];
  passed: number;
  categoriesCovered: number;
  categoriesTotal: number;
  mutants: MutantResult[];
}

async function buildReport(): Promise<EvalReport> {
  const results = await runSuite();
  const mutants = await Promise.all(
    MUTANTS.map(async ({ id, mutation }) => {
      const failures = (await runSuite(mutation)).filter((r) => !r.pass);
      const byGroup: MutantResult["byGroup"] = {};
      for (const f of failures) byGroup[f.case.group] = (byGroup[f.case.group] ?? 0) + 1;
      return { id, failed: failures.length, byGroup };
    }),
  );
  const groups = new Set(EVAL_CASES.map((c) => c.group));
  return {
    results,
    passed: results.filter((r) => r.pass).length,
    categoriesCovered: REFUSAL_CATEGORIES.filter((c) => groups.has(c)).length,
    categoriesTotal: REFUSAL_CATEGORIES.length,
    mutants,
  };
}

let report: Promise<EvalReport> | undefined;

/** Runs once per build (or test process) and is shared by every section. */
export function evalReport(): Promise<EvalReport> {
  report ??= buildReport();
  return report;
}
