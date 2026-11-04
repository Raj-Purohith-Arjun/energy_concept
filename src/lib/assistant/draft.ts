import { isForwardLooking, type AssistantContent, type Fact } from "@/lib/schemas";
import { templateLine, type ComposedAnswer } from "./compose";
import type { GateMutation } from "./mutation";
import { baseNormalize } from "./normalize";
import { postcheck, withoutPublishedPlans } from "./postcheck";
import { prefilter } from "./prefilter";
import { conceptsIn, retrieve, type NearestFact } from "./retrieve";

// Drafting mode (CLAUDE.md §4), LinkedIn post only. Same shape as answering:
// pick the facts first, let a composer word them, then check the words. The
// composer sees only facts and copy, never the request, so a visitor's wording
// can't reach it. Nothing here publishes anything.

export interface ForwardLookingCopy {
  marker: string;
  note: string;
}

export interface DraftInput {
  facts: Fact[];
  /** Labels of the topics the facts were picked for. */
  topics: string[];
  /** Set only when the request covers one whole topic (not a narrowed subset): a stored post may stand in. */
  topicId?: string;
  draft: AssistantContent["draft"];
  answer: AssistantContent["answer"];
  forwardLooking: ForwardLookingCopy;
}

/** The slot a model plugs into. Whatever it returns goes through checkDraft(). */
export type DraftComposer = (input: DraftInput) => Promise<ComposedAnswer>;

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

const joinLabels = (labels: string[]): string => labels.join(", ");

/** No model: one bullet per fact, planned and estimated figures marked, then the footnote. */
export const templateDraftComposer: DraftComposer = async ({ facts, topics, draft, answer, forwardLooking }) => {
  const bullets = facts.map((fact) => {
    const line = [templateLine(fact, answer), ...fact.alsoPublishedAs.map((alt) => fill(answer.alsoLine, { value: alt.value }))].join(" ");
    return `• ${line}${isForwardLooking(fact) ? forwardLooking.marker : ""}`;
  });
  const footnote = facts.some(isForwardLooking) ? ["", `${forwardLooking.marker} ${forwardLooking.note}`] : [];
  return {
    text: [fill(draft.linkedin.opening, { topic: joinLabels(topics) }), "", ...bullets, "", draft.linkedin.closing, ...footnote].join("\n"),
    citations: facts.map((f) => f.id),
    wordedBy: ["template"],
  };
};

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export interface DraftProblem {
  rule: "sources" | "forward-looking" | "pre-filter" | "banned-phrase" | "precise-noun" | "terminology" | "figures" | "structure";
  detail: string;
}

