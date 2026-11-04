import { z } from "zod";
import { conceptsIn, nearest } from "../src/lib/assistant/retrieve";
import { redact } from "../src/lib/assistant/unanswered";
import { GAP_REASONS, type AssistantContent, type Fact, type GapRow, type GapsFile } from "../src/lib/schemas";

// Pure core of `pnpm export:gaps`: log lines in, a redacted, deduplicated,
// subject-grouped snapshot out. No file access, so it is directly testable.

export const UNMATCHED = "unmatched";

const LineSchema = z.object({
  at: z.iso.datetime(),
  reason: z.string().min(1),
  question: z.string().min(1),
});

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;

/** The log is already redacted on write; this repeats it (idempotent) and adds links. */
export function redactForExport(question: string): string {
  return redact(question.replace(URL_PATTERN, "[link]"));
}

function dedupeKey(question: string): string {
  return question.toLowerCase().replace(/\s+/g, " ").trim();
}

// The subject is the recognised concept used by the fewest facts, so a question
// about "DLE" is filed under dle.
function subjectOf(question: string, assistant: AssistantContent): string {
  const present = conceptsIn(question, assistant.concepts);
  const usage = new Map<string, number>();
  for (const concepts of Object.values(assistant.factConcepts)) {
    for (const c of concepts) usage.set(c, (usage.get(c) ?? 0) + 1);
  }
  // "energyx-process" matches any mention of the company, so it names no subject.
  const ranked = [...present]
    .filter((c) => c !== "energyx-process")
    .sort((a, b) => (usage.get(a) ?? 0) - (usage.get(b) ?? 0) || a.localeCompare(b));
  return ranked[0] ?? UNMATCHED;
}

export interface MalformedLine {
  line: number;
  problem: string;
}

export interface GapsBuild {
  file: GapsFile;
  malformed: MalformedLine[];
}

export function buildGaps(lines: string[], facts: Fact[], assistant: AssistantContent, generatedAt: string): GapsBuild {
  const keep = new Set<string>(GAP_REASONS);
  const skipped: Record<string, number> = {};
  const malformed: MalformedLine[] = [];
  const rows = new Map<string, GapRow>();
  let linesRead = 0;
  let kept = 0;

  lines.forEach((raw, index) => {
    if (raw.trim() === "") return;
    linesRead += 1;
    let parsed: z.infer<typeof LineSchema>;
    try {
      parsed = LineSchema.parse(JSON.parse(raw));
    } catch (error) {
      malformed.push({ line: index + 1, problem: error instanceof Error ? error.message.split("\n")[0] : String(error) });
      return;
    }
    if (!keep.has(parsed.reason)) {
      skipped[parsed.reason] = (skipped[parsed.reason] ?? 0) + 1;
      return;
    }
    const question = redactForExport(parsed.question);
    if (question === "") {
      skipped.empty = (skipped.empty ?? 0) + 1;
      return;
    }
    kept += 1;
    const key = dedupeKey(question);
    const existing = rows.get(key);
    if (existing) {
      existing.count += 1;
      if (parsed.at < existing.firstAt) existing.firstAt = parsed.at;
      if (parsed.at > existing.lastAt) existing.lastAt = parsed.at;
      return;
    }
    rows.set(key, {
      question,
      subject: subjectOf(question, assistant),
      count: 1,
      firstAt: parsed.at,
      lastAt: parsed.at,
      reason: parsed.reason as GapRow["reason"],
      nearest: nearest(question, facts, assistant).map((f) => f.id),
    });
  });

  const gaps = [...rows.values()].sort(
    (a, b) =>
      Number(a.subject === UNMATCHED) - Number(b.subject === UNMATCHED) ||
      a.subject.localeCompare(b.subject) ||
      b.count - a.count ||
      b.lastAt.localeCompare(a.lastAt) ||
      a.question.localeCompare(b.question),
  );

  return {
    file: {
      $comment:
        "Written by `pnpm export:gaps` from data/unanswered.jsonl, then reviewed by hand before commit. Never generated at build time.",
      generatedAt,
      source: { linesRead, kept, skipped, malformed: malformed.length },
      gaps,
    },
    malformed,
  };
}
