import { z } from "zod";
import composedFile from "../../../data/composed.json";
import { getAllFacts } from "@/lib/content";
import { isForwardLooking, type Fact } from "@/lib/schemas";
import { templateComposer, type Composer } from "./compose";
import { postcheck } from "./postcheck";
import { prefilter } from "./prefilter";

// Pre-generated answer wording (data/composed.json, written by
// `pnpm compose:facts`). The model wrote one sentence per fact ahead of time;
// every sentence is committed, so a person can read all of it before it ships,
// and nothing is generated while a visitor reads. Each sentence is re-checked
// here at build: a stale or failing one is rejected and its fact falls back to
// the built-in template.

const SentenceSchema = z.strictObject({
  text: z.string().min(1),
  // The fact as the model saw it; a mismatch with the registry means stale.
  label: z.string(),
  value: z.string(),
  alsoPublishedAs: z.array(z.string()),
  attempts: z.array(z.strictObject({ status: z.string(), ms: z.number() })),
  tokensIn: z.number(),
  tokensOut: z.number(),
});

export const ComposedStoreSchema = z.strictObject({
  $comment: z.array(z.string()).optional(),
  model: z.string().nullable(),
  generatedAt: z.string().nullable(),
  sentences: z.record(z.string(), SentenceSchema),
  // Facts the run could not word, with why; they use the template.
  failed: z.record(z.string(), z.strictObject({ reason: z.string(), attempts: SentenceSchema.shape.attempts })),
  // Append-only: every sentence the checks rejected, exactly as the model
  // wrote it. Kept across re-runs; /evals shows these.
  rejections: z
    .array(
      z.strictObject({
        factId: z.string(),
        model: z.string(),
        at: z.string(),
        text: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
});

export type ComposedStore = z.infer<typeof ComposedStoreSchema>;
export type StoredSentence = z.infer<typeof SentenceSchema>;

/** Why a stored sentence can't be served for this fact, or null if it can. */
export function sentenceProblem(fact: Fact | undefined, s: StoredSentence, now: Date): string | null {
  if (!fact) return "fact no longer exists";
  if (!fact.verified) return "fact is unverified";
  if (isForwardLooking(fact)) return "fact is a plan or estimate";
  const alts = fact.alsoPublishedAs.map((a) => a.value);
  if (s.label !== fact.label || s.value !== fact.value || JSON.stringify(s.alsoPublishedAs) !== JSON.stringify(alts)) {
    return "stale: the fact changed after this sentence was written";
  }
  const missing = [fact.value, ...alts].filter((v) => !s.text.includes(v));
  if (missing.length > 0) return `does not state ${missing.map((v) => JSON.stringify(v)).join(", ")} exactly`;
  const check = postcheck({ text: s.text, citations: [fact.id], wordedBy: [] }, [fact]);
  if (!check.ok) return check.reason;
  const hit = prefilter(s.text, now);
  if (hit) return `output pre-filter: ${hit.category} (${hit.trigger})`;
  return null;
}

export interface CheckedStore {
  rejections: ComposedStore["rejections"];
  model: string | null;
  generatedAt: string | null;
  accepted: Map<string, string>;
  rejected: Map<string, string>;
  failed: ComposedStore["failed"];
  sentences: ComposedStore["sentences"];
}

export function checkStore(store: ComposedStore, facts: Fact[], now: Date): CheckedStore {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const accepted = new Map<string, string>();
  const rejected = new Map<string, string>();
  for (const [id, sentence] of Object.entries(store.sentences)) {
    const problem = sentenceProblem(byId.get(id), sentence, now);
    if (problem) rejected.set(id, problem);
    else accepted.set(id, sentence.text);
  }
  return {
    model: store.model,
    generatedAt: store.generatedAt,
    accepted,
    rejected,
    failed: store.failed,
    sentences: store.sentences,
    rejections: store.rejections,
  };
}

let checked: CheckedStore | undefined;

export function getComposedStore(): CheckedStore {
  if (!checked) {
    const parsed = ComposedStoreSchema.safeParse(composedFile);
    if (!parsed.success) throw new Error(`data/composed.json is invalid: ${parsed.error.message}`);
    checked = checkStore(parsed.data, getAllFacts(), new Date());
    for (const [id, why] of checked.rejected) console.warn(`[composed] ${id}: sentence rejected, using template (${why})`);
  }
  return checked;
}

export const TEMPLATE = "template";

/** Serves stored model sentences, with the template for any fact without one. */
export function storedComposer(store: Pick<CheckedStore, "model" | "accepted">): Composer {
  return async (input) => {
    const lines: string[] = [];
    const wordedBy = new Set<string>();
    for (const fact of input.facts) {
      // A reviewed phrasing in assistant.json outranks a stored model sentence.
      const sentence = store.model && !(fact.id in input.copy.phrasings) ? store.accepted.get(fact.id) : undefined;
      if (sentence !== undefined && store.model) {
        lines.push(sentence);
        wordedBy.add(store.model);
      } else {
        lines.push((await templateComposer({ ...input, facts: [fact] })).text);
        wordedBy.add(TEMPLATE);
      }
    }
    return { text: lines.join("\n"), citations: input.facts.map((f) => f.id), wordedBy: [...wordedBy] };
  };
}

// The binding the pipeline uses. Swap here to change who words answers.
export const composeAnswer: Composer = (input) => storedComposer(getComposedStore())(input);
