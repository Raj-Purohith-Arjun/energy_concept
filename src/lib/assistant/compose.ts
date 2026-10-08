import type { AssistantContent, Fact } from "@/lib/schemas";

// Step 4 of the pipeline, and the ONLY place a model may ever plug in. It
// receives the already-retrieved verified facts and nothing else; whatever it
// returns still goes through postcheck() before anyone sees it.

export interface ComposeInput {
  question: string;
  facts: Fact[];
  copy: AssistantContent["answer"];
}

export interface ComposedAnswer {
  /** Prose answer. Every number in it must come from `facts`. */
  text: string;
  /** Ids of the facts the text relies on; must be a subset of the input. */
  citations: string[];
}

export type Composer = (input: ComposeInput) => Promise<ComposedAnswer>;

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

/** No model: one line per fact, plus its other published figures. */
export const templateComposer: Composer = async ({ facts, copy }) => ({
  text: facts
    .map((fact) =>
      [
        fill(copy.factLine, { label: fact.label, value: fact.value }),
        ...fact.alsoPublishedAs.map((alt) => fill(copy.alsoLine, { value: alt.value })),
      ].join(" "),
    )
    .join("\n"),
  citations: facts.map((fact) => fact.id),
});

// Swap this one binding for a model-backed composer with the same signature.
export const composeAnswer: Composer = templateComposer;
