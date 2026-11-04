import { describe, expect, it } from "vitest";
import { buildGaps, redactForExport, UNMATCHED } from "../../scripts/export-gaps-core";
import { getAllFacts, getAssistant } from "@/lib/content";
import { GapsFileSchema } from "@/lib/schemas";

const AT = "2026-11-03T03:00:00.000Z";
const entry = (question: string, reason = "no-match", at = AT) => JSON.stringify({ at, reason, question });
const build = (lines: string[]) => buildGaps(lines, getAllFacts(), getAssistant(), AT);

describe("export-gaps core", () => {
  it("returns an empty, schema-valid snapshot for no input", () => {
    const { file, malformed } = build([]);
    expect(file.gaps).toEqual([]);
    expect(malformed).toEqual([]);
    expect(() => GapsFileSchema.parse(file)).not.toThrow();
  });

  it("ignores blank lines but reports malformed ones with their line number", () => {
    const { file, malformed } = build([entry("Who is the CEO?"), "", "{not json", JSON.stringify({ at: "yesterday", reason: "no-match", question: "q" })]);
    expect(malformed.map((m) => m.line)).toEqual([3, 4]);
    expect(file.source).toMatchObject({ linesRead: 3, kept: 1, malformed: 2 });
  });

  it("keeps only unanswered-question reasons and counts what it skipped", () => {
    const { file } = build([entry("Who is the CEO?"), entry("Write a post", "draft"), entry("Write a post", "draft-topic"), entry("Why?", "post-check")]);
    expect(file.gaps.map((g) => g.reason).sort()).toEqual(["no-match", "post-check"]);
    expect(file.source.skipped).toEqual({ draft: 1, "draft-topic": 1 });
  });

  it("redacts emails, numbers and links", () => {
    expect(redactForExport("mail jo@example.com or +1 (555) 123-4567 via https://example.com/x?a=1 now")).toBe(
      "mail [email] or [number] via [link] now",
    );
    const { file } = build([entry("Email jo@example.com about www.example.com/page")]);
    expect(file.gaps[0].question).toBe("Email [email] about [link]");
  });

  it("merges case and spacing variants into one row with a count and date range", () => {
    const { file } = build([
      entry("Who is the  CEO?", "no-match", "2026-11-01T00:00:00.000Z"),
      entry("who is the ceo?", "no-match", "2026-11-03T00:00:00.000Z"),
    ]);
    expect(file.gaps).toHaveLength(1);
    expect(file.gaps[0]).toMatchObject({ count: 2, firstAt: "2026-11-01T00:00:00.000Z", lastAt: "2026-11-03T00:00:00.000Z" });
  });

  it("files a question with no recognised concept under 'unmatched' with no nearest facts", () => {
    const { file } = build([entry("Who is the CEO?")]);
    expect(file.gaps[0]).toMatchObject({ subject: UNMATCHED, nearest: [] });
  });

  it("files a recognised-topic question under its concept and lists real fact ids as nearest", () => {
    const assistant = getAssistant();
    const [fact] = getAllFacts().filter((f) => f.verified && assistant.questions[f.id] && (assistant.factConcepts[f.id] ?? []).length > 0);
    const phrase = assistant.concepts[assistant.factConcepts[fact.id][0]][0];
    const { file } = build([entry(`Tell me something unusual about ${phrase}`)]);
    expect(file.gaps[0].subject).not.toBe(UNMATCHED);
    const ids = new Set(getAllFacts().map((f) => f.id));
    expect(file.gaps[0].nearest.every((id) => ids.has(id))).toBe(true);
  });

  it("sorts matched subjects first and unmatched last", () => {
    const assistant = getAssistant();
    const concept = Object.keys(assistant.concepts)[0];
    const { file } = build([entry("Who is the CEO?"), entry(`What about ${assistant.concepts[concept][0]}?`)]);
    expect(file.gaps.at(-1)?.subject).toBe(UNMATCHED);
  });
});

describe("export-gaps subjects", () => {
  it("does not file a question under the company-wide energyx-process concept", () => {
    const { file } = build([entry("Who is EnergyX's CEO?")]);
    expect(file.gaps[0].subject).toBe(UNMATCHED);
  });
});
