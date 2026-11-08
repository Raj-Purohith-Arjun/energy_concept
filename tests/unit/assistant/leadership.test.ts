import { describe, expect, it } from "vitest";
import { EVAL_NOW } from "@/lib/assistant/eval-cases";
import { ask } from "@/lib/assistant/pipeline";
import { retrieve } from "@/lib/assistant/retrieve";
import { getAllFacts, getAssistant } from "@/lib/content";

// ex-ceo and ex-cmo are in the registry but unverified: the owner checks
// https://energyx.com/about-us/ by hand, then flips them. Until then the
// assistant must not see them. This pins both halves, so the concepts are known
// to work before the flip rather than discovered to be wrong after it.
const assistant = getAssistant();
const real = getAllFacts();
const flipped = real.map((f) => (f.id === "ex-ceo" || f.id === "ex-cmo" ? { ...f, verified: true } : f));
const run = (question: string, facts = real) => ask(question, { facts, assistant, now: EVAL_NOW, warn: () => {} });

describe("leadership facts (ex-ceo, ex-cmo)", () => {
  it("are EnergyX's own stated company claims, unapproved and unverified, with a source", () => {
    for (const id of ["ex-ceo", "ex-cmo"]) {
      const fact = real.find((f) => f.id === id);
      expect(fact, id).toBeDefined();
      expect(fact).toMatchObject({ kind: "company-claim", basisSource: "stated", owner: "Company", approvedAt: null, verified: false });
      expect(fact?.source.url).toBe("https://energyx.com/about-us/");
      expect(fact?.source.title).not.toBe("");
      expect(fact?.source.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(real.find((f) => f.id === "ex-ceo")?.value).toBe("Teague Egan");
    expect(real.find((f) => f.id === "ex-cmo")?.value).toBe("Kellee Khalil");
  });

  it("stay invisible while unverified: the question is a gap, not an answer", async () => {
    for (const question of ["Who is EnergyX's CEO?", "Who is EnergyX's CMO?"]) {
      const outcome = await run(question);
      expect(outcome, question).toMatchObject({ kind: "no-answer", reason: "no-match" });
    }
  });

  it("once verified, retrieval finds each one and only that one, by its common phrasings", () => {
    const ids = (q: string) => retrieve(q, flipped, assistant).map((f) => f.id);
    for (const q of ["Who is the CEO?", "Who is EnergyX's chief executive?", "Who is the chief executive officer?", "Who is the founder?"]) {
      expect(ids(q), q).toEqual(["ex-ceo"]);
    }
    for (const q of ["Who is EnergyX's CMO?", "Who is the chief marketing officer?", "Who is the head of marketing?"]) {
      expect(ids(q), q).toEqual(["ex-cmo"]);
    }
  });

  it("once verified, answers with the name and cites the fact", async () => {
    const ceo = await run("Who is EnergyX's CEO?", flipped);
    expect(ceo.kind === "answer" && ceo.text).toContain("Teague Egan");
    expect(ceo.kind === "answer" && ceo.facts.map((f) => f.id)).toEqual(["ex-ceo"]);
    const cmo = await run("Who is EnergyX's CMO?", flipped);
    expect(cmo.kind === "answer" && cmo.text).toContain("Kellee Khalil");
    expect(cmo.kind === "answer" && cmo.facts.map((f) => f.id)).toEqual(["ex-cmo"]);
  });

  it("has a suggested question for each, which is what retrieval offers as a did-you-mean", () => {
    expect(assistant.questions["ex-ceo"]).toBe("Who is EnergyX's CEO?");
    expect(assistant.questions["ex-cmo"]).toBe("Who is EnergyX's CMO?");
  });
});
