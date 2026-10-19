import {
  isForwardLooking,
  isTodo,
  type AssistantContent,
  type Fact,
  type NoAnswerReason,
  type RefusalCategory,
} from "@/lib/schemas";
import { templateComposer, type ComposedAnswer, type Composer } from "./compose";
import { composeAnswer } from "./composed";
import type { GateMutation } from "./mutation";
import { baseNormalize, hasNonLatinLetters } from "./normalize";
import { postcheck } from "./postcheck";
import { prefilter } from "./prefilter";
import { retrieve } from "./retrieve";

export type AssistantOutcome =
  | {
      kind: "refuse";
      category: RefusalCategory;
      trigger: string;
      /** For "planned-figure": where to read the figure, without stating it. */
      sources: { title: string; url: string }[];
    }
  | { kind: "answer"; text: string; facts: Fact[]; wordedBy: string[] }
  | { kind: "no-answer"; reason: NoAnswerReason; coverage: string[] };

export interface AskDeps {
  facts: Fact[];
  assistant: AssistantContent;
  compose?: Composer;
  now?: Date;
  warn?: (message: string) => void;
  /** Mutation testing only (/evals): switches a guardrail off. */
  mutation?: GateMutation;
}

function coverage(facts: Fact[], assistant: AssistantContent): string[] {
  return facts
    .filter((f) => f.verified && !isForwardLooking(f) && f.id in assistant.factConcepts)
    .map((f) => f.label);
}

// 1. validate input  2. deterministic pre-filter  3. language guard
// 4. retrieval over verified facts  5. planned/estimate -> refuse
// 6. compose (swappable)  7. post-check numbers and citations, then the
// pre-filter again over the composed text; on failure, re-compose with the
// template and check again
export async function ask(input: unknown, deps: AskDeps): Promise<AssistantOutcome> {
  const outcome = await runPipeline(input, deps);
  // Mutant: the real gate, plus refusing everything it would have let through.
  // Refusal cases all still pass, so only must-not-refuse cases can catch it.
  if (deps.mutation?.refuseAll && outcome.kind !== "refuse") {
    return { kind: "refuse", category: "advice", trigger: "(mutation: refuse all)", sources: [] };
  }
  return outcome;
}

async function runPipeline(input: unknown, deps: AskDeps): Promise<AssistantOutcome> {
  const { assistant, compose = composeAnswer, now = new Date(), warn = console.warn, mutation = {} } = deps;
  // Unverified facts are invisible here even if a caller passes them in.
  const facts = deps.facts.filter((f) => f.verified);
  const noAnswer = (reason: NoAnswerReason): AssistantOutcome => ({
    kind: "no-answer",
    reason,
    coverage: reason === "no-match" || reason === "post-check" ? coverage(facts, assistant) : [],
  });

  const question = typeof input === "string" ? input.trim() : "";
  if (question === "") return noAnswer("empty");
  if (question.length > assistant.maxLength) return noAnswer("too-long");

  const hit = prefilter(question, now, mutation);
  if (hit) return { kind: "refuse", category: hit.category, trigger: hit.trigger, sources: [] };

  if (hasNonLatinLetters(baseNormalize(question))) return noAnswer("language");

  const matched = retrieve(question, facts, assistant);
  if (matched.length === 0) return noAnswer("no-match");

  const forwardLooking = matched.filter(isForwardLooking);
  if (forwardLooking.length > 0 && !mutation.plannedCheckOff) {
    return {
      kind: "refuse",
      category: "planned-figure",
      trigger: forwardLooking.map((f) => f.id).join(", "),
      sources: forwardLooking
        .filter((f) => !isTodo(f.source.url))
        .map((f) => ({ title: f.source.title, url: f.source.url })),
    };
  }

  const byId = new Map(facts.map((f) => [f.id, f]));
  const related = matched
    .flatMap((f) => assistant.related[f.id] ?? [])
    .map((id) => byId.get(id))
    .filter((f): f is Fact => f !== undefined && !isForwardLooking(f));
  const answerFacts = [...new Map([...matched, ...related].map((f) => [f.id, f])).values()];

  // A composer sees only the facts (ComposeInput has no question field).
  const attempt = async (composer: Composer, name: string): Promise<ComposedAnswer | null> => {
    let composed: ComposedAnswer;
    try {
      composed = await composer({ facts: answerFacts, copy: assistant.answer });
    } catch (error) {
      warn(`[assistant] ${name} composer failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
    const problem = composedProblem(composed, answerFacts, now, mutation);
    if (problem) {
      warn(`[assistant] ${name} answer dropped: ${problem}`);
      return null;
    }
    return composed;
  };
  // Fallback is visible, not silent: the answer says which composer wrote it.
  const composed =
    (await attempt(compose, "primary")) ??
    (compose === templateComposer ? null : await attempt(templateComposer, "template fallback"));
  if (!composed) return noAnswer("post-check");

  const cited = new Set(composed.citations);
  return {
    kind: "answer",
    text: composed.text,
    facts: answerFacts.filter((f) => cited.has(f.id)),
    wordedBy: composed.wordedBy,
  };
}

// Post-check (numbers and citations), then the refusal pre-filter over the
// composed text, so "EnergyX will likely list soon" (no number, no citation
// problem) is still caught. The output check never takes gate mutations.
function composedProblem(composed: ComposedAnswer, facts: Fact[], now: Date, mutation: GateMutation): string | null {
  if (!mutation.postcheckOff) {
    const check = postcheck(composed, facts);
    if (!check.ok) return `post-check: ${check.reason}`;
  }
  if (!mutation.outputCheckOff) {
    const hit = prefilter(composed.text, now);
    if (hit) return `output pre-filter: ${hit.category} (${hit.trigger})`;
  }
  return null;
}
