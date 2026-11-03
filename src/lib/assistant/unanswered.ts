import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { NoAnswerReason } from "@/lib/schemas";

// The unanswered-question log (CLAUDE.md §3, §5): a content backlog, not a
// debug file. One JSON line per question the assistant could not answer.
// Two sinks:
//   - the server log, always, as `[unanswered] {...}` (on Vercel this is the log
//     the gap report is seeded from);
//   - data/unanswered.jsonl, only off Vercel, where the filesystem is writable.
// Only the question text is kept. No IP, header, cookie or identifier is read.

export const LOGGED_REASONS: readonly NoAnswerReason[] = ["no-match", "post-check", "language", "draft", "draft-topic"];

export interface UnansweredEntry {
  at: string;
  reason: NoAnswerReason;
  question: string;
}

const MAX_LOGGED = 300;

/** Drops the obvious personal details a visitor might paste into a question. */
export function redact(question: string): string {
  return question
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LOGGED);
}

export function unansweredEntry(reason: NoAnswerReason, question: string, now = new Date()): UnansweredEntry | null {
  if (!LOGGED_REASONS.includes(reason)) return null;
  const text = redact(question);
  return text === "" ? null : { at: now.toISOString(), reason, question: text };
}

export interface LogSinks {
  console?: (line: string) => void;
  file?: string | null;
}

// One request was observed rendering the response twice (~90 ms apart, in dev
// and in `next start`), which would double every entry. Identical entries inside
// this window are one question. Per process only: a deliberate repeat by a
// person after the window is a repeat, and counts.
const DEDUPE_MS = 5_000;
// On globalThis because Next can evaluate this module more than once per process.
const globalState = globalThis as typeof globalThis & { __unansweredRecent?: Map<string, number> };
const recent = (globalState.__unansweredRecent ??= new Map<string, number>());

function isRepeat(entry: UnansweredEntry): boolean {
  const key = `${entry.reason}\0${entry.question}`;
  const now = Date.parse(entry.at);
  for (const [k, at] of recent) if (now - at > DEDUPE_MS) recent.delete(k);
  const seen = recent.get(key);
  recent.set(key, seen === undefined || now - seen > DEDUPE_MS ? now : seen);
  return seen !== undefined && now - seen <= DEDUPE_MS;
}

export async function recordUnanswered(
  reason: NoAnswerReason,
  question: string,
  sinks: LogSinks = {},
): Promise<void> {
  const entry = unansweredEntry(reason, question);
  if (!entry || isRepeat(entry)) return;
  const line = JSON.stringify(entry);
  (sinks.console ?? console.info)(`[unanswered] ${line}`);

  const file = sinks.file === undefined ? defaultFile() : sinks.file;
  if (file === null) return;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, `${line}\n`, "utf8");
  } catch (error) {
    // A logging failure must never hide the answer, but it must not vanish either.
    console.warn(`[unanswered] could not write ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function defaultFile(): string | null {
  return process.env.VERCEL ? null : path.join(process.cwd(), "data", "unanswered.jsonl");
}
