import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NoAnswerPanel } from "@/components/assistant/Panels";
import type { DraftComposer } from "@/lib/assistant/draft";
import { checkDraft, templateDraftComposer } from "@/lib/assistant/draft";
import { EVAL_NOW } from "@/lib/assistant/eval-cases";
import { routeIntent } from "@/lib/assistant/intent";
import { ask, type AssistantOutcome } from "@/lib/assistant/pipeline";
import { getAllFacts, getAssistant, getSite } from "@/lib/content";

// Day 2 of CLAUDE.md §7: the intent router and LinkedIn drafting.
const deps = { facts: getAllFacts(), assistant: getAssistant(), now: EVAL_NOW, warn: () => {} };
const run = (q: string, composeDraft?: DraftComposer) => ask(q, { ...deps, composeDraft });
const { marker, note } = getSite().forwardLooking;

function drafted(outcome: AssistantOutcome) {
  if (outcome.kind !== "draft") throw new Error(`expected a draft, got ${outcome.kind}`);
  return outcome;
}

describe("intent router", () => {
  it.each([
    "Write a LinkedIn post about Black Giant",
    "please draft a LinkedIn post on water",
    "Give me a post about Lonestar",
    "I need a LinkedIn post about patents",
    "Could you do a LinkedIn post about water?",
  ])("draft: %s", (q) => expect(routeIntent(q)).toEqual({ intent: "draft", format: "linkedin", asQuestion: false }));

  it.each([
    "Can a LinkedIn post mention Black Giant?",
    "Could a post cover the water figures?",
    "Should a LinkedIn post include the capacity?",
  ])("a draft phrased as a question: %s", (q) =>
    expect(routeIntent(q)).toEqual({ intent: "draft", format: "linkedin", asQuestion: true }),
  );

  it.each([
    ["Write a web page section about water", "section"],
    ["Write an email to investors", "investor"],
    ["Draft a LinkedIn post for shareholders", "investor"],
    ["Write a press release", "other"],
  ])("format of %s is %s", (q, format) => expect(routeIntent(q)).toMatchObject({ intent: "draft", format }));

  it.each([
    ["LinkedIn post about Black Giant", "no-verb"],
    ["A post on water", "no-verb"],
    ["Write about water", "no-format"],
    ["Can you write something about Black Giant?", "no-format"],
  ])("unsure: %s", (q, why) => expect(routeIntent(q)).toEqual({ intent: "unsure", why }));

  it.each([
    "How do I write to EnergyX?",
    "Who wrote the Black Giant page?",
    "What is the LinkedIn page weight?",
    "How heavy is the Black Giant page?",
    "Could the Black Giant page include a video?",
    "Does EnergyX post its patents?",
    "What is the capacity?",
  ])("answer: %s", (q) => expect(routeIntent(q)).toEqual({ intent: "answer" }));
});

describe("refusal comes before routing", () => {
  it.each(["Can a LinkedIn post say the shares will go up?", "Write a LinkedIn post about when the IPO is"])("%s", async (q) => {
    expect((await run(q)).kind).toBe("refuse");
  });
});

describe("a question that fits several facts equally", () => {
  it("asks which, offering every tied fact rather than three picked by registry order", async () => {
    const outcome = await run("What is the capacity?");
    expect(outcome.kind).toBe("clarify");
    if (outcome.kind !== "clarify") return;
    expect(outcome.why).toBe("ambiguous");
    const { questions } = getAssistant();
    expect(outcome.options.map((o) => o.question).sort()).toEqual(
      ["ex-bg-capacity", "ex-lonestar-target", "ex-ph-capacity", "ex-bm-target"].map((id) => questions[id]).sort(),
    );
  });

  it("every option it offers then gets an answer", async () => {
    const outcome = await run("What is the capacity?");
    if (outcome.kind !== "clarify") throw new Error(outcome.kind);
    for (const option of outcome.options) expect((await run(option.question)).kind, option.question).toBe("answer");
  });

  it("still answers both facts when a question names both", async () => {
    const outcome = await run("Compare the homepage and Black Giant payloads");
    expect(outcome.kind === "answer" && outcome.facts.map((f) => f.id).sort()).toEqual(["lh-bg-weight", "lh-home-weight"]);
  });
});

