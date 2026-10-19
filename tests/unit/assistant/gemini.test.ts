import { describe, expect, it, vi } from "vitest";
import { composeFacts, mergeStores, settingsFromEnv, wordableFacts } from "@/lib/assistant/compose-facts";
import { checkStore, getComposedStore, sentenceProblem, storedComposer, type StoredSentence } from "@/lib/assistant/composed";
import { templateComposer } from "@/lib/assistant/compose";
import { geminiSentence, GeminiError } from "@/lib/assistant/gemini";
import { prefilter } from "@/lib/assistant/prefilter";
import { getAllFacts, getAssistant } from "@/lib/content";
import type { Fact } from "@/lib/schemas";

// All offline: fetch is stubbed. The demo never needs the network.
const NOW = new Date("2026-10-10T12:00:00Z");
const facts = getAllFacts();
const bg = facts.find((f) => f.id === "lh-bg-weight") as Fact;
const settings = { apiKey: "test-key", model: "test-model" };

const reply = (sentence: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: typeof sentence === "string" ? sentence : JSON.stringify(sentence) }] } }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 20 },
    }),
    { status },
  );

const good = (f: Fact) => ({ text: `${f.label} is ${f.value}.`, citations: [f.id] });

describe("geminiSentence", () => {
  it("sends only the fact and fixed instructions, with the key in a header", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () => reply(good(bg)));
    await geminiSentence(bg, { ...settings, fetch: fetchStub });
    const [url, init] = fetchStub.mock.calls[0];
    expect(String(url)).not.toContain("test-key");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(String(init?.body));
    const prompt: string = body.contents[0].parts[0].text;
    expect(body.contents).toHaveLength(1); // no history
    expect(prompt).toContain(bg.value);
    expect(prompt).not.toContain(bg.basis); // id, label and values only
    expect(body.tools).toBeUndefined(); // no web, no tools
  });

  it.each([
    ["a 503", async () => reply({}, 503), 503],
    ["malformed JSON from the model", async () => reply("not json"), "invalid"],
    ["the wrong JSON shape", async () => reply({ words: "x" }), "invalid"],
    ["a network failure", async () => Promise.reject(new TypeError("fetch failed")), "network"],
  ] as const)("throws a typed error on %s", async (_name, impl, kind) => {
    await expect(geminiSentence(bg, { ...settings, fetch: vi.fn(impl) })).rejects.toMatchObject({ kind });
  });

  it("times out", async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    await expect(geminiSentence(bg, { ...settings, fetch: hang, timeoutMs: 20 })).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("compose:facts batch", () => {
  const sleep = async () => {};

  it("needs both GEMINI_API_KEY and GEMINI_MODEL", () => {
    expect(settingsFromEnv({})).toBeNull();
    expect(settingsFromEnv({ GEMINI_API_KEY: "k" })).toBeNull();
    expect(settingsFromEnv({ GEMINI_API_KEY: "k", GEMINI_MODEL: "m" })).toEqual({ apiKey: "k", model: "m" });
  });

  it("retries a 503, then records a failure; that fact keeps the template", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () => reply({}, 503));
    const store = await composeFacts([bg], { ...settings, fetch: fetchStub, sleep, now: NOW });
    expect(fetchStub).toHaveBeenCalledTimes(3);
    expect(store.failed[bg.id].attempts.map((a) => a.status)).toEqual(["503", "503", "503"]);
    const out = await storedComposer(checkStore(store, facts, NOW))({ facts: [bg], copy: getAssistant().answer });
    expect(out.wordedBy).toEqual(["template"]);
  });

  it("rejects a sentence that forecasts, and one that drops the exact value", async () => {
    const replies = [{ text: `${bg.value}. EnergyX will likely list soon.`, citations: [bg.id] }, { text: "About fifty MB.", citations: [bg.id] }];
    for (const sentence of replies) {
      const store = await composeFacts([bg], { ...settings, fetch: vi.fn(async () => reply(sentence)), sleep, now: NOW });
      expect(store.failed[bg.id]?.reason).toMatch(/^rejected/);
      // The rejected text is kept verbatim for /evals.
      expect(store.rejections).toEqual([expect.objectContaining({ factId: bg.id, text: sentence.text, model: "test-model" })]);
    }
  });

  it("--retry-failed merge keeps reviewed sentences and only grows the rejection log", async () => {
    const other = facts.find((f) => f.id === "lh-bg-lcp") as Fact;
    const first = await composeFacts([bg, other], {
      ...settings,
      fetch: vi.fn(async (_url, init) =>
        JSON.parse(String(init?.body)).contents[0].parts[0].text.includes(bg.id)
          ? reply({ text: "About fifty MB.", citations: [bg.id] })
          : reply(good(other)),
      ),
      sleep,
      now: NOW,
    });
    const rerun = await composeFacts([bg], { ...settings, fetch: vi.fn(async () => reply(good(bg))), sleep, now: NOW });
    const merged = mergeStores(first, rerun);
    expect(Object.keys(merged.sentences).sort()).toEqual([bg.id, other.id].sort());
    expect(merged.sentences[other.id]).toBe(first.sentences[other.id]);
    // The retried fact's earlier (rejected) attempt is kept in its history.
    expect(merged.sentences[bg.id].attempts).toHaveLength(2);
    expect(merged.failed).toEqual({});
    expect(merged.rejections).toHaveLength(1);
    expect(() => mergeStores(first, { ...rerun, model: "another-model" })).toThrow(/can't merge/);
  });

  it("stores a good sentence and serves it, worded by the model", async () => {
    const store = await composeFacts([bg], { ...settings, fetch: vi.fn(async () => reply(good(bg))), sleep, now: NOW });
    const out = await storedComposer(checkStore(store, facts, NOW))({ facts: [bg], copy: getAssistant().answer });
    expect(out).toMatchObject({ text: good(bg).text, wordedBy: ["test-model"] });
  });
});

describe("stored sentences", () => {
  const sentence = (over: Partial<StoredSentence>): StoredSentence => ({
    text: `${bg.label} is ${bg.value}.`,
    label: bg.label,
    value: bg.value,
    alsoPublishedAs: [],
    attempts: [],
    tokensIn: 0,
    tokensOut: 0,
    ...over,
  });

  it("rejects a stale sentence when the fact changes", () => {
    expect(sentenceProblem({ ...bg, value: "9.9 MB" }, sentence({}), NOW)).toMatch(/stale/);
  });

  it("every committed sentence passes today's checks (else re-run pnpm compose:facts)", () => {
    expect(Object.fromEntries(getComposedStore().rejected)).toEqual({});
  });

  it("every wordable fact's template line passes the output pre-filter", async () => {
    for (const fact of wordableFacts(facts)) {
      const { text } = await templateComposer({ facts: [fact], copy: getAssistant().answer });
      expect(prefilter(text, NOW), fact.id).toBeNull();
    }
  });

  it("GeminiError carries its kind", () => {
    expect(new GeminiError("x", 503).kind).toBe(503);
  });
});
