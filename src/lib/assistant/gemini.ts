import { z } from "zod";
import type { Fact } from "@/lib/schemas";

// Gemini client for `pnpm compose:facts` ONLY. Nothing in the app calls this at
// build or request time: the model writes one sentence per fact ahead of time,
// those sentences are committed to data/composed.json, and the site serves them.
//
// The model receives one fact's id, label and values, and fixed instructions.
// Never a visitor's question, never the registry, never history or tools.

export const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const INSTRUCTIONS = [
  "You write one plain-English sentence stating a single published fact, for a reader of an independent demo website.",
  "Use only the label and values given. Include every value exactly as written, character for character.",
  "Add no other number, date, comparison, opinion, forecast, plan or advice. Do not say what will or may happen.",
  'Return JSON: {"text": the sentence, "citations": [the fact id]}.',
].join("\n");

export interface GeminiSettings {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface GeminiSentence {
  text: string;
  citations: string[];
  tokensIn: number;
  tokensOut: number;
}

export class GeminiError extends Error {
  override name = "GeminiError";
  constructor(
    message: string,
    /** HTTP status, or "timeout" / "network" / "invalid". */
    readonly kind: number | "timeout" | "network" | "invalid",
  ) {
    super(message);
  }
}

/** The only text the model sees for a fact. */
export function factPrompt(fact: Fact): string {
  return [
    "FACT",
    `id: ${fact.id}`,
    `label: ${fact.label}`,
    `value: ${fact.value}`,
    ...fact.alsoPublishedAs.map((alt) => `also published as: ${alt.value}`),
  ].join("\n");
}

const ResponseSchema = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string() })).min(1) }) }))
    .min(1),
  usageMetadata: z.object({ promptTokenCount: z.number(), candidatesTokenCount: z.number() }),
});

const SentenceSchema = z.strictObject({ text: z.string().min(1), citations: z.array(z.string()) });

export async function geminiSentence(fact: Fact, settings: GeminiSettings): Promise<GeminiSentence> {
  const { apiKey, model, fetch: doFetch = fetch, timeoutMs = 30_000 } = settings;
  const body = {
    systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
    contents: [{ role: "user", parts: [{ text: factPrompt(fact) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { text: { type: "STRING" }, citations: { type: "ARRAY", items: { type: "STRING" } } },
        required: ["text", "citations"],
      },
      temperature: 0,
    },
  };

  let res: Response;
  try {
    res = await doFetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      // Key in a header, not the URL, so it can't land in a request log.
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new GeminiError(timedOut ? `timed out after ${timeoutMs} ms` : `network error: ${String(error)}`, timedOut ? "timeout" : "network");
  }
  if (!res.ok) throw new GeminiError(`HTTP ${res.status}`, res.status);

  const parsed = ResponseSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new GeminiError("unexpected response shape", "invalid");
  let sentence: unknown;
  try {
    sentence = JSON.parse(parsed.data.candidates[0].content.parts[0].text);
  } catch {
    throw new GeminiError("model returned invalid JSON", "invalid");
  }
  const checked = SentenceSchema.safeParse(sentence);
  if (!checked.success) throw new GeminiError("model JSON has the wrong shape", "invalid");
  return {
    ...checked.data,
    tokensIn: parsed.data.usageMetadata.promptTokenCount,
    tokensOut: parsed.data.usageMetadata.candidatesTokenCount,
  };
}

/** Errors worth retrying: overload, rate limit, server errors, timeouts, network. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof GeminiError)) return false;
  return error.kind === "timeout" || error.kind === "network" || (typeof error.kind === "number" && (error.kind === 429 || error.kind >= 500));
}
