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

const NEAREST_LIMIT = 3;
// A concept required by more facts than this ("black-giant", "payload") says
// too little to suggest anything on its own.
const SPECIFIC_MAX_FACTS = 8;

export interface NearestFact {
  id: string;
  label: string;
  question: string;
}

interface Scored extends NearestFact {
  score: number;
}

// Facts that share at least one specific concept with the question, best first.
function rankNearest(question: string, facts: Fact[], assistant: AssistantContent): Scored[] {
  const present = conceptsIn(question, assistant.concepts);
  const usage = new Map<string, number>();
  for (const concepts of Object.values(assistant.factConcepts)) {
    for (const c of concepts) usage.set(c, (usage.get(c) ?? 0) + 1);
  }
  const specific = (c: string) => c !== "energyx-process" && (usage.get(c) ?? 0) <= SPECIFIC_MAX_FACTS;
  return facts
    .flatMap((fact, order) => {
      const suggestion = assistant.questions[fact.id];
      const shared = (assistant.factConcepts[fact.id] ?? []).filter((c) => present.has(c));
      if (!fact.verified || suggestion === undefined || !shared.some(specific)) return [];
      const score = shared.reduce((sum, c) => sum + 1 / (usage.get(c) ?? 1), 0);
      return [{ id: fact.id, label: fact.label, question: suggestion, score, order }];
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ id, label, question: q, score }) => ({ id, label, question: q, score }));
}

const strip = ({ id, label, question }: Scored): NearestFact => ({ id, label, question });

// Fallback when no fact matched in full: the closest facts as questions to click.
// They are never shown as answers, only as "did you mean", so a loose match can't
// be mistaken for a sourced one.
export function nearest(
  question: string,
  facts: Fact[],
  assistant: AssistantContent,
  limit = NEAREST_LIMIT,
): NearestFact[] {
  return rankNearest(question, facts, assistant).slice(0, limit).map(strip);
}

// Two or more facts tied for closest ("What is the capacity?" fits four projects
// equally). Picking three of them by registry order would be a guess shown as a
// suggestion, and calling it "no answer" would log a content gap that isn't one.
// Returns every tied fact, or [] when one fact is clearly closest.
export function tiedNearest(question: string, facts: Fact[], assistant: AssistantContent): NearestFact[] {
  const ranked = rankNearest(question, facts, assistant);
  const tied = ranked.filter((r) => Math.abs(r.score - (ranked[0]?.score ?? 0)) < 1e-9);
  return tied.length >= 2 ? tied.map(strip) : [];
}
