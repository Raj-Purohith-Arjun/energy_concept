import type { CheckedStore } from "@/lib/assistant/composed";
import type { AssistantOutcome } from "@/lib/assistant/pipeline";
import { getEvals, labelFor } from "@/lib/content";

// Display helpers for /evals. Every figure on that page is computed here or in
// evals.ts from the eval cases; none is typed into content.

const FILE = "content/evals.json";

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export function groupLabel(group: string): string {
  return labelFor(getEvals().groups, group, FILE);
}

/** Rounded down, so a suite with one failure never shows as 100%. */
export function percent(part: number, total: number): string {
  return `${total === 0 ? 0 : Math.floor((part / total) * 100)}%`;
}

export interface RunStats {
  min: string;
  median: string;
  max: string;
  attempts: number;
  errors: number;
  statuses: string;
}

const seconds = (ms: number) => (ms / 1000).toFixed(1);

/** Latency and errors of the compose:facts run, from the attempts it recorded. */
export function runStats(store: Pick<CheckedStore, "sentences" | "failed">): RunStats | null {
  const all = [...Object.values(store.sentences), ...Object.values(store.failed)].flatMap((s) => s.attempts);
  const ok = all.filter((a) => a.status === "200").map((a) => a.ms).sort((a, b) => a - b);
  if (ok.length === 0) return null;
  const errors = all.filter((a) => a.status !== "200");
  return {
    min: seconds(ok[0]),
    median: seconds(ok[Math.floor(ok.length / 2)]),
    max: seconds(ok[ok.length - 1]),
    attempts: all.length,
    errors: errors.length,
    statuses: [...new Set(errors.map((a) => a.status))].join(", "),
  };
}

const MAX_QUESTION = 80;

export function questionText(question: string): string {
  const q = question.trim();
  if (q === "") return getEvals().table.empty;
  return q.length > MAX_QUESTION ? `${q.slice(0, MAX_QUESTION)}…` : q;
}

export function outcomeText(o: AssistantOutcome): string {
  const t = getEvals().table;
  if (o.kind === "refuse") return fill(t.refused, { label: groupLabel(o.category) });
  if (o.kind === "answer") return fill(t.answered, { facts: o.facts.map((f) => f.label).join("; ") });
  return t.noAnswer[o.reason];
}
