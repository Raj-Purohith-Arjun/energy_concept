import { z } from "zod";
import assistantFile from "../../content/assistant.json";
import blackGiantFile from "../../content/black-giant.json";
import evalsFile from "../../content/evals.json";
import factsFile from "../../content/facts.json";
import findingsFile from "../../content/findings.json";
import siteFile from "../../content/site.json";
import { factTokenIds, malformedFactTokens } from "./fact-text";
import {
  AssistantSchema,
  BlackGiantSchema,
  EvalsSchema,
  FactsFileSchema,
  FindingsSchema,
  isTodo,
  SiteSchema,
  type AssistantContent,
  type BlackGiantContent,
  type EvalsContent,
  type Fact,
  type FindingsContent,
  type Site,
} from "./schemas";

export type { AssistantContent, BlackGiantContent, EvalsContent, Fact, FindingsContent, NavLink, Site } from "./schemas";

export class ContentError extends Error {
  override name = "ContentError";
}

// Every loader goes through here, so an invalid file fails the build with the
// file name and a readable list of issues rather than a render-time crash.
export function parseContent<T>(schema: z.ZodType<T>, raw: unknown, file: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ContentError(`${file} is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export type FactRegistry = ReadonlyMap<string, Fact>;

export function buildRegistry(raw: unknown, file = "content/facts.json"): FactRegistry {
  const { facts } = parseContent(FactsFileSchema, raw, file);
  const registry = new Map<string, Fact>();
  for (const fact of facts) {
    if (registry.has(fact.id)) {
      throw new ContentError(`${file}: duplicate fact id "${fact.id}"`);
    }
    registry.set(fact.id, fact);
  }
  return registry;
}

export interface GetFactOptions {
  // For the assistant (Phase B) and /findings: unverified facts must never be
  // usable there, so asking for one is a build/runtime error, not a marker.
  requireVerified?: boolean;
}

export function lookupFact(
  registry: FactRegistry,
  id: string,
  options: GetFactOptions = {},
): Fact {
  const fact = registry.get(id);
  if (!fact) {
    throw new ContentError(`Unknown fact id "${id}": not in content/facts.json`);
  }
  if (options.requireVerified && !fact.verified) {
    throw new ContentError(
      `Fact "${id}" is unverified (verified: false) and cannot be used where requireVerified is set.`,
    );
  }
  return fact;
}

// Parsed lazily, once per process. Static JSON imports keep the files in the
// bundle's dependency graph, so edits trigger rebuilds and nothing reads disk.
let registry: FactRegistry | undefined;
let site: Site | undefined;

function getRegistry(): FactRegistry {
  registry ??= buildRegistry(factsFile);
  return registry;
}

export function getFact(id: string, options?: GetFactOptions): Fact {
  return lookupFact(getRegistry(), id, options);
}

export function getAllFacts(): Fact[] {
  return [...getRegistry().values()];
}

// The assistant (and /findings) go through these, never getFact/getAllFacts:
// unverified facts must be invisible to them.
export function getVerifiedFact(id: string): Fact {
  return lookupFact(getRegistry(), id, { requireVerified: true });
}

export function getVerifiedFacts(): Fact[] {
  return getAllFacts().filter((fact) => fact.verified);
}

export function getSite(): Site {
  site ??= parseContent(SiteSchema, siteFile, "content/site.json");
  return site;
}

// Cross-references in assistant.json must point at real facts and concepts,
// so a typo fails the build instead of silently making a fact unreachable.
export function validateAssistant(
  assistant: AssistantContent,
  registry: FactRegistry,
  file = "content/assistant.json",
): AssistantContent {
  const problems: string[] = [];
  for (const [factId, concepts] of Object.entries(assistant.factConcepts)) {
    if (!registry.has(factId)) problems.push(`factConcepts: unknown fact id "${factId}"`);
    for (const concept of concepts) {
      if (!(concept in assistant.concepts)) {
        problems.push(`factConcepts.${factId}: unknown concept "${concept}"`);
      }
    }
  }
  for (const [factId, relatedIds] of Object.entries(assistant.related)) {
    for (const id of [factId, ...relatedIds]) {
      if (!registry.has(id)) problems.push(`related: unknown fact id "${id}"`);
    }
  }
  if (problems.length > 0) throw new ContentError(`${file} is invalid:\n${problems.join("\n")}`);
  return assistant;
}

let assistant: AssistantContent | undefined;

export function getAssistant(): AssistantContent {
  assistant ??= validateAssistant(
    parseContent(AssistantSchema, assistantFile, "content/assistant.json"),
    getRegistry(),
  );
  return assistant;
}

let blackGiant: BlackGiantContent | undefined;

export function getBlackGiant(): BlackGiantContent {
  if (!blackGiant) {
    const file = "content/black-giant.json";
    const parsed = parseContent(BlackGiantSchema, blackGiantFile, file);
    const unknown = parsed.factIds.filter((id) => !getRegistry().has(id));
    if (unknown.length > 0) {
      throw new ContentError(`${file}: unknown fact id(s) ${unknown.map((id) => `"${id}"`).join(", ")}`);
    }
    blackGiant = parsed;
  }
  return blackGiant;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

// /findings must never show an unverified fact, so every reference (cells,
// payload parts, {fact:id} tokens in prose) is checked here and a bad one
// fails the build. TODO(content) cells are allowed: they render as pending.
// A timing fact in seconds, for the /findings load timeline; undefined when the
// fact is not a timing.
export function factSeconds(fact: Fact): number | undefined {
  if (fact.numeric === undefined) return undefined;
  if (fact.unit === "s") return fact.numeric;
  if (fact.unit === "ms") return fact.numeric / 1000;
  return undefined;
}

export function validateFindings(
  findings: FindingsContent,
  registry: FactRegistry,
  file = "content/findings.json",
): FindingsContent {
  const problems: string[] = [];
  const check = (id: string, where: string): Fact | undefined => {
    const fact = registry.get(id);
    if (!fact) problems.push(`${where}: unknown fact id "${id}"`);
    else if (!fact.verified) problems.push(`${where}: fact "${id}" is unverified`);
    return fact?.verified ? fact : undefined;
  };

  // $comment is an author note, never rendered, so it may mention token syntax.
  for (const text of strings({ ...findings, $comment: undefined })) {
    if (malformedFactTokens(text)) problems.push(`malformed {fact:...} token in "${text}"`);
    for (const id of factTokenIds(text)) check(id, "{fact} token");
  }
  for (const page of findings.payload.pages) {
    if (isTodo(page.total)) {
      if (page.parts.length > 0) problems.push(`payload "${page.label}": parts need a measured total`);
    } else {
      check(page.total, `payload "${page.label}" total`);
    }
    for (const part of page.parts) {
      const fact = check(part.fact, `payload "${page.label}" part`);
      if (fact && (fact.unit !== "KiB" || fact.numeric === undefined)) {
        problems.push(`payload part "${part.fact}" must be a byte fact (numeric in KiB)`);
      }
    }
  }
  for (const row of findings.comparison.rows) {
    for (const ref of [row.before, row.after]) if (!isTodo(ref)) check(ref, `comparison "${row.label}"`);
  }
  for (const pair of findings.verdict.pairs) {
    check(pair.before, `verdict "${pair.label}"`);
    check(pair.after, `verdict "${pair.label}"`);
  }
  for (const phone of findings.timeline.phones) {
    const [fcp, lcp] = [phone.fcp, phone.lcp].map((id) => {
      const fact = check(id, `timeline "${phone.label}"`);
      const seconds = fact && factSeconds(fact);
      if (fact && seconds === undefined) problems.push(`timeline fact "${id}" must be a timing (numeric in s or ms)`);
      return seconds;
    });
    if (fcp !== undefined && lcp !== undefined && fcp > lcp) {
      problems.push(`timeline "${phone.label}": first paint comes after the largest paint`);
    }
  }
  for (const c of findings.registry.cases) {
    const fact = c.figures === undefined ? undefined : check(c.figures, `registry case "${c.heading}"`);
    if (fact && fact.alsoPublishedAs.length === 0) {
      problems.push(`registry case "${c.heading}": "${fact.id}" has no alsoPublishedAs figures`);
    }
  }
  if (problems.length > 0) throw new ContentError(`${file} is invalid:\n${problems.join("\n")}`);
  return findings;
}

let findings: FindingsContent | undefined;

export function getFindings(): FindingsContent {
  findings ??= validateFindings(
    parseContent(FindingsSchema, findingsFile, "content/findings.json"),
    getRegistry(),
  );
  return findings;
}

let evals: EvalsContent | undefined;

export function getEvals(): EvalsContent {
  evals ??= parseContent(EvalsSchema, evalsFile, "content/evals.json");
  return evals;
}

/** A label from a content map, failing the build when one is missing. */
export function labelFor(map: Record<string, string>, key: string, file: string): string {
  const label = map[key];
  if (label === undefined) throw new ContentError(`${file}: no label for "${key}"`);
  return label;
}

export const SITE_TITLE = "EnergyX (demo)";
export const TITLE_TEMPLATE = `%s — ${SITE_TITLE}`;

// The root layout's title.template does not apply to app/page.tsx (same
// segment), so the home page uses this with `title.absolute`.
export function pageTitle(page: string): string {
  return TITLE_TEMPLATE.replace("%s", page);
}
