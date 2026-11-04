import type { AssistantContent, Fact } from "@/lib/schemas";
import type { PostStore } from "./composed-posts";
import { checkDraft, type ForwardLookingCopy } from "./draft";

// The one rejection the /evals walkthrough shows: the stored Lonestar post that
// says "backing" where the registry says "grant". Everything is read from the
// append-only log and re-checked here, so the walkthrough can't be staged: if the
// record is gone, a figure changes or the check stops catching it, the build fails.

export const CAUGHT_TOPIC = "lonestar";

export interface CaughtWord {
  text: string;
  /** The registry fact this word is the value of, so it renders from the registry. */
  fact?: Fact;
  /** The word the check refused. */
  caught?: boolean;
}

export interface CaughtClaim {
  model: string;
  /** The refused sentence, word for word as stored. */
  words: CaughtWord[];
  /** Why it was stopped, as stored. */
  reason: string;
}

export function findCaughtClaim(
  rejections: PostStore["rejections"],
  pool: Fact[],
  ctx: { brand: AssistantContent["draft"]["brand"]; forwardLooking: ForwardLookingCopy },
): CaughtClaim {
  const fail = (why: string): never => {
    throw new Error(`data/composed-posts.json: the ${CAUGHT_TOPIC} walkthrough on /evals ${why}`);
  };
  // The note marks the post caught after it was stored, which the walkthrough says out loud.
  const rejection = rejections.find((r) => r.topicId === CAUGHT_TOPIC && r.note && r.problems.some((p) => p.rule === "precise-noun"));
  if (!rejection) return fail("has no stored rejection to show");

  // Dated from the record, not the clock: the same input gives the same page.
  const today = checkDraft({ text: rejection.text, citations: pool.map((f) => f.id), wordedBy: [] }, pool, { ...ctx, now: new Date(rejection.at) });
  if (today.length === 0) return fail("shows a post the checks no longer stop");
  // Step 2 says the figures passed, so anything but the wording check failing makes that untrue.
  if (today.some((p) => p.rule !== "precise-noun")) return fail(`says the figures passed, but: ${today.map((p) => p.detail).join("; ")}`);

  const reason = rejection.problems.find((p) => p.rule === "precise-noun")?.detail ?? "";
  const word = ctx.brand.grant.banned.find((w) => reason.includes(`"${w}"`));
  const sentence = word && rejection.text.split(/\n|(?<=[.!?])\s+/).find((s) => s.split(" ").includes(word));
  if (!sentence) return fail(`can't find the refused word in the stored text (${reason})`);

  const words = sentence.split(" ").map((text): CaughtWord => ({ text, fact: pool.find((f) => f.value === text), caught: text === word }));
  if (!words.some((w) => w.fact)) return fail("can't match the refused sentence's figure to the registry");
  return { model: rejection.model, words, reason };
}
