import { isForwardLooking, type Fact } from "@/lib/schemas";
import { sentenceProblem, type ComposedStore, type StoredSentence } from "./composed";
import { GeminiError, geminiSentence, isRetryable, type GeminiSettings } from "./gemini";

// The batch behind `pnpm compose:facts`: one Gemini call per wordable fact,
// sequential (the API returned 503 "high demand" under load in testing), with
// retries on overload and timeouts. Every sentence gets the same checks the site
// applies at build; a failure is recorded and that fact keeps the template.

export interface ComposeOptions extends GeminiSettings {
  /** Waits before each retry; length = number of retries. */
  backoffMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  now?: Date;
  log?: (line: string) => void;
}

/** GEMINI_API_KEY and GEMINI_MODEL, or null when either is unset. */
export function settingsFromEnv(env: Record<string, string | undefined>): GeminiSettings | null {
  const apiKey = env.GEMINI_API_KEY?.trim();
  const model = env.GEMINI_MODEL?.trim();
  return apiKey && model ? { apiKey, model } : null;
}

/** Facts a composer can ever be asked to word: verified, not plans or estimates. */
export function wordableFacts(facts: Fact[]): Fact[] {
  return facts.filter((f) => f.verified && !isForwardLooking(f));
}

/**
 * Merges a re-run of some facts into an existing store: their new sentences or
 * failures replace the old entries, everything else is kept as reviewed, and
 * the rejection log only grows.
 */
export function mergeStores(previous: ComposedStore, rerun: ComposedStore): ComposedStore {
  if (previous.model !== null && previous.model !== rerun.model) {
    throw new Error(`can't merge ${rerun.model} into sentences from ${previous.model}; run a full compose instead`);
  }
  const retried = new Set([...Object.keys(rerun.sentences), ...Object.keys(rerun.failed)]);
  const keep = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([id]) => !retried.has(id)));
  // A retried fact keeps its earlier attempts, so error counts on /evals cover every run.
  const history = (id: string) => (previous.failed[id] ?? previous.sentences[id])?.attempts ?? [];
  const withHistory = <T extends { attempts: { status: string; ms: number }[] }>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).map(([id, entry]) => [id, { ...entry, attempts: [...history(id), ...entry.attempts] }]));
  return {
    model: rerun.model,
    // The bulk of the sentences date from the original run; each rejection has its own date.
    generatedAt: previous.generatedAt ?? rerun.generatedAt,
    sentences: { ...keep(previous.sentences), ...withHistory(rerun.sentences) },
    failed: { ...keep(previous.failed), ...withHistory(rerun.failed) },
    rejections: [...previous.rejections, ...rerun.rejections],
  };
}

export async function composeFacts(facts: Fact[], options: ComposeOptions): Promise<ComposedStore> {
  const {
    backoffMs = [2_000, 5_000],
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = new Date(),
    log = () => {},
  } = options;
  const store: ComposedStore = {
    model: options.model,
    generatedAt: now.toISOString(),
    sentences: {},
    failed: {},
    rejections: [],
  };

  for (const fact of wordableFacts(facts)) {
    const attempts: StoredSentence["attempts"] = [];
    for (let attempt = 0; ; attempt++) {
      const started = Date.now();
      try {
        const out = await geminiSentence(fact, options);
        attempts.push({ status: "200", ms: Date.now() - started });
        const sentence: StoredSentence = {
          text: out.text,
          label: fact.label,
          value: fact.value,
          alsoPublishedAs: fact.alsoPublishedAs.map((a) => a.value),
          attempts,
          tokensIn: out.tokensIn,
          tokensOut: out.tokensOut,
        };
        const problem =
          JSON.stringify(out.citations) !== JSON.stringify([fact.id])
            ? `cites ${JSON.stringify(out.citations)} instead of [${fact.id}]`
            : sentenceProblem(fact, sentence, now);
        if (problem) {
          store.failed[fact.id] = { reason: `rejected: ${problem}`, attempts };
          store.rejections.push({ factId: fact.id, model: options.model, at: now.toISOString(), text: out.text, reason: problem });
          log(`${fact.id}: rejected (${problem})`);
        } else {
          store.sentences[fact.id] = sentence;
          log(`${fact.id}: ok`);
        }
        break;
      } catch (error) {
        const kind = error instanceof GeminiError ? String(error.kind) : "error";
        attempts.push({ status: kind, ms: Date.now() - started });
        if (isRetryable(error) && attempt < backoffMs.length) {
          log(`${fact.id}: ${kind}, retrying`);
          await sleep(backoffMs[attempt]);
          continue;
        }
        const reason = error instanceof Error ? error.message : String(error);
        store.failed[fact.id] = { reason, attempts };
        log(`${fact.id}: failed (${reason}); keeps the template`);
        break;
      }
    }
  }
  return store;
}