export interface RejectedDraft {
  text: string;
  wordedBy: string[];
  problems: DraftProblem[];
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const compiled = new Map<string, RegExp>();
function regex(source: string, flags: string): RegExp {
  const key = `${flags}/${source}`;
  let re = compiled.get(key);
  if (!re) {
    try {
      re = new RegExp(source, flags);
    } catch (error) {
      throw new Error(`content/assistant.json draft.brand: invalid pattern ${JSON.stringify(source)}: ${String(error)}`);
    }
    compiled.set(key, re);
  }
  return re;
}

// Hyphen and space are interchangeable: "game-changing" also catches "game changing".
const phraseRegExp = (phrase: string): RegExp =>
  regex(`(?<![\\p{L}\\p{N}])${escapeRegExp(baseNormalize(phrase)).replace(/(?:\\-|-|\s)+/g, "[\\s-]+")}(?![\\p{L}\\p{N}])`, "u");

/** Banned promotional phrases found in `text`, as written in the brand list. */
export function bannedPhrasesIn(text: string, brand: AssistantContent["draft"]["brand"]): string[] {
  const normalised = baseNormalize(text);
  return brand.banned.filter((phrase) => phraseRegExp(phrase).test(normalised));
}

function brandProblems(text: string, brand: AssistantContent["draft"]["brand"]): DraftProblem[] {
  const normalised = baseNormalize(text);
  return [
    ...bannedPhrasesIn(text, brand).map((p): DraftProblem => ({ rule: "banned-phrase", detail: `promotional wording: "${p}"` })),
    ...brand.preciseNouns
      .filter((n) => regex(n.pattern, "u").test(normalised))
      .map((n): DraftProblem => ({ rule: "precise-noun", detail: `${n.noun} must be called a ${n.use}, nothing stronger` })),
    ...brand.terminology
      .filter((t) => phraseRegExp(t.avoid).test(normalised))
      .map((t): DraftProblem => ({ rule: "terminology", detail: `say "${t.use}", not "${t.avoid}"` })),
  ];
}

export interface DraftCheckContext {
  brand: AssistantContent["draft"]["brand"];
  forwardLooking: ForwardLookingCopy;
  now: Date;
  mutation?: GateMutation;
}

/** Every problem with a composed draft, not just the first, so the reader sees all of them. */
export function checkDraft(composed: ComposedAnswer, facts: Fact[], ctx: DraftCheckContext): DraftProblem[] {
  const problems: DraftProblem[] = [];
  const { mutation = {} } = ctx;

  // Every figure comes from the registry; every citation is one of the facts.
  if (!mutation.postcheckOff) {
    const check = postcheck(composed, facts);
    if (!check.ok) problems.push({ rule: "sources", detail: check.reason });
  }

  // A planned or estimated figure keeps its marker on the line it appears in, and
  // the draft carries the footnote the marker points to.
  const cited = facts.filter((f) => composed.citations.includes(f.id) && isForwardLooking(f));
  const lines = composed.text.split("\n");
  for (const fact of cited) {
    const values = [fact.value, ...fact.alsoPublishedAs.map((a) => a.value)];
    const bare = lines.some((line) => values.some((v) => line.includes(v)) && !line.includes(ctx.forwardLooking.marker));
    if (bare) problems.push({ rule: "forward-looking", detail: `"${fact.label}" is a ${fact.kind} but isn't marked ${ctx.forwardLooking.marker}` });
  }
  if (cited.length > 0 && !composed.text.includes(ctx.forwardLooking.note)) {
    problems.push({ rule: "forward-looking", detail: "planned or estimated figures without their footnote" });
  }

  // The refusal pre-filter, over the draft text. Published plans are removed
  // first, and so is the site's own footnote: it must say "projections" to explain
  // the marker, and it is fixed text that the check above has already required.
  if (!mutation.outputCheckOff) {
    const hit = prefilter(withoutPublishedPlans(composed.text, facts).split(ctx.forwardLooking.note).join(" "), ctx.now);
    if (hit) problems.push({ rule: "pre-filter", detail: `${hit.category} language ("${hit.trigger}")` });
  }

  problems.push(...brandProblems(composed.text, ctx.brand));
  return problems;
}

// ---------------------------------------------------------------------------
// Picking the facts
// ---------------------------------------------------------------------------

/** Topic ids named in the question, in the order they are listed in assistant.json. */
export function draftTopicIds(question: string, assistant: AssistantContent): string[] {
  const present = conceptsIn(question, assistant.concepts);
  return Object.keys(assistant.draft.topics).filter((id) => present.has(id));
}

/** "Write a LinkedIn post about X" for each topic: clickable ways forward. */
export function topicSuggestions(assistant: AssistantContent, ids = Object.keys(assistant.draft.topics)): NearestFact[] {
  return ids.map((id) => {
    const label = assistant.draft.topics[id].label;
    return { id, label, question: fill(assistant.draft.requestTemplate, { topic: label }) };
  });
}

/** The facts a post about these topics may use: the listed ones that are verified, in registry order. */
export function draftPool(topicIds: string[], facts: Fact[], assistant: AssistantContent): Fact[] {
  const allowed = new Set(topicIds.flatMap((id) => assistant.draft.topics[id]?.factIds ?? []));
  return facts.filter((f) => f.verified && allowed.has(f.id));
}

export interface DraftRequest {
  question: string;
  asQuestion: boolean;
  facts: Fact[];
  assistant: AssistantContent;
  forwardLooking: ForwardLookingCopy;
  compose: DraftComposer;
  now: Date;
  mutation: GateMutation;
  warn: (message: string) => void;
}

export type DraftResult =
  | {
      ok: true;
      text: string;
      facts: Fact[];
      topics: string[];
      wordedBy: string[];
      /** Drafts that failed a check before this one shipped, with what was wrong. */
      rejected: RejectedDraft[];
      /** Promotional words in the request that the draft deliberately doesn't use. */
      ignored: string[];
      asQuestion: boolean;
    }
  | { ok: false; reason: "draft-topic" | "post-check" };

export async function buildDraft(req: DraftRequest): Promise<DraftResult> {
  const { assistant, facts, question, now, warn } = req;
  const topicIds = draftTopicIds(question, assistant);
  const pool = draftPool(topicIds, facts, assistant);
  if (pool.length === 0) return { ok: false, reason: "draft-topic" };

  // "a post about Black Giant capacity" narrows to the one fact; "about Black Giant" takes them all.
  const narrowed = retrieve(question, pool, assistant);
  const chosen = (narrowed.length > 0 ? narrowed : pool).slice(0, assistant.draft.maxFacts);
  const topics = topicIds.map((id) => assistant.draft.topics[id].label);

  const wholeTopic = topicIds.length === 1 && narrowed.length === 0;
  const input: DraftInput = {
    facts: chosen,
    topics,
    topicId: wholeTopic ? topicIds[0] : undefined,
    draft: assistant.draft,
    answer: assistant.answer,
    forwardLooking: req.forwardLooking,
  };
  const ctx: DraftCheckContext = { brand: assistant.draft.brand, forwardLooking: req.forwardLooking, now, mutation: req.mutation };
  const rejected: RejectedDraft[] = [];

  const attempt = async (composer: DraftComposer, name: string): Promise<ComposedAnswer | null> => {
    let composed: ComposedAnswer;
    try {
      composed = await composer(input);
    } catch (error) {
      warn(`[assistant] ${name} draft composer failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
    const problems = checkDraft(composed, chosen, ctx);
    if (problems.length > 0) {
      rejected.push({ text: composed.text, wordedBy: composed.wordedBy, problems });
      warn(`[assistant] ${name} draft rejected: ${problems.map((p) => p.detail).join("; ")}`);
      return null;
    }
    return composed;
  };

  const composed =
    (await attempt(req.compose, "primary")) ??
    (req.compose === templateDraftComposer ? null : await attempt(templateDraftComposer, "template fallback"));
  if (!composed) return { ok: false, reason: "post-check" };

  const cited = new Set(composed.citations);
  return {
    ok: true,
    text: composed.text,
    facts: chosen.filter((f) => cited.has(f.id)),
    topics,
    wordedBy: composed.wordedBy,
    rejected,
    ignored: bannedPhrasesIn(question, assistant.draft.brand),
    asQuestion: req.asQuestion,
  };
}
