import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DraftPanel } from "@/components/assistant/Panels";
import {
  basisContext,
  composeOnly,
  composePosts,
  mergePostStores,
  onlyTopic,
  postFacts,
  postInstructions,
  postPrompt,
} from "@/lib/assistant/compose-posts";
import {
  checkPostStore,
  getPostStore,
  PostStoreSchema,
  type PostStore,
  renderPost,
  storedDraftComposer,
  type PostParts,
} from "@/lib/assistant/composed-posts";
import { templateDraftComposer, type DraftInput } from "@/lib/assistant/draft";
import { ask } from "@/lib/assistant/pipeline";
import { getAllFacts, getAssistant, getSite } from "@/lib/content";

// Whole LinkedIn posts written at build time (Day 3). Offline: fetch is stubbed.
const NOW = new Date("2026-10-10T12:00:00Z");
const facts = getAllFacts();
const assistant = getAssistant();
const forwardLooking = getSite().forwardLooking;
const { marker, note } = forwardLooking;
const settings = { apiKey: "test-key", model: "test-model" };
const ctx = { assistant, forwardLooking, now: NOW };
const render = { closing: assistant.draft.linkedin.closing, forwardLooking };
const sleep = async () => {};

const reply = (post: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(post) }] } }],
      usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 80 },
    }),
    { status },
  );

const ALL = "{fact:ex-bg-acres} {fact:ex-bg-capacity} {fact:ex-bg-insitu}";
const BLACK_GIANT: PostParts = {
  hook: "EnergyX publishes that Black Giant is in {fact:ex-bg-location}.",
  paragraphs: [
    "EnergyX describes a resource area of {fact:ex-bg-acres}, a planned capacity of {fact:ex-bg-capacity} and an in-situ resource estimate of {fact:ex-bg-insitu}.",
  ],
};
const bgFacts = postFacts("black-giant", facts, assistant);
const bgInput: DraftInput = {
  facts: bgFacts,
  topics: ["Black Giant"],
  topicId: "black-giant",
  draft: assistant.draft,
  answer: assistant.answer,
  forwardLooking,
};

const compose = (parts: unknown, topicIds = ["black-giant"], status = 200) =>
  composePosts(facts, assistant, forwardLooking, {
    ...settings,
    topicIds,
    sleep,
    now: NOW,
    fetch: vi.fn<typeof fetch>(async () => reply(parts, status)),
  });

describe("renderPost", () => {
  it("fills figures from the registry, marks plans and estimates, and ends with the closing and footnote", () => {
    const out = renderPost(BLACK_GIANT, bgFacts, render);
    if (!out.ok) throw new Error(JSON.stringify(out.problems));
    expect(out.text).toContain(`53Ktpa LCE${marker}`);
    expect(out.text).toContain(`9.8M tonnes LCE${marker}`);
    expect(out.text).toContain("100,000+ acres");
    expect(out.text).not.toContain(`100,000+ acres${marker}`);
    expect(out.text.split("\n").slice(-3)).toEqual([assistant.draft.linkedin.closing, "", `${marker} ${note}`]);
    expect(out.citations).toEqual(bgFacts.map((f) => f.id));
  });

  it.each<[string, PostParts, RegExp]>([
    ["a number it typed itself", { ...BLACK_GIANT, paragraphs: [`It covers 100,000 acres: ${ALL}`] }, /typed a number/],
    ["a number written as a word", { ...BLACK_GIANT, paragraphs: [`Forty sites. ${ALL}`] }, /typed a number/],
    ["a token for a fact that isn't there", { ...BLACK_GIANT, hook: "{fact:ex-gm} {fact:ex-bg-location}" }, /unknown fact token/],
    ["a fact it never used", { hook: BLACK_GIANT.hook, paragraphs: ["{fact:ex-bg-acres}"] }, /never used/],
    ["a multi-line hook", { ...BLACK_GIANT, hook: "One.\nTwo {fact:ex-bg-location}" }, /one sentence/],
    ["too many paragraphs", { ...BLACK_GIANT, paragraphs: Array<string>(4).fill(ALL) }, /paragraphs/],
    [
      "two sentences that begin EnergyX publishes",
      { ...BLACK_GIANT, paragraphs: ["EnergyX publishes {fact:ex-bg-acres}. EnergyX publishes {fact:ex-bg-capacity} and {fact:ex-bg-insitu}."] },
      /begins "EnergyX publishes"/,
    ],
  ])("refuses %s", (_name, parts, detail) => {
    const out = renderPost(parts, bgFacts, render);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.problems.map((p) => p.detail).join("|")).toMatch(detail);
  });
});

