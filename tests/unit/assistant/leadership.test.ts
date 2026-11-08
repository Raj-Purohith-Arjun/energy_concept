import { describe, expect, it } from "vitest";
import { EVAL_NOW } from "@/lib/assistant/eval-cases";
import { ask } from "@/lib/assistant/pipeline";
import { retrieve } from "@/lib/assistant/retrieve";
import { getAllFacts, getAssistant } from "@/lib/content";

// ex-ceo and ex-cmo were checked against https://energyx.com/about-us/ on
// 2026-11-08 and are verified, so the assistant answers who leads EnergyX.
// This pins the registry entries, the concepts that find them, the answers, and
// that the example questions offered on the home page are ones that really answer.
const assistant = getAssistant();
const facts = getAllFacts();
const run = (question: string) => ask(question, { facts, assistant, now: EVAL_NOW, warn: () => {} });

describe("leadership facts (ex-ceo, ex-cmo)", () => {
  it("are EnergyX's own stated company claims, verified, unapproved, with a dated source", () => {
    for (const id of ["ex-ceo", "ex-cmo"]) {
      const fact = facts.find((f) => f.id === id);
      expect(fact, id).toBeDefined();
      expect(fact).toMatchObject({ kind: "company-claim", basisSource: "stated", owner: "Company", approvedAt: null, verified: true });
      expect(fact?.source.url).toBe("https://energyx.com/about-us/");
      expect(fact?.source.accessed).toBe("2026-11-08");
    }
    expect(facts.find((f) => f.id === "ex-ceo")?.value).toBe("Teague Egan");
    expect(facts.find((f) => f.id === "ex-cmo")?.value).toBe("Kellee Khalil");
  });

  it("retrieval finds each one and only that one, by its common phrasings", () => {
    const ids = (q: string) => retrieve(q, facts, assistant).map((f) => f.id);
    for (const q of ["Who is the CEO?", "Who is EnergyX's chief executive?", "Who is the chief executive officer?", "Who is the founder?"]) {
      expect(ids(q), q).toEqual(["ex-ceo"]);
    }
    for (const q of ["Who is EnergyX's CMO?", "Who is the chief marketing officer?", "Who is the head of marketing?"]) {
      expect(ids(q), q).toEqual(["ex-cmo"]);
    }
  });

  it("answers with the name and cites the fact", async () => {
    const ceo = await run("Who is EnergyX's CEO?");
    expect(ceo.kind === "answer" && ceo.text).toContain("Teague Egan");
    expect(ceo.kind === "answer" && ceo.facts.map((f) => f.id)).toEqual(["ex-ceo"]);
    const cmo = await run("Who is EnergyX's CMO?");
    expect(cmo.kind === "answer" && cmo.text).toContain("Kellee Khalil");
    expect(cmo.kind === "answer" && cmo.facts.map((f) => f.id)).toEqual(["ex-cmo"]);
  });

  it("has a suggested question for each, which is what retrieval offers as a did-you-mean", () => {
    expect(assistant.questions["ex-ceo"]).toBe("Who is EnergyX's CEO?");
    expect(assistant.questions["ex-cmo"]).toBe("Who is EnergyX's CMO?");
  });
});

describe("example questions on the home page", () => {
  const [answered, , , notCovered] = assistant.examples.groups;

  it("offers the CEO and CMO questions among the answered examples, not the not-covered ones", () => {
    expect(answered.label).toBe("Answered from the registry");
    expect(answered.questions).toEqual(expect.arrayContaining(["Who is EnergyX's CEO?", "Who is EnergyX's CMO?"]));
    expect(notCovered.label).toBe("Not covered yet");
    expect(notCovered.questions).not.toContain("Who is EnergyX's CEO?");
    expect(notCovered.questions).not.toContain("Who is EnergyX's CMO?");
  });

  it("every answered example answers, and every not-covered example does not", async () => {
    for (const q of answered.questions) expect((await run(q)).kind, q).toBe("answer");
    for (const q of notCovered.questions) expect(await run(q), q).toMatchObject({ kind: "no-answer", reason: "no-match" });
  });
});
