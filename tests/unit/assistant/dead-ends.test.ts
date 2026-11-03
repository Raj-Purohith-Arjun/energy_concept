import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EVAL_NOW } from "@/lib/assistant/eval-cases";
import { isDraftRequest } from "@/lib/assistant/intent";
import { ask } from "@/lib/assistant/pipeline";
import { nearest } from "@/lib/assistant/retrieve";
import { recordUnanswered, redact, unansweredEntry } from "@/lib/assistant/unanswered";
import { getAllFacts, getAssistant, getVerifiedFacts } from "@/lib/content";

// Day 1 of CLAUDE.md §7: no dead ends, plans answered, nearest-facts fallback,
// unanswered questions logged.
const deps = { facts: getAllFacts(), assistant: getAssistant(), now: EVAL_NOW, warn: () => {} };

describe("every verified fact has a clickable example question that retrieves it", () => {
  it.each(getVerifiedFacts().map((f) => [f.id] as const))("%s", async (id) => {
    const question = getAssistant().questions[id];
    expect(question, `questions.${id}`).toBeDefined();
    const outcome = await ask(question, deps);
    expect(outcome.kind === "answer" && outcome.facts.map((f) => f.id), question).toContain(id);
  });
});

describe("intent: write requests", () => {
  it.each([
    "Write a LinkedIn post about Black Giant",
    "please draft a web page section about water",
    "Can you create a press release?",
    "Generate a tweet about DLE",
  ])("is a draft request: %s", (q) => expect(isDraftRequest(q)).toBe(true));

  it.each([
    "How do I write to EnergyX?",
    "Who wrote the Black Giant page?",
    "What is the LinkedIn page weight?",
    "How heavy is the Black Giant page?",
  ])("is not a draft request: %s", (q) => expect(isDraftRequest(q)).toBe(false));
});

describe("nearest facts", () => {
  const assistant = getAssistant();
  const facts = getVerifiedFacts();

  it("suggests questions about a partly matching topic, never more than three", () => {
    const got = nearest("what about the water footprint of dle brine", facts, assistant);
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThanOrEqual(3);
    for (const n of got) expect(n.question).toBe(assistant.questions[n.id]);
  });

  it("suggests nothing when only generic words match", () => {
    expect(nearest("Who is EnergyX's CEO?", facts, assistant)).toEqual([]);
  });
});

describe("unanswered log", () => {
  it("redacts emails and long numbers and caps length", () => {
    expect(redact("mail me at jo@example.com or +1 (555) 123-4567 please")).toBe("mail me at [email] or [number] please");
    expect(redact("x".repeat(500))).toHaveLength(300);
  });

  it("logs not-covered reasons and skips empty and over-long input", () => {
    expect(unansweredEntry("no-match", "Who is the CEO?")?.reason).toBe("no-match");
    expect(unansweredEntry("draft", "Write a post")?.reason).toBe("draft");
    expect(unansweredEntry("empty", "   ")).toBeNull();
    expect(unansweredEntry("too-long", "a".repeat(400))).toBeNull();
  });

  it("writes one JSON line to the console sink and the file sink", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "unanswered-"));
    const file = path.join(dir, "log", "unanswered.jsonl");
    const lines: string[] = [];
    try {
      await recordUnanswered("no-match", "Who is the CEO?", { console: (l) => lines.push(l), file });
      const written = (await readFile(file, "utf8")).trim().split("\n");
      expect(written).toHaveLength(1);
      expect(JSON.parse(written[0])).toMatchObject({ reason: "no-match", question: "Who is the CEO?" });
      expect(lines[0]).toBe(`[unanswered] ${written[0]}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("logs an identical question once when the response renders twice", async () => {
    const lines: string[] = [];
    const sinks = { console: (l: string) => lines.push(l), file: null };
    await recordUnanswered("no-match", "Is there a dedupe test question?", sinks);
    await recordUnanswered("no-match", "Is there a dedupe test question?", sinks);
    await recordUnanswered("draft", "Is there a dedupe test question?", sinks);
    expect(lines).toHaveLength(2);
  });

  it("does not throw when the file can't be written", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "unanswered-"));
    const blocker = path.join(dir, "file");
    await writeFile(blocker, "x");
    try {
      await expect(
        recordUnanswered("no-match", "q?", { console: () => {}, file: path.join(blocker, "sub", "x.jsonl") }),
      ).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
