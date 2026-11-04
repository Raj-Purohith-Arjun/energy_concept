import { isForwardLooking, type AssistantContent, type Fact } from "@/lib/schemas";
import { renderPost, snapshotOf, type PostStore, type StoredPost } from "./composed-posts";
import { checkDraft, draftPool, type DraftProblem, type ForwardLookingCopy } from "./draft";
import { GeminiError, geminiPost, isRetryable, type GeminiSettings } from "./gemini";

// The batch behind `pnpm compose:posts`: one Gemini call per topic, sequential,
// retrying overload and timeouts like compose:facts. Every post goes through
// the same checks the site applies when it serves one. A post the checks
// refuse is recorded exactly as written (the log is evidence, never discarded)
// and its topic keeps the template.

export interface ComposePostsOptions extends GeminiSettings {
  /** Waits before each retry; length = number of retries. */
  backoffMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  now?: Date;
  log?: (line: string) => void;
  /** Only these topics; default is draft.voice.postTopics. */
  topicIds?: string[];
}

/** What the model is told: the rules from content/assistant.json, and nothing else fixed in code. */
export function postInstructions(assistant: AssistantContent): string {
  return [
    "You write one LinkedIn post for an independent demo website, from the facts given.",
    ...assistant.draft.voice.rules.map((rule) => `- ${rule}`),
    'Return JSON: {"hook": one sentence, "paragraphs": [one to three short paragraphs]}.',
  ].join("\n");
}

const MASK = "[figure]";

/**
 * The fact's sourced basis prose, for context. Many bases quote the figure
 * itself and the model must never see a value, so the figure is masked and the
 * sentence kept: the fact's own values first, then any other number left.
 * basisSource (stated/inferred) is not sent; it is a registry note.
 */
export function basisContext(fact: Fact): string {
  const values = [fact.value, ...fact.alsoPublishedAs.map((a) => a.value)].sort((a, b) => b.length - a.length);
  return values
    .reduce((text, value) => text.split(value).join(MASK), fact.basis)
    .replace(/(?<![A-Za-z])[$€£]?\d[\d,.]*(?:[KMBkmb]\b|%|\+)?/g, MASK);
}

/** The only text the model sees: the topic and each fact's token, label, kind and basis prose. Never a value. */
export function postPrompt(topicLabel: string, facts: Fact[]): string {
  return [
    `TOPIC: ${topicLabel}`,
    ...facts.flatMap((f) => {
      const basis = basisContext(f);
      return [
        "",
        "FACT",
        `token: {fact:${f.id}}`,
        `label: ${f.label}`,
        `kind: ${isForwardLooking(f) ? f.kind : "published"}`,
        ...(basis ? [`basis: ${basis}`] : []),
      ];
    }),
  ].join("\n");
}

/** The facts a stored post for this topic is written from: the same ones buildDraft picks for a whole-topic request. */
export function postFacts(topicId: string, facts: Fact[], assistant: AssistantContent): Fact[] {
  return draftPool([topicId], facts, assistant).slice(0, assistant.draft.maxFacts);
}

/**
 * Merges a re-run of some topics into an existing store: their new posts or
 * failures replace the old entries, everything else is kept as reviewed, and
 * the rejection log only grows.
 */
export function mergePostStores(previous: PostStore, rerun: PostStore): PostStore {
  if (previous.model !== null && previous.model !== rerun.model) {
    throw new Error(`can't merge ${rerun.model} into posts from ${previous.model}; run a full compose instead`);
  }
  const retried = new Set([...Object.keys(rerun.posts), ...Object.keys(rerun.failed)]);
  const keep = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([id]) => !retried.has(id)));
  return {
    model: rerun.model,
    generatedAt: previous.generatedAt ?? rerun.generatedAt,
    posts: { ...keep(previous.posts), ...rerun.posts },
    failed: { ...keep(previous.failed), ...rerun.failed },
    rejections: [...previous.rejections, ...rerun.rejections],
  };
}

export async function composePosts(
  facts: Fact[],
  assistant: AssistantContent,
  forwardLooking: ForwardLookingCopy,
  options: ComposePostsOptions,
): Promise<PostStore> {
  const {
    backoffMs = [2_000, 5_000],
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = new Date(),
    log = () => {},
    topicIds = assistant.draft.voice.postTopics,
  } = options;
  const store: PostStore = { model: options.model, generatedAt: now.toISOString(), posts: {}, failed: {}, rejections: [] };
  const instructions = postInstructions(assistant);
  const ctx = { closing: assistant.draft.linkedin.closing, forwardLooking };

  for (const topicId of topicIds) {
    const topic = assistant.draft.topics[topicId];
    const topicFacts = topic ? postFacts(topicId, facts, assistant) : [];
    if (topicFacts.length === 0) {
      store.failed[topicId] = { reason: "no verified facts for this topic", attempts: [] };
      log(`${topicId}: no verified facts; keeps the template`);
      continue;
    }

    const attempts: StoredPost["attempts"] = [];
    for (let attempt = 0; ; attempt++) {
      const started = Date.now();
      try {
        const out = await geminiPost(instructions, postPrompt(topic.label, topicFacts), options);
        attempts.push({ status: "200", ms: Date.now() - started });

        const rendered = renderPost(out, topicFacts, ctx);
        let text = [out.hook, ...out.paragraphs].join("\n\n");
        let problems: DraftProblem[];
        if (rendered.ok) {
          text = rendered.text;
          problems = checkDraft({ text, citations: rendered.citations, wordedBy: [options.model] }, topicFacts, {
            brand: assistant.draft.brand,
            forwardLooking,
            now,
          });
        } else {
          problems = rendered.problems;
        }

        if (problems.length > 0) {
          const reason = problems.map((p) => p.detail).join("; ");
          store.failed[topicId] = { reason: `rejected: ${reason}`, attempts };
          store.rejections.push({ topicId, model: options.model, at: now.toISOString(), text, problems });
          log(`${topicId}: rejected (${reason})`);
        } else {
          store.posts[topicId] = {
            text,
            factIds: topicFacts.map((f) => f.id),
            snapshot: snapshotOf(topicFacts),
            attempts,
            tokensIn: out.tokensIn,
            tokensOut: out.tokensOut,
          };
          log(`${topicId}: ok`);
        }
        break;
      } catch (error) {
        const kind = error instanceof GeminiError ? String(error.kind) : "error";
        attempts.push({ status: kind, ms: Date.now() - started });
        if (isRetryable(error) && attempt < backoffMs.length) {
          log(`${topicId}: ${kind}, retrying`);
          await sleep(backoffMs[attempt]);
          continue;
        }
        const reason = error instanceof Error ? error.message : String(error);
        store.failed[topicId] = { reason, attempts };
        log(`${topicId}: failed (${reason}); keeps the template`);
        break;
      }
    }
  }
  return store;
}
