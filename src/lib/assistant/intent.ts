import { baseNormalize } from "./normalize";

// The intent router (CLAUDE.md §3): is this a question about EnergyX's published
// information, or a request to write something from it? It runs after the
// refusal pre-filter, so "write a post saying the shares will go up" is still
// refused first. When the words point both ways, or neither, it says "unsure"
// and the pipeline asks, rather than guessing.

export type DraftFormat = "linkedin" | "section" | "investor" | "other";
export type UnsupportedFormat = Exclude<DraftFormat, "linkedin">;

export type Intent =
  | { intent: "answer" }
  // `asQuestion`: phrased as a question ("Can a LinkedIn post mention ...?").
  | { intent: "draft"; format: DraftFormat; asQuestion: boolean }
  // "no-verb": a format with no request ("LinkedIn post about X").
  // "no-format": a request to write with no format ("write about X").
  | { intent: "unsure"; why: "no-verb" | "no-format" };

const POLITE = String.raw`(?:(?:please|pls|can you|could you|would you|will you|i need you to|i want you to)\s+)*`;
const WRITE_VERB = new RegExp(String.raw`^${POLITE}(?:write|draft|compose|create|generate|make|prepare|produce|put together)\b`);
const CONTENT_NOUN =
  /\b(?:posts?|linkedin|tweets?|captions?|copy|blurbs?|sections?|paragraphs?|pages?|articles?|blogs?|press releases?|announcements?|e-?mails?|newsletters?|summar(?:y|ies)|bios?|descriptions?|headlines?|slogans?|taglines?|scripts?|speech|ads?)\b/;

// Nouns that name a format this assistant could write. "page" alone is not one:
// "Could the Black Giant page include a video?" is a question about a page.
const FORMAT = String.raw`(?:linkedin(?: post| update)?|posts?(?![-\w])|(?:web ?page |page )?sections?|captions?|blurbs?)`;

// "give me a post on X", "I need a LinkedIn post about X", "can I get a post ..."
const WANT_FORMAT = new RegExp(
  String.raw`^(?:(?:can|could|would) (?:you|i|we|someone) (?:\w+ ){0,3}|give me |get me |i(?:'d| would)? (?:need|want|like) |we (?:need|want) )(?:an? |some |another )${FORMAT}\b`,
);

// "Can a LinkedIn post mention Black Giant?" is a request to write one.
// (will/shall are refused upstream as future timing, so they aren't listed.)
const QUESTION_FORM = new RegExp(
  String.raw`^(?:can|could|would|may|might|should) (?:a|an|the|my|our|this|any) (?:[a-z-]+ ){0,2}${FORMAT}\b.*\b(?:mention|say|include|cover|highlight|feature|reference|cite|contain|talk about|speak about|be about|focus on|state|quote|name|use)\b`,
);

// "write about water", "can you write something on DLE": a request, no format.
const WRITE_NO_FORMAT = new RegExp(
  String.raw`^${POLITE}(?:write|draft|compose)(?: (?:something|anything|some words|a few words|a bit|a little))? (?:about|on|regarding|for)\b`,
);

// "LinkedIn post about water": a format with no request.
const BARE_FORMAT = new RegExp(String.raw`^(?:an? |the |some |my )?${FORMAT}\b`);

const INVESTOR = /\b(?:e-?mails?|newsletters?|investors?|shareholders?|stockholders?)\b/;
const SECTION = /\bsections?\b|\bweb ?page\b|\blanding page\b/;
const LINKEDIN = /\blinkedin\b|\bposts?(?![-\w])/;

function formatOf(text: string): DraftFormat {
  // Messages to investors win over every other format: CLAUDE.md §4 forbids them.
  if (INVESTOR.test(text)) return "investor";
  if (SECTION.test(text)) return "section";
  if (LINKEDIN.test(text)) return "linkedin";
  return "other";
}

/** An imperative request to write something: "write a post", "give me a post". */
export function isDraftRequest(question: string): boolean {
  const text = baseNormalize(question).trim();
  return (WRITE_VERB.test(text) && CONTENT_NOUN.test(text)) || WANT_FORMAT.test(text);
}

export function routeIntent(question: string): Intent {
  const text = baseNormalize(question).trim();
  if (isDraftRequest(text)) return { intent: "draft", format: formatOf(text), asQuestion: false };
  if (QUESTION_FORM.test(text)) return { intent: "draft", format: formatOf(text), asQuestion: true };
  if (WRITE_NO_FORMAT.test(text)) return { intent: "unsure", why: "no-format" };
  if (BARE_FORMAT.test(text)) return { intent: "unsure", why: "no-verb" };
  return { intent: "answer" };
}