describe("what the model is told", () => {
  it("is the voice rules from assistant.json, and fact labels and kinds but never a value", () => {
    expect(postInstructions(assistant)).toContain(assistant.draft.voice.rules[0]);
    for (const topicId of assistant.draft.voice.postTopics) {
      const topicFacts = postFacts(topicId, facts, assistant);
      const prompt = postPrompt(assistant.draft.topics[topicId].label, topicFacts);
      for (const f of topicFacts) {
        expect(prompt).toContain(`{fact:${f.id}}`);
        expect(prompt).not.toContain(f.value);
      }
      // The basis prose is sent, but never a digit from it.
      expect(prompt).toContain("basis: ");
      expect(prompt).not.toMatch(/basis:[^\n]*\d/);
    }
  });

  it("masks a figure in the basis and keeps the sentence", () => {
    const water = facts.find((f) => f.id === "ex-water-reduction");
    if (!water) throw new Error("ex-water-reduction missing");
    const basis = basisContext(water);
    expect(basis).not.toMatch(/\d/);
    expect(basis).toContain("[figure] gallons per ton");
    expect(basis).toContain("The FAQ also gives the underlying figures");
  });
});

describe("compose:posts batch", () => {
  it("stores a good post as finished text, and the site then serves it for the whole topic", async () => {
    const store = await compose(BLACK_GIANT);
    expect(store.rejections).toEqual([]);
    expect(store.posts["black-giant"].text).toContain(`53Ktpa LCE${marker}`);

    const checked = checkPostStore(PostStoreSchema.parse(store), facts, ctx);
    expect([...checked.rejected]).toEqual([]);
    const composeDraft = storedDraftComposer(checked);
    const deps = { facts, assistant, now: NOW, warn: () => {}, composeDraft };

    const whole = await ask("Write a LinkedIn post about Black Giant", deps);
    if (whole.kind !== "draft") throw new Error(whole.kind);
    expect(whole.wordedBy).toEqual(["test-model"]);
    expect(whole.rejected).toEqual([]);
    expect(whole.text).toBe(store.posts["black-giant"].text);
    expect(whole.text).not.toMatch(/^•/m); // prose, not stacked bullets
    expect(whole.facts).toHaveLength(4);

    // A request narrowed to one fact is not what the stored post was written for.
    const narrowed = await ask("Write a LinkedIn post about Black Giant capacity", deps);
    expect(narrowed.kind === "draft" && narrowed.wordedBy).toEqual(["template"]);
  });

  it("drops a stored post when a fact has changed since it was written", async () => {
    const store = await compose(BLACK_GIANT);
    const changed = facts.map((f) => (f.id === "ex-bg-capacity" ? { ...f, value: "60Ktpa LCE" } : f));
    const checked = checkPostStore(PostStoreSchema.parse(store), changed, ctx);
    expect(checked.accepted.size).toBe(0);
    expect(checked.rejected.get("black-giant")).toMatch(/stale/);
    expect((await storedDraftComposer(checked)(bgInput)).wordedBy).toEqual(["template"]);
  });

  it.each<[string, PostParts, string, string]>([
    ["types a number", { ...BLACK_GIANT, paragraphs: [`Capacity is 53 kilotonnes. ${ALL}`] }, "Capacity is 53 kilotonnes.", "typed a number"],
    ["calls the project a major step", { ...BLACK_GIANT, paragraphs: [`A major step: ${ALL}`] }, "A major step:", 'promotional wording: "major"'],
    ["forecasts", { ...BLACK_GIANT, paragraphs: [`Production will start soon. ${ALL}`] }, "Production will start soon.", "language"],
  ])("a post that %s is refused, recorded as written, and its topic keeps the template", async (_name, parts, wrote, detail) => {
    const store = await compose(parts);
    expect(store.posts).toEqual({});
    expect(store.failed["black-giant"].reason).toMatch(/^rejected/);
    expect(store.rejections).toHaveLength(1);
    expect(store.rejections[0].text).toContain(wrote); // the model's own words, with figures filled in when it got that far
    expect(store.rejections[0].problems.map((p) => p.detail).join("|")).toContain(detail);
    const served = await storedDraftComposer(checkPostStore(store, facts, ctx))(bgInput);
    expect(served).toEqual(await templateDraftComposer(bgInput));
  });

  it("retries an overloaded model, then records the failure; no rejection, template used", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () => reply({}, 503));
    const store = await composePosts(facts, assistant, forwardLooking, { ...settings, topicIds: ["lonestar"], sleep, now: NOW, fetch: fetchStub });
    expect(fetchStub).toHaveBeenCalledTimes(3);
    expect(store.failed.lonestar.attempts.map((a) => a.status)).toEqual(["503", "503", "503"]);
    expect(store.rejections).toEqual([]);
  });

  it("merging a retry keeps reviewed posts and the whole rejection log", async () => {
    const bad = await compose({ ...BLACK_GIANT, hook: "It is a major project in {fact:ex-bg-location}." });
    const good = await compose(BLACK_GIANT);
    const merged = mergePostStores(bad, good);
    expect(Object.keys(merged.posts)).toEqual(["black-giant"]);
    expect(merged.failed).toEqual({});
    expect(merged.rejections).toHaveLength(1);
  });
});

