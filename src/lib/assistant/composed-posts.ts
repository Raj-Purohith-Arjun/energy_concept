import { z } from "zod";
import composedPostsFile from "../../../data/composed-posts.json";
import { getAllFacts, getAssistant, getSite } from "@/lib/content";
import { parseFactText } from "@/lib/fact-text";
import { isForwardLooking, type AssistantContent, type Fact } from "@/lib/schemas";
import { checkDraft, draftPool, templateDraftComposer, type DraftComposer, type DraftProblem, type ForwardLookingCopy } from "./draft";
import { numbersIn, numberWordsIn } from "./postcheck";

// Whole LinkedIn posts, written ahead of time by `pnpm compose:posts` into
// data/composed-posts.json. Same arrangement as composed.ts: committed, so a
// person reads every word before it ships; nothing is generated while a visitor
// reads; each post is re-checked here and a stale or failing one is dropped in
// favour of the built-in template.
//
// The model never types a figure. It writes prose with {fact:ID} tokens, and
// renderPost() replaces each token with the registry's value (plus the planned
// marker), so every number in a post traces to a fact by construction.

export const PostProblemSchema = z.strictObject({ rule: z.string(), detail: z.string() });

const AttemptsSchema = z.array(z.strictObject({ status: z.string(), ms: z.number() }));

// The facts as the model was given them. A mismatch with the registry means the post is stale.
const SnapshotSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.string(),
  value: z.string(),
  alsoPublishedAs: z.array(z.string()),
});

const StoredPostSchema = z.strictObject({
  /** The finished post, exactly as served: figures filled in, closing line and footnote included. */
  text: z.string().min(1),
  factIds: z.array(z.string()).min(1),
  snapshot: z.array(SnapshotSchema).min(1),
  attempts: AttemptsSchema,
  tokensIn: z.number(),
  tokensOut: z.number(),
});

export const PostStoreSchema = z.strictObject({
  $comment: z.array(z.string()).optional(),
  model: z.string().nullable(),
  generatedAt: z.string().nullable(),
  posts: z.record(z.string(), StoredPostSchema),
  // Topics the run could not write, with why; they use the template.
  failed: z.record(z.string(), z.strictObject({ reason: z.string(), attempts: AttemptsSchema })),
  // Append-only: every post the checks refused, exactly as the model wrote it.
  // Kept across re-runs; /evals shows these.
  rejections: z
    .array(
      z.strictObject({
        topicId: z.string(),
        model: z.string(),
        at: z.string(),
        text: z.string(),
        problems: z.array(PostProblemSchema).min(1),
        // How the rejection came about, when it is not the usual "caught at generation".
        note: z.string().optional(),
      }),
    )
    .default([]),
});

export type PostStore = z.infer<typeof PostStoreSchema>;
export type StoredPost = z.infer<typeof StoredPostSchema>;

export function snapshotOf(facts: Fact[]): StoredPost["snapshot"] {
  return facts.map((f) => ({ id: f.id, label: f.label, kind: f.kind, value: f.value, alsoPublishedAs: f.alsoPublishedAs.map((a) => a.value) }));
}

// ---------------------------------------------------------------------------
// Rendering: prose with {fact:ID} tokens -> the post
// ---------------------------------------------------------------------------

export interface PostParts {
  hook: string;
  paragraphs: string[];
}

export interface RenderContext {
  closing: string;
  forwardLooking: ForwardLookingCopy;
}

export type RenderResult = { ok: true; text: string; citations: string[] } | { ok: false; problems: DraftProblem[] };

const MAX_PARAGRAPHS = 3;

const OPENER = /^EnergyX publishes\b/i;

/** How many sentences in `text` begin "EnergyX publishes". A sentence starts a line or follows . ! or ? and a space. */
export function publishesOpenerCount(text: string): number {
  return text.split("\n").flatMap((line) => line.split(/(?<=[.!?])\s+/)).filter((s) => OPENER.test(s.trim())).length;
}

const REPEATED_OPENER: DraftProblem = {
  rule: "structure",
  detail: 'more than one sentence begins "EnergyX publishes"; vary the openings',
};

/** The figure as it reads in a post: the value, any other published figure, and the marker if it is a plan or estimate. */
function figure(fact: Fact, marker: string): string {
  const also = fact.alsoPublishedAs.map((a) => ` (also published as ${a.value})`).join("");
  return `${fact.value}${also}${isForwardLooking(fact) ? marker : ""}`;
}

