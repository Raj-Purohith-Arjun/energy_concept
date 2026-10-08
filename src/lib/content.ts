import { z } from "zod";
import assistantFile from "../../content/assistant.json";
import blackGiantFile from "../../content/black-giant.json";
import factsFile from "../../content/facts.json";
import siteFile from "../../content/site.json";
import {
  AssistantSchema,
  BlackGiantSchema,
  FactsFileSchema,
  SiteSchema,
  type AssistantContent,
  type BlackGiantContent,
  type Fact,
  type Site,
} from "./schemas";

export type { AssistantContent, BlackGiantContent, Fact, NavLink, Site } from "./schemas";

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

export const SITE_TITLE = "EnergyX (demo)";
export const TITLE_TEMPLATE = `%s — ${SITE_TITLE}`;

// The root layout's title.template does not apply to app/page.tsx (same
// segment), so the home page uses this with `title.absolute`.
export function pageTitle(page: string): string {
  return TITLE_TEMPLATE.replace("%s", page);
}
