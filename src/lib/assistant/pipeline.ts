import { getSite } from "@/lib/content";
import {
  isForwardLooking,
  type AssistantContent,
  type Fact,
  type NoAnswerReason,
  type RefusalCategory,
} from "@/lib/schemas";
import { templateComposer, type ComposedAnswer, type Composer } from "./compose";
import { composeAnswer } from "./composed";
import { composeDraft } from "./composed-posts";
import type { GateMutation } from "./mutation";
import { baseNormalize, hasNonLatinLetters } from "./normalize";
import { postcheck, withoutPublishedPlans } from "./postcheck";
import { prefilter } from "./prefilter";
import {
  buildDraft,
  draftTopicIds,
  topicSuggestions,
  type DraftComposer,
  type ForwardLookingCopy,
  type RejectedDraft,
} from "./draft";
import { routeIntent, type UnsupportedFormat } from "./intent";
import { nearest, retrieve, tiedNearest, type NearestFact } from "./retrieve";

export type AssistantOutcome =
  | {
      kind: "refuse";
      category: RefusalCategory;
      trigger: string;
    }
  | { kind: "answer"; text: string; facts: Fact[]; wordedBy: string[] }
  // `nearest`: questions about the closest facts, offered when nothing matched in full.
  | {
      kind: "no-answer";
      reason: NoAnswerReason;
      coverage: string[];
      nearest: NearestFact[];
      /** reason "draft": which format was asked for and isn't written. */
      format?: UnsupportedFormat;
    }
  // A LinkedIn post, written from registry facts only and checked (CLAUDE.md §4).
  | {
      kind: "draft";
      text: string;
      facts: Fact[];
      topics: string[];
      wordedBy: string[];
      asQuestion: boolean;
      rejected: RejectedDraft[];
      ignored: string[];
    }
  // Asked back instead of guessed: answer or draft? Or which of several equal matches?
  | { kind: "clarify"; why: "intent" | "ambiguous"; options: ClarifyOption[] };

export interface ClarifyOption {
  /** "draft": a request to write; "answer": a question about a published fact. */
  mode: "draft" | "answer";
  label: string;
  question: string;
}

export interface AskDeps {
  facts: Fact[];
  assistant: AssistantContent;
  compose?: Composer;
  /** Wording for LinkedIn drafts; the default serves stored posts, with the built-in template as fallback. */
  composeDraft?: DraftComposer;
  /** Marker and footnote for planned figures; defaults to the site's. */
  forwardLooking?: ForwardLookingCopy;
  now?: Date;
  warn?: (message: string) => void;
  /** Mutation testing only (/evals): switches a guardrail off. */
  mutation?: GateMutation;
}

const DRAFT_SUGGESTIONS = 4;
const CLARIFY_ANSWERS = 3;

// Words point to both a question and a draft, or to neither: say so and offer both.
function clarifyIntent(question: string, facts: Fact[], assistant: AssistantContent): AssistantOutcome {
  const topicIds = draftTopicIds(question, assistant);
  const suggestions = topicSuggestions(assistant, topicIds.length > 0 ? topicIds : undefined).slice(0, DRAFT_SUGGESTIONS);
  // Questions about the same topic, or the curated examples when no topic was named.
  const pool = new Set(topicIds.flatMap((id) => assistant.draft.topics[id].factIds));
  const topicQuestions = facts.filter((f) => pool.has(f.id)).flatMap((f) => assistant.questions[f.id] ?? []);
  const questions = (topicQuestions.length > 0 ? topicQuestions : assistant.examples.groups[0].questions).slice(0, CLARIFY_ANSWERS);
  return {
    kind: "clarify",
    why: "intent",
    options: [
      ...suggestions.map((s): ClarifyOption => ({ mode: "draft", label: s.label, question: s.question })),
      ...questions.map((q): ClarifyOption => ({ mode: "answer", label: q, question: q })),
    ],
  };
}

