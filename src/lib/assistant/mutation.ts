import type { PrefilterHit } from "./prefilter";

// Mutation testing hooks for /evals. Each field switches one guardrail off, so
// the eval suite can show what it catches when that guardrail is missing. Only
// src/lib/assistant/evals.ts passes a mutation; the assistant itself
// (AssistantResponse.tsx) never does, so production runs every guardrail.
export interface GateMutation {
  /** The whole deterministic pre-filter. */
  prefilterOff?: boolean;
  /** Pre-filter rules for these categories only. */
  categoriesOff?: readonly PrefilterHit["category"][];
  /** Homoglyph, spacing, leetspeak and typo clean-up before the pre-filter. */
  normaliseOff?: boolean;
  /** Checking composed answers for untraced numbers and citations. */
  postcheckOff?: boolean;
  /** Running the refusal pre-filter over composed answer text. */
  outputCheckOff?: boolean;
  /** The grant-noun draft check: removed ("off"), or weakened to catch only the first banned word. */
  grantNoun?: "off" | "first-word-only";
  /** Replace the gate with one that refuses every question. */
  refuseAll?: boolean;
}