describe("unsure about intent", () => {
  it("offers both a draft and questions, on the topic named", async () => {
    const outcome = await run("LinkedIn post about Black Giant");
    if (outcome.kind !== "clarify") throw new Error(outcome.kind);
    expect(outcome.why).toBe("intent");
    const draft = outcome.options.filter((o) => o.mode === "draft").map((o) => o.question);
    const answers = outcome.options.filter((o) => o.mode === "answer").map((o) => o.question);
    expect(draft).toEqual(["Write a LinkedIn post about Black Giant"]);
    expect(answers).toContain("Where is Black Giant?");
    expect(drafted(await run(draft[0])).facts.length).toBeGreaterThan(0);
    for (const q of answers) expect((await run(q)).kind, q).toBe("answer");
  });

  it("still offers both when no topic was named", async () => {
    const outcome = await run("Write about the weather");
    if (outcome.kind !== "clarify") throw new Error(outcome.kind);
    expect(new Set(outcome.options.map((o) => o.mode))).toEqual(new Set(["draft", "answer"]));
  });
});

describe("LinkedIn drafts", () => {
  it("marks a planned figure on its own line and carries the footnote", async () => {
    const { text } = drafted(await run("Write a LinkedIn post about Black Giant capacity"));
    const line = text.split("\n").find((l) => l.includes("53Ktpa LCE"));
    expect(line).toContain(marker);
    expect(line).toContain("a target, not current production");
    expect(text).toContain(`${marker} ${note}`);
  });

  it("has no marker or footnote when no figure is forward-looking", async () => {
    const { text } = drafted(await run("Write a LinkedIn post about patents"));
    expect(text).not.toContain(marker);
    expect(text).not.toContain(note);
  });

  it("marks an estimate as well as a plan", async () => {
    const { text } = drafted(await run("Write a LinkedIn post about Black Giant"));
    expect(text.split("\n").find((l) => l.includes("9.8M tonnes LCE"))).toContain(marker);
  });

  it("does not carry promotional wording from the request into the post, and says so", async () => {
    const outcome = drafted(await run("Write a LinkedIn post saying Black Giant is a game-changing operation"));
    expect(outcome.text.toLowerCase()).not.toContain("game");
    expect(outcome.ignored).toEqual(["game-changing"]);
  });

  it("declines investor email and web page sections out loud, with posts to try", async () => {
    expect(await run("Write an email to investors about Black Giant")).toMatchObject({ kind: "no-answer", reason: "draft", format: "investor" });
    expect(await run("Write a web page section about water")).toMatchObject({ kind: "no-answer", reason: "draft", format: "section" });
  });

  it("offers clickable topics when the post has no topic it holds facts for", async () => {
    const outcome = await run("Write a LinkedIn post about the weather");
    expect(outcome).toMatchObject({ kind: "no-answer", reason: "draft-topic", coverage: [] });
    if (outcome.kind !== "no-answer") return;
    expect(outcome.nearest.length).toBeGreaterThan(0);
    for (const n of outcome.nearest) expect((await run(n.question)).kind, n.question).toBe("draft");
  });
});

describe("the checks over a composed draft", () => {
  // Starts from the valid template, so each stub breaks exactly one rule.
  const breaks =
    (edit: (text: string) => string): DraftComposer =>
    async (input) => {
      const composed = await templateDraftComposer(input);
      return { ...composed, text: edit(composed.text), wordedBy: ["stub"] };
    };
  const REQUEST = "Write a LinkedIn post about Black Giant";

  it.each<[string, DraftComposer, string]>([
    ["invents a number", breaks((t) => `${t}\nIt holds 77 million tonnes.`), "sources"],
    ["writes a number in words", breaks((t) => `${t}\nForty sites are planned.`), "sources"],
    ["forecasts", breaks((t) => `${t}\nProduction will start soon.`), "pre-filter"],
    ["uses a banned phrase", breaks((t) => `${t}\nA game changing project.`), "banned-phrase"],
    ["upgrades a precise noun", breaks((t) => `${t}\nOur Eni partnership is strong.`), "precise-noun"],
    ["drops the marker from a planned figure", breaks((t) => t.split(marker).join("")), "forward-looking"],
    ["drops the footnote", breaks((t) => t.replace(note, "")), "forward-looking"],
  ])("%s: rejected, reason shown, template ships instead", async (_name, composer, rule) => {
    const outcome = drafted(await run(REQUEST, composer));
    expect(outcome.rejected).toHaveLength(1);
    expect(outcome.rejected[0].problems.map((p) => p.rule)).toContain(rule);
    expect(outcome.wordedBy).toEqual(["template"]);
    expect(outcome.rejected[0].text).not.toBe(outcome.text);
  });

  it("a composer that crashes falls back to the template", async () => {
    const outcome = drafted(
      await run(REQUEST, async () => {
        throw new Error("model timeout");
      }),
    );
    expect(outcome.wordedBy).toEqual(["template"]);
    expect(outcome.rejected).toEqual([]);
  });

  it("the shipped template passes every check for every topic", async () => {
    for (const { label } of Object.values(getAssistant().draft.topics)) {
      const outcome = await run(`Write a LinkedIn post about ${label}`);
      expect(outcome.kind === "draft" && outcome.rejected, label).toEqual([]);
    }
  });
});

