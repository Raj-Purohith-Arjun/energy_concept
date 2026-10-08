import type { AssistantContent, Fact } from "@/lib/schemas";
import { baseNormalize, joinSpacedLetters } from "./normalize";

// Deterministic retrieval: a fact matches when the question contains every
// concept listed for it in assistant.json (any phrase of a concept counts).
// Only verified facts are ever considered.

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

const phraseCache = new Map<string, RegExp>();

// Whole-phrase match, allowing simple inflections: patent(s), member(s), load(ing).
function phraseRegExp(phrase: string): RegExp {
  let regex = phraseCache.get(phrase);
  if (!regex) {
    const body = escapeRegExp(baseNormalize(phrase));
    regex = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?:s|es|'s|ed|ing)?(?![\\p{L}\\p{N}])`, "u");
    phraseCache.set(phrase, regex);
  }
  return regex;
}

export function conceptsIn(question: string, concepts: AssistantContent["concepts"]): Set<string> {
  const text = joinSpacedLetters(baseNormalize(question));
  const present = new Set<string>();
  for (const [name, phrases] of Object.entries(concepts)) {
    if (phrases.some((phrase) => phraseRegExp(phrase).test(text))) present.add(name);
  }
  return present;
}

function isStrictSubset(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size < b.size && [...a].every((x) => b.has(x));
}

export function retrieve(question: string, facts: Fact[], assistant: AssistantContent): Fact[] {
  const present = conceptsIn(question, assistant.concepts);
  const candidates = facts.flatMap((fact) => {
    const required = assistant.factConcepts[fact.id];
    if (!fact.verified || !required?.every((concept) => present.has(concept))) return [];
    return [{ fact, required: new Set(required) }];
  });
  // Prefer the most specific match: "Black Giant acres" drops the company-wide
  // acres fact, because {land} is a strict subset of {black-giant, land}.
  return candidates
    .filter((a) => !candidates.some((b) => b !== a && isStrictSubset(a.required, b.required)))
    .map((c) => c.fact);
}
