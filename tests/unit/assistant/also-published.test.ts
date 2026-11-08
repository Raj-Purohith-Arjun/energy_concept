import { describe, expect, it } from "vitest";
import { alsoLines, joinFigures, templateComposer } from "@/lib/assistant/compose";
import { renderPost } from "@/lib/assistant/composed-posts";
import { templateDraftComposer } from "@/lib/assistant/draft";
import { EVAL_NOW } from "@/lib/assistant/eval-cases";
import { ask } from "@/lib/assistant/pipeline";
import { buildRegistry, getAllFacts, getAssistant, getSite } from "@/lib/content";
import { fakeAlso, fakeFact, fakeFile } from "../../fixtures/facts";

// A fact with several other published figures reads as ONE "Also published as"
// list (answers, draft template) or ONE parenthetical (model posts), never one
// phrase per figure. A single other figure reads exactly as it always did.
const assistant = getAssistant();
const forwardLooking = getSite().forwardLooking;
const fact = (alts: string[]) =>
  [...buildRegistry(fakeFile(fakeFact({ alsoPublishedAs: alts.map((value) => fakeAlso({ value })) }))).values()][0];
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("joinFigures", () => {
  it("joins with commas", () => {
    expect(joinFigures(["a", "b", "c"])).toBe("a, b, c");
    expect(joinFigures(["a"])).toBe("a");
  });

  it("joins with semicolons when a figure contains a comma, so the list stays unambiguous", () => {
    expect(joinFigures(["1,000 tons", "2,000 tons"])).toBe("1,000 tons; 2,000 tons");
  });
});

describe("answers and the draft template", () => {
  it("one other figure reads exactly as before", () => {
    expect(alsoLines(fact(["456 widgets"]), assistant.answer)).toEqual(["Also published as 456 widgets."]);
  });

  it("no other figure adds no line", () => {
    expect(alsoLines(fact([]), assistant.answer)).toEqual([]);
  });

  it("several other figures are one line, in registry order", async () => {
    const f = fact(["456 widgets", "789 widgets", "321 widgets"]);
    expect(alsoLines(f, assistant.answer)).toEqual(["Also published as 456 widgets, 789 widgets, 321 widgets."]);
    const { text } = await templateComposer({ facts: [f], copy: assistant.answer });
    expect(count(text, "Also published as")).toBe(1);
    expect(text).toBe("Fake widgets: 123 widgets. Also published as 456 widgets, 789 widgets, 321 widgets.");
  });

  it("the post-draft template bullet does the same", async () => {
    const f = fact(["456 widgets", "789 widgets"]);
    const { text } = await templateDraftComposer({
      facts: [f],
      topics: ["Fake"],
      draft: assistant.draft,
      answer: assistant.answer,
      forwardLooking,
    });
    expect(count(text, "Also published as")).toBe(1);
    expect(text).toContain("• Fake widgets: 123 widgets. Also published as 456 widgets, 789 widgets.");
  });

  it("the real DLE answer lists its other timings once, and still passes every check", async () => {
    const outcome = await ask("How long does EnergyX's DLE process take?", { facts: getAllFacts(), assistant, now: EVAL_NOW, warn: () => {} });
    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") return;
    expect(count(outcome.text, "Also published as")).toBe(1);
    for (const published of ["Hours", "hours to days", "1-2 days"]) expect(outcome.text).toContain(published);
  });
});

describe("model posts", () => {
  const render = { closing: assistant.draft.linkedin.closing, forwardLooking };
  const post = (f: ReturnType<typeof fact>) => renderPost({ hook: "EnergyX publishes {fact:fake-widgets}.", paragraphs: [] }, [f], render);

  it("one other figure keeps its parenthetical", () => {
    const r = post(fact(["456 widgets"]));
    expect(r.ok && r.text).toContain("123 widgets (also published as 456 widgets)");
  });

  it("several other figures share one parenthetical", () => {
    const r = post(fact(["456 widgets", "789 widgets", "321 widgets"]));
    if (!r.ok) throw new Error(JSON.stringify(r.problems));
    expect(count(r.text, "also published as")).toBe(1);
    expect(r.text).toContain("123 widgets (also published as 456 widgets, 789 widgets, 321 widgets)");
  });
});