describe("what a post may be written from", () => {
  const assistant = getAssistant();
  const facts = new Map(getAllFacts().map((f) => [f.id, f]));
  const allowed = Object.values(assistant.draft.topics).flatMap((t) => t.factIds);

  it("every topic is a retrieval concept, and every listed fact exists and is verified", () => {
    for (const id of Object.keys(assistant.draft.topics)) expect(assistant.concepts[id], id).toBeDefined();
    for (const id of allowed) expect(facts.get(id)?.verified, id).toBe(true);
  });

  it("excludes capital-raising facts, Raj's arithmetic and website measurements", () => {
    for (const id of ["ex-funding", "ex-gm", "ex-water-implied-reduction"]) expect(allowed).not.toContain(id);
    expect(allowed.filter((id) => id.startsWith("lh-") || id.startsWith("demo-"))).toEqual([]);
  });

  it("every precise-noun pattern compiles and catches its own upgrade", () => {
    const upgrades: Record<string, string> = {
      Eni: "our eni partnership",
      Army: "the army lease",
      Compass: "the compass supply agreement",
      Lonestar: "lonestar is a commercial plant",
    };
    for (const n of assistant.draft.brand.preciseNouns) {
      expect(new RegExp(n.pattern, "u").test(upgrades[n.noun]), n.noun).toBe(true);
    }
  });

  it("the precise nouns themselves pass", () => {
    const correct: Record<string, string> = {
      Eni: "eni holds a stake",
      Army: "the army conditional lease",
      Compass: "the compass non-binding mou",
      Lonestar: "lonestar is a demonstration plant",
    };
    for (const n of assistant.draft.brand.preciseNouns) {
      expect(new RegExp(n.pattern, "u").test(correct[n.noun]), n.noun).toBe(false);
    }
  });
});

describe("a grant is a grant (keyed off the fact's basis, not its id)", () => {
  const brand = getAssistant().draft.brand;
  const ctx = { brand, forwardLooking: getSite().forwardLooking, now: EVAL_NOW };
  const base = getAllFacts().find((f) => f.id === "ex-lonestar-doe")!;
  // Same shape, different id and wording: the rule must follow the word "grant" in the basis.
  const other = { ...base, id: "x-other", label: "Other award", value: "$9M", alsoPublishedAs: [] };
  const plain = { ...other, id: "x-plain", basis: "A one-off payment described on the page." };
  const check = (fact: typeof base, text: string) =>
    checkDraft({ text, citations: [fact.id], wordedBy: ["t"] }, [fact], ctx).filter((p) => p.rule === "precise-noun");

  it("flags a banned word in the sentence carrying a grant's figure", () => {
    expect(check(other, "Other award: $9M. The $9M is backing the work.")).toHaveLength(1);
    expect(check(other, "The $9M was funded by a grant.")).toHaveLength(1);
  });
  it("leaves the word alone in another sentence, or for a fact that isn't a grant", () => {
    expect(check(other, "Other award: $9M.\nWe support the team.")).toEqual([]);
    expect(check(plain, "The $9M is backing the work.")).toEqual([]);
  });
});

describe("What is EnergyX's revenue?", () => {
  it("offers clickable examples up front and keeps the coverage list collapsed", async () => {
    const outcome = await run("What is EnergyX's revenue?");
    if (outcome.kind !== "no-answer") throw new Error(outcome.kind);
    const html = renderToStaticMarkup(NoAnswerPanel({ outcome, question: "What is EnergyX's revenue?" }));
    const details = html.indexOf("<details");
    expect(details).toBeGreaterThan(-1);
    expect(html).not.toContain("<details open");
    // The labels only appear inside the collapsed block.
    expect(html.indexOf("Black Giant location")).toBeGreaterThan(details);
    // At least one clickable question sits before the collapsed block.
    expect(html.indexOf("?q=")).toBeGreaterThan(-1);
    expect(html.indexOf("?q=")).toBeLessThan(details);
  });
});
