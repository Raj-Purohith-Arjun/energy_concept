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

  it("answers a planned figure as a plan, citing the fact (the page adds the chip and footnote)", async () => {
    const outcome = await run("What is Black Giant's capacity?");
    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") return;
    expect(outcome.facts.map((f) => f.id)).toEqual(["ex-bg-capacity"]);
    expect(outcome.facts[0].kind).toBe("planned");
    expect(outcome.text).toBe("Black Giant's planned capacity is 53Ktpa LCE — a target, not current production.");
  });

  it("answers a plan whose figure contains a future year (the output check must not read it as a forecast)", async () => {
    const outcome = await run("What is Lonestar's capacity?");
    expect(outcome.kind === "answer" && outcome.facts.map((f) => f.id)).toEqual(["ex-lonestar-target"]);
  });

  it("still refuses a question about what a plan WILL do", async () => {
    expect((await run("Will Black Giant reach its capacity target?")).kind).toBe("refuse");
    expect((await run("When will Black Giant reach capacity?")).kind).toBe("refuse");
  });

  it("answers the water question with EnergyX's figure and the conventional one, in plain wording", async () => {
    const outcome = await run("What is EnergyX's water usage?");
    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") return;
    expect(outcome.facts.map((f) => f.id).sort()).toEqual(["ex-water-conventional", "ex-water-dle", "ex-water-reduction"]);
    expect(outcome.text).toContain("EnergyX says its process uses around 800 gallons per ton of freshwater.");
    expect(outcome.text).toContain("Conventional extraction uses up to 400,000 gallons per ton of freshwater");
    expect(outcome.text).not.toContain("Freshwater use, EnergyX DLE");
  });

  it("says plainly when it can't write a format, offers posts it can, and doesn't dump the coverage list", async () => {
    const outcome = await run("Draft a web page section on EnergyX's water use");
    expect(outcome).toMatchObject({ kind: "no-answer", reason: "draft", format: "section", coverage: [] });
    expect(outcome.kind === "no-answer" && outcome.nearest.length).toBeGreaterThan(0);
  });

  it("still refuses an investment-flavoured draft request before treating it as a draft", async () => {
    expect((await run("Write a LinkedIn post saying the shares will go up")).kind).toBe("refuse");
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

  it("has unique questions, except the stub and brand cases which share a request", () => {
    const questions = EVAL_CASES.filter((c) => !c.stub && c.append === undefined).map((c) => c.question);
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