function coverage(facts: Fact[], assistant: AssistantContent): string[] {
  return facts
    .filter((f) => f.verified && !isForwardLooking(f) && f.id in assistant.factConcepts)
    .map((f) => f.label);
}

// 1. validate input  2. deterministic pre-filter  3. draft-request and language guards
// 4. retrieval over verified facts (plans and estimates are answered, chipped)
// 5. compose (swappable)  7. post-check numbers and citations, then the
// pre-filter again over the composed text; on failure, re-compose with the
// template and check again
export async function ask(input: unknown, deps: AskDeps): Promise<AssistantOutcome> {
  const outcome = await runPipeline(input, deps);
  // Mutant: the real gate, plus refusing everything it would have let through.
  // Refusal cases all still pass, so only must-not-refuse cases can catch it.
  if (deps.mutation?.refuseAll && outcome.kind !== "refuse") {
    return { kind: "refuse", category: "advice", trigger: "(mutation: refuse all)" };
  }
  return outcome;
}

async function runPipeline(input: unknown, deps: AskDeps): Promise<AssistantOutcome> {
  const { assistant, compose = composeAnswer, now = new Date(), warn = console.warn, mutation = {} } = deps;
  const forwardLooking = deps.forwardLooking ?? getSite().forwardLooking;
  // Unverified facts are invisible here even if a caller passes them in.
  const facts = deps.facts.filter((f) => f.verified);
  const noAnswer = (reason: NoAnswerReason, extra: Partial<Extract<AssistantOutcome, { kind: "no-answer" }>> = {}): AssistantOutcome => ({
    kind: "no-answer",
    reason,
    coverage: reason === "no-match" || reason === "post-check" ? coverage(facts, assistant) : [],
    nearest: reason === "no-match" ? nearest(question, facts, assistant) : [],
    ...extra,
  });

  const question = typeof input === "string" ? input.trim() : "";
  if (question === "") return noAnswer("empty");
  if (question.length > assistant.maxLength) return noAnswer("too-long");

  const hit = prefilter(question, now, mutation);
  if (hit) return { kind: "refuse", category: hit.category, trigger: hit.trigger };

  // After the refusal gate, so an investment-flavoured request is still refused.
  const intent = routeIntent(question);
  if (intent.intent === "unsure") return clarifyIntent(question, facts, assistant);
  if (intent.intent === "draft") {
    // The suggestions are always LinkedIn requests: the one format that is built.
    if (intent.format !== "linkedin") {
      return noAnswer("draft", { format: intent.format, nearest: topicSuggestions(assistant).slice(0, DRAFT_SUGGESTIONS) });
    }
    const drafted = await buildDraft({
      question,
      asQuestion: intent.asQuestion,
      facts,
      assistant,
      forwardLooking,
      compose: deps.composeDraft ?? composeDraft,
      now,
      mutation,
      warn,
    });
    if (!drafted.ok) {
      return noAnswer(drafted.reason, { nearest: topicSuggestions(assistant).slice(0, DRAFT_SUGGESTIONS) });
    }
    return {
      kind: "draft",
      text: drafted.text,
      facts: drafted.facts,
      topics: drafted.topics,
      wordedBy: drafted.wordedBy,
      asQuestion: drafted.asQuestion,
      rejected: drafted.rejected,
      ignored: drafted.ignored,
    };
  }

  if (hasNonLatinLetters(baseNormalize(question))) return noAnswer("language");

  const matched = retrieve(question, facts, assistant);
  if (matched.length === 0) {
    // Several facts equally close is a question to ask back, not a gap in the content.
    const tied = tiedNearest(question, facts, assistant);
    if (tied.length > 0) {
      return { kind: "clarify", why: "ambiguous", options: tied.map((t) => ({ mode: "answer", label: t.label, question: t.question })) };
    }
    return noAnswer("no-match");
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
    const hit = prefilter(withoutPublishedPlans(composed.text, facts), now);
    if (hit) return `output pre-filter: ${hit.category} (${hit.trigger})`;
  }
  return null;
}
