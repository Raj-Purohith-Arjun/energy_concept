import { describe, expect, it } from "vitest";
import { EVAL_CASES, EVAL_NOW, STUBS } from "@/lib/assistant/eval-cases";
import { describeOutcome, evalReport, gradeCase, MUTANTS, runCase } from "@/lib/assistant/evals";
import { ask } from "@/lib/assistant/pipeline";
import { getAllFacts, getAssistant } from "@/lib/content";
import { REFUSAL_CATEGORIES } from "@/lib/schemas";

// The demo script as a test: real registry, real copy, fixed clock. The cases
// live in src/lib/assistant/eval-cases.ts, shared with /evals.
const deps = { facts: getAllFacts(), assistant: getAssistant(), now: EVAL_NOW, warn: () => {} };
const run = (q: string) => ask(q, deps);

describe("assistant outcomes (eval cases)", () => {
  it.each(EVAL_CASES.map((c) => [c.question.slice(0, 80), c] as const))("%s", async (_q, c) => {
    const outcome = await runCase(c);
    expect(gradeCase(c, outcome).pass, describeOutcome(outcome)).toBe(true);
  });

  it("refuses planned figures without stating them, but cites where to read them", async () => {
    const outcome = await run("What is Black Giant's capacity?");
    expect(outcome).toMatchObject({ kind: "refuse", category: "planned-figure" });
    expect(JSON.stringify(outcome)).not.toMatch(/53K|52,500|tpa/);
    if (outcome.kind === "refuse") expect(outcome.sources[0]?.url).toBe("https://energyx.com/");
  });

  it("answers with every published figure for a fact (days and hours)", async () => {
    const outcome = await run("How long does EnergyX's DLE process take?");
    expect(outcome.kind === "answer" && outcome.text).toMatch(/Days[\s\S]*Hours/);
  });

  it("lists what it can answer when it has no sourced answer", async () => {
    const outcome = await run("Who is EnergyX's CEO?");
    expect(outcome.kind === "no-answer" && outcome.coverage).toContain("DLE processing time");
  });
});

describe("eval suite shape", () => {
  it("covers every refusal category and every stub composer", () => {
    const groups = new Set(EVAL_CASES.map((c) => c.group));
    for (const category of REFUSAL_CATEGORIES) expect(groups.has(category), category).toBe(true);
    expect(new Set(EVAL_CASES.map((c) => c.stub).filter(Boolean))).toEqual(new Set(STUBS));
  });

  it("has unique questions, except the stub cases which share one", () => {
    const questions = EVAL_CASES.filter((c) => !c.stub).map((c) => c.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});

describe("mutation testing", () => {
  it("every mutant is caught by at least one case", async () => {
    const { mutants } = await evalReport();
    expect(mutants.map((m) => m.id)).toEqual(MUTANTS.map((m) => m.id));
    for (const m of mutants) expect(m.failed, m.id).toBeGreaterThan(0);
  });

  it("refuse-all passes every refusal case; only cases that must not be refused catch it", async () => {
    const refuseAll = (await evalReport()).mutants.find((m) => m.id === "refuse-all")!;
    for (const category of REFUSAL_CATEGORIES) expect(refuseAll.byGroup[category], category).toBeUndefined();
    expect(refuseAll.byGroup["must-not-refuse"]).toBe(EVAL_CASES.filter((c) => c.group === "must-not-refuse").length);
  });

  it("the unmutated suite passes in full", async () => {
    const report = await evalReport();
    expect(report.passed).toBe(report.results.length);
  });
});

describe("assistant coverage of the real registry", () => {
  const assistant = getAssistant();

  it.each(getAllFacts().filter((f) => f.verified).map((f) => [f.id]))(
    "verified fact %s is reachable (has retrieval concepts)",
    (id) => {
      expect(assistant.factConcepts[id]).toBeDefined();
    },
  );
});