export function renderPost(parts: PostParts, facts: Fact[], ctx: RenderContext): RenderResult {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const problems: DraftProblem[] = [];
  const pieces = [parts.hook, ...parts.paragraphs];

  if (/\n/.test(parts.hook.trim())) problems.push({ rule: "structure", detail: "the hook must be one sentence on one line" });
  if (parts.paragraphs.length > MAX_PARAGRAPHS) {
    problems.push({ rule: "structure", detail: `${parts.paragraphs.length} paragraphs; at most ${MAX_PARAGRAPHS}` });
  }

  const used = new Set<string>();
  const rendered = pieces.map((piece) => {
    const prose = parseFactText(piece);
    // The model must not type a figure: strip the tokens, then any digit or number word left is its own.
    const typed = prose.flatMap((p) => ("text" in p ? [p.text] : [])).join(" ");
    const numbers = [...numbersIn(typed), ...numberWordsIn(typed)];
    if (numbers.length > 0) problems.push({ rule: "figures", detail: `typed a number instead of a fact token: ${numbers.join(", ")}` });
    if (/[{}]/.test(typed)) problems.push({ rule: "figures", detail: "a malformed fact token" });
    return prose
      .map((p) => {
        if ("text" in p) return p.text;
        const fact = byId.get(p.factId);
        if (!fact) {
          problems.push({ rule: "figures", detail: `unknown fact token: ${p.factId}` });
          return "";
        }
        used.add(fact.id);
        return figure(fact, ctx.forwardLooking.marker);
      })
      .join("");
  });

  const unused = facts.filter((f) => !used.has(f.id));
  if (unused.length > 0) problems.push({ rule: "figures", detail: `never used: ${unused.map((f) => f.id).join(", ")}` });
  if (publishesOpenerCount(rendered.join("\n")) > 1) problems.push(REPEATED_OPENER);
  if (problems.length > 0) return { ok: false, problems };

  const footnote = facts.some(isForwardLooking) ? ["", `${ctx.forwardLooking.marker} ${ctx.forwardLooking.note}`] : [];
  const text = [rendered[0].trim(), "", ...rendered.slice(1).flatMap((p) => [p.trim(), ""]), ctx.closing, ...footnote].join("\n");
  return { ok: true, text, citations: facts.map((f) => f.id) };
}

// ---------------------------------------------------------------------------
// Serving
// ---------------------------------------------------------------------------

export interface PostCheckContext {
  assistant: AssistantContent;
  forwardLooking: ForwardLookingCopy;
  now: Date;
}

/** Why a stored post can't be served, or null if it can. */
export function postProblem(post: StoredPost, registry: Map<string, Fact>, ctx: PostCheckContext): string | null {
  const facts: Fact[] = [];
  for (const id of post.factIds) {
    const fact = registry.get(id);
    if (!fact) return `fact ${id} no longer exists`;
    if (!fact.verified) return `fact ${id} is unverified`;
    facts.push(fact);
  }
  if (JSON.stringify(snapshotOf(facts)) !== JSON.stringify(post.snapshot)) return "stale: a fact changed after this post was written";
  const problems = checkDraft({ text: post.text, citations: post.factIds, wordedBy: [] }, facts, {
    brand: ctx.assistant.draft.brand,
    forwardLooking: ctx.forwardLooking,
    now: ctx.now,
  });
  // Re-checked on the stored text too, so a post written before this rule existed is dropped, not served.
  if (publishesOpenerCount(post.text) > 1) problems.push(REPEATED_OPENER);
  return problems.length > 0 ? problems.map((p) => p.detail).join("; ") : null;
}

export interface CheckedPostStore {
  model: string | null;
  generatedAt: string | null;
  accepted: Map<string, StoredPost>;
  rejected: Map<string, string>;
  failed: PostStore["failed"];
  rejections: PostStore["rejections"];
}

export function checkPostStore(store: PostStore, facts: Fact[], ctx: PostCheckContext): CheckedPostStore {
  const registry = new Map(facts.map((f) => [f.id, f]));
  const accepted = new Map<string, StoredPost>();
  const rejected = new Map<string, string>();
  for (const [topicId, post] of Object.entries(store.posts)) {
    const problem = postProblem(post, registry, ctx);
    if (problem) rejected.set(topicId, problem);
    else accepted.set(topicId, post);
  }
  return { model: store.model, generatedAt: store.generatedAt, accepted, rejected, failed: store.failed, rejections: store.rejections };
}

let checked: CheckedPostStore | undefined;

export function getPostStore(): CheckedPostStore {
  if (!checked) {
    const parsed = PostStoreSchema.safeParse(composedPostsFile);
    if (!parsed.success) throw new Error(`data/composed-posts.json is invalid: ${parsed.error.message}`);
    checked = checkPostStore(parsed.data, getAllFacts(), { assistant: getAssistant(), forwardLooking: getSite().forwardLooking, now: new Date() });
    for (const [id, why] of checked.rejected) console.warn(`[composed-posts] ${id}: post rejected, using template (${why})`);
  }
  return checked;
}

/** What readers get for a topic today: a stored post that passes every check, else the template. */
export async function shippedPostText(topicId: string): Promise<string> {
  const served = getPostStore().accepted.get(topicId)?.text;
  if (served) return served;
  const assistant = getAssistant();
  const topic = assistant.draft.topics[topicId];
  const pool = topic ? draftPool([topicId], getAllFacts(), assistant).slice(0, assistant.draft.maxFacts) : [];
  if (pool.length === 0) return "";
  const composed = await templateDraftComposer({
    facts: pool,
    topics: [topic.label],
    draft: assistant.draft,
    answer: assistant.answer,
    forwardLooking: getSite().forwardLooking,
  });
  return composed.text;
}

/**
 * Serves a stored post when the request covers the whole of one topic and the
 * post was written from exactly the facts about to be used. Anything else
 * (a narrowed request, no stored post, a stale one) gets the template.
 */
export function storedDraftComposer(store: Pick<CheckedPostStore, "model" | "accepted">): DraftComposer {
  return async (input) => {
    const post = input.topicId && store.model ? store.accepted.get(input.topicId) : undefined;
    const same = post && JSON.stringify([...post.factIds].sort()) === JSON.stringify(input.facts.map((f) => f.id).sort());
    if (!post || !store.model || !same) return templateDraftComposer(input);
    return { text: post.text, citations: post.factIds, wordedBy: [store.model] };
  };
}

// The binding the pipeline uses. Swap here to change who words drafts.
export const composeDraft: DraftComposer = (input) => storedDraftComposer(getPostStore())(input);