describe("--only <topic>", () => {
  const topics = assistant.draft.voice.postTopics;

  it("rejects an unknown or missing topic with the list of valid ones", () => {
    expect(() => onlyTopic(["--only", "weather"], topics)).toThrow(/Unknown topic "weather".*black-giant/);
    expect(() => onlyTopic(["--only"], topics)).toThrow(/needs a topic/);
    expect(() => onlyTopic(["--only", "--retry-failed"], topics)).toThrow(/needs a topic/);
    expect(onlyTopic(["--only", "lonestar"], topics)).toBe("lonestar");
    expect(onlyTopic([], topics)).toBeNull();
  });

  it("rewrites one topic and leaves every other post and the whole rejection log as they were", async () => {
    // Two stored posts and a log entry; only black-giant is written again, by a stub (no network).
    const bad = await compose({ ...BLACK_GIANT, hook: "It is a major project in {fact:ex-bg-location}." });
    const lonestar = await compose(
      {
        hook: "EnergyX describes a grant of {fact:ex-lonestar-doe} for Lonestar.",
        paragraphs: ["The company states a planned capacity of {fact:ex-lonestar-target}."],
      },
      ["lonestar"],
    );
    expect(Object.keys(lonestar.posts)).toEqual(["lonestar"]);
    const previous: PostStore = {
      model: "test-model",
      generatedAt: "2026-11-03T00:00:00.000Z",
      posts: lonestar.posts,
      failed: {},
      rejections: bad.rejections,
    };
    const before = JSON.stringify(previous);
    const fetchStub = vi.fn<typeof fetch>(async () => reply(BLACK_GIANT));
    const { store } = await composeOnly(previous, "black-giant", facts, assistant, forwardLooking, { ...settings, sleep, now: NOW, fetch: fetchStub });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(Object.keys(store.posts).sort()).toEqual(["black-giant", "lonestar"]);
    expect(JSON.stringify(store.posts.lonestar)).toBe(JSON.stringify(previous.posts.lonestar));
    expect(store.failed).toEqual(previous.failed);
    expect(store.rejections).toEqual(previous.rejections); // nothing new rejected, nothing lost
    expect(JSON.stringify(previous)).toBe(before); // the input is not mutated
  });

  it("keeps the log and adds the new rejection when the rewritten topic is refused again", async () => {
    const previous = await compose(BLACK_GIANT);
    const { store } = await composeOnly(previous, "black-giant", facts, assistant, forwardLooking, {
      ...settings,
      sleep,
      now: NOW,
      fetch: vi.fn<typeof fetch>(async () => reply({ ...BLACK_GIANT, hook: "It is a major project in {fact:ex-bg-location}." })),
    });
    expect(store.posts["black-giant"]).toBeUndefined(); // the template serves
    expect(store.failed["black-giant"].reason).toMatch(/^rejected/);
    expect(store.rejections.length).toBeGreaterThan(previous.rejections.length);
  });
});

describe("the committed posts", () => {
  it("every post in data/composed-posts.json passes today's checks", () => {
    const store = getPostStore();
    expect([...store.rejected]).toEqual([]);
    for (const topicId of store.accepted.keys()) expect(assistant.draft.voice.postTopics).toContain(topicId);
  });

  it("every post topic is a draft topic", () => {
    for (const id of assistant.draft.voice.postTopics) expect(assistant.draft.topics[id], id).toBeDefined();
  });
});

describe("the sources block under a draft", () => {
  it("is collapsed behind a count", async () => {
    const question = "Write a LinkedIn post about Black Giant";
    const outcome = await ask(question, { facts, assistant, now: NOW, warn: () => {} });
    if (outcome.kind !== "draft") throw new Error(outcome.kind);
    const html = renderToStaticMarkup(DraftPanel({ outcome, question }));
    const details = html.indexOf("<details");
    expect(details).toBeGreaterThan(-1);
    expect(html.slice(details, details + 10)).not.toContain("open");
    expect(html).toContain("4 figures, all sourced");
    // The per-fact detail only appears inside the collapsed block.
    expect(html.indexOf("EnergyX homepage, projects")).toBeGreaterThan(details);
  });
});
