import type { AssistantContent, Fact } from "@/lib/schemas";

// Step 6 of the pipeline, and the ONLY place a model may ever plug in. It
// receives the already-retrieved verified facts and nothing else: there is no
// question field, so a visitor's words cannot reach a composer at all. Whatever
// it returns still goes through postcheck() and the output pre-filter.

export interface ComposeInput {
  facts: Fact[];
  copy: AssistantContent["answer"];
}

export interface ComposedAnswer {
  /** Prose answer. Every number in it must come from `facts`. */
  text: string;
  /** Ids of the facts the text relies on; must be a subset of the input. */
  citations: string[];
  /** Who wrote the wording: model ids and/or "template". Shown to the reader. */
  wordedBy: string[];
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
  wordedBy: ["template"],
});

// The binding the pipeline uses lives in composed.ts: stored model sentences,
// with this template for any fact without one.
