import { describe, expect, it } from "vitest";
import { CAUGHT_TOPIC, findCaughtClaim } from "@/lib/assistant/caught-claim";
import { getPostStore, shippedPostText } from "@/lib/assistant/composed-posts";
import { draftPool } from "@/lib/assistant/draft";
import { getAllFacts, getAssistant, getSite } from "@/lib/content";

const assistant = getAssistant();
const pool = draftPool([CAUGHT_TOPIC], getAllFacts(), assistant).slice(0, assistant.draft.maxFacts);
const ctx = { brand: assistant.draft.brand, forwardLooking: getSite().forwardLooking };
const stored = getPostStore().rejections;
const target = stored.find((r) => r.topicId === CAUGHT_TOPIC && r.note);

describe("the caught claim walkthrough on /evals", () => {
  it("shows the stored sentence word for word, its figure from the registry, 'grant' nowhere in it", () => {
    const claim = findCaughtClaim(stored, pool, ctx);
    const sentence = claim.words.map((w) => w.text).join(" ");
    expect(target?.text).toContain(sentence);
    expect(sentence).not.toMatch(/grant/i);
    expect(claim.words.find((w) => w.fact)?.fact?.id).toBe("ex-lonestar-doe");
    expect(claim.words.find((w) => w.caught)?.text).toBe("backing");
    expect(claim.reason).toBe(target?.problems[0].detail);
    expect(claim.model).toBe(target?.model);
  });

  it("what shipped instead exists and does not repeat the refused word", async () => {
    const shipped = await shippedPostText(CAUGHT_TOPIC);
    expect(shipped).not.toBe("");
    expect(shipped).not.toMatch(/backing/i);
  });

  it("fails the build when the record is gone", () => {
    expect(() => findCaughtClaim([], pool, ctx)).toThrow(/no stored rejection/);
  });

  it("fails the build when the checks no longer stop the post", () => {
    const clean = stored.map((r) => (r === target ? { ...r, text: r.text.replace("backing", "for") } : r));
    expect(() => findCaughtClaim(clean, pool, ctx)).toThrow(/no longer stop/);
  });

  it("fails the build when a figure in the post no longer matches the registry", () => {
    const stale = pool.map((f) => (f.id === "ex-lonestar-target" ? { ...f, value: `${f.value} changed` } : f));
    expect(() => findCaughtClaim(stored, stale, ctx)).toThrow(/figures passed/);
  });
});
