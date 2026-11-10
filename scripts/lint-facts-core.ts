import ts from "typescript";
import { isTodo, type Fact } from "../src/lib/schemas";

// Pure scanning logic for scripts/lint-facts.ts, kept separate so unit tests
// can import it without running the CLI. CLAUDE.md §2.1: business claims must
// render through <Fact id="..." />, never as typed numbers.

export interface Violation {
  file: string;
  line: number;
  kind: "claim" | "unknown-fact";
  text: string;
}

export function formatViolation(v: Violation): string {
  return v.kind === "claim"
    ? `${v.file}:${v.line} — "${v.text}" is hardcoded; use <Fact id="..." />`
    : `${v.file}:${v.line} — <Fact id="${v.text}" /> is not in content/facts.json`;
}

// ---------------------------------------------------------------------------
// Claim patterns. Each one targets a *shape* that only business claims take,
// so most allowlisted values (years, ISO dates, list numbers, street
// addresses) never match in the first place. Guards below handle overlaps.
// ---------------------------------------------------------------------------

const N = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const MAGNITUDE = String.raw`(?:thousand|million|billion|trillion)`;
const UNITS = [
  String.raw`tpa`, String.raw`t/yr`, String.raw`metric tons?`, String.raw`tonnes?`, String.raw`tons?`,
  String.raw`acres?`, String.raw`hectares?`, String.raw`patents?`, String.raw`ppm`,
  String.raw`m²`, String.raw`km²`, String.raw`sq\.?\s?(?:ft|m|km)`,
  String.raw`MWh`, String.raw`GWh`, String.raw`kWh`, String.raw`MW`, String.raw`GW`, String.raw`LCE`,
  // Payload sizes and durations: this demo's own measured claims.
  String.raw`KiB`, String.raw`MiB`, String.raw`GiB`, String.raw`KB`, String.raw`MB`, String.raw`GB`,
  String.raw`ms`, String.raw`milliseconds?`, String.raw`s`, String.raw`seconds?`,
].join("|");

const CLAIM_PATTERNS: RegExp[] = [
  // Currency symbol first: $52.5M, US$ 1,000, €3 billion
  new RegExp(String.raw`(?:US\$|[$€£¥])\s?${N}(?:\s?(?:[KMBT]|bn|mn|${MAGNITUDE})\b)?`, "g"),
  // Currency word after: 500 USD, 2 dollars
  new RegExp(String.raw`${N}\s?(?:USD|EUR|GBP|dollars)\b`, "g"),
  // Percentages: 84%, 12 percent
  new RegExp(String.raw`${N}\s?(?:%|percent\b|per cent\b)`, "g"),
  // Counts with units: 52,500 tpa, 150+ patents, 48.3 MB, 180ms
  new RegExp(String.raw`${N}\+?\s?(?:${UNITS})(?![\p{L}\p{N}²])`, "gu"),
  // Magnitude words: 2 million
  new RegExp(String.raw`${N}\s?${MAGNITUDE}\b`, "g"),
  // K/M/B suffix: 40K, 1.2B
  new RegExp(String.raw`${N}\s?[KMB]\b`, "g"),
  // Trailing plus: 140+
  new RegExp(String.raw`${N}\+(?![\d+])`, "g"),
];

const YEAR = /^(?:19|20)\d{2}$/;

function isAllowlisted(text: string, match: string, start: number): boolean {
  const before = text.slice(0, start);
  // Part of a larger token: v16.4.0, x86, w-1/2, 1990s-style decades, ids.
  if (/[\p{L}\p{N}_.@/-]$/u.test(before)) return true;
  // Copyright years.
  if (/©\s*$/.test(before)) return true;
  const digits = match.replace(/^\D+/, "").match(/^[\d,.]+/)?.[0] ?? "";
  // Version strings: two or more dots.
  if ((digits.match(/\./g) ?? []).length >= 2) return true;
  const rest = text.slice(start + match.length);
  if (/^\.\d/.test(rest)) return true;
  // Years with a suffix: "2030+", "1990s".
  if (YEAR.test(digits) && /^\d{4}(?:\+|s)$/.test(match)) return true;
  // Display resolutions.
  if (/^[48]K$/.test(match)) return true;
  return false;
}

// Replace URLs with spaces (keeps offsets, so line numbers stay correct).
function blankUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s"'<>)]+/g, (url) => " ".repeat(url.length));
}

export interface ClaimMatch {
  text: string;
  index: number;
}

export function findClaims(input: string): ClaimMatch[] {
  const text = blankUrls(input);
  const hits: ClaimMatch[] = [];
  for (const pattern of CLAIM_PATTERNS) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      const index = m.index ?? 0;
      if (!isAllowlisted(text, m[0], index)) hits.push({ text: m[0].trim(), index });
    }
  }
  // Keep the widest match where patterns overlap ("$52.5 million" once).
  hits.sort((a, b) => a.index - b.index || b.text.length - a.text.length);
  const result: ClaimMatch[] = [];
  for (const hit of hits) {
    const last = result.at(-1);
    if (last && hit.index < last.index + last.text.length) continue;
    result.push(hit);
  }
  return result;
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source[i] === "\n") line++;
  return line;
}

function claimsIn(file: string, source: string, text: string, offset: number): Violation[] {
  return findClaims(text).map((hit) => ({
    file,
    line: lineAt(source, offset + hit.index),
    kind: "claim",
    text: hit.text,
  }));
}

// ---------------------------------------------------------------------------
// JSON: only string values, skipping keys that hold ids, URLs, dates,
// addresses or author annotations ($comment, note are never rendered).
// ---------------------------------------------------------------------------

const JSON_SKIP_KEY = /^(?:id|slug|date|accessed|approvedAt|project|factIds?|dateFactId|\$comment|note)$|href|url|src|address/i;

export function scanJson(file: string, source: string): Violation[] {
  const sf = ts.parseJsonText(file, source);
  const out: Violation[] = [];
  const visit = (node: ts.Node, skip: boolean): void => {
    if (ts.isPropertyAssignment(node)) {
      const key = ts.isStringLiteral(node.name) ? node.name.text : node.name.getText(sf);
      visit(node.initializer, skip || JSON_SKIP_KEY.test(key));
      return;
    }
    if (ts.isStringLiteral(node)) {
      if (!skip) out.push(...claimsIn(file, source, node.text, node.getStart(sf) + 1));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, skip));
  };
  visit(sf, false);
  return out;
}

// ---------------------------------------------------------------------------
// TSX: walk the AST and check only text a person can read: JSX text and string
// literals. Comments are never visited. Skipped contexts are styling, geometry,
// routing and imports. alt, title and aria-* are deliberately *not* skipped.
// ---------------------------------------------------------------------------

const TSX_SKIP_ATTRS = new Set([
  "className", "class", "style", "sizes", "d", "viewBox", "points", "transform",
  "href", "src", "srcSet", "id", "key", "htmlFor", "width", "height", "fill", "stroke",
  "strokeWidth", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry",
  "offset", "stopColor", "gradientTransform", "dateTime", "type", "rel", "target",
]);
const TSX_SKIP_CALLS = new Set(["cn", "clsx", "cva", "twMerge"]);
const CSS_KEYS = new Set([
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight", "top", "right",
  "bottom", "left", "inset", "margin", "padding", "gap", "transform", "translate",
  "opacity", "flexBasis", "fontSize", "lineHeight", "letterSpacing", "borderRadius",
  "backgroundPosition", "objectPosition", "clipPath", "animationRange", "transition",
]);

function attrName(attr: ts.JsxAttribute, sf: ts.SourceFile): string {
  return attr.name.getText(sf);
}

function isSkippedContext(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (ts.isImportDeclaration(cur) || ts.isExportDeclaration(cur) || ts.isLiteralTypeNode(cur)) {
      return true;
    }
    if (ts.isJsxAttribute(cur)) {
      const name = attrName(cur, sf);
      return TSX_SKIP_ATTRS.has(name) || name.startsWith("data-");
    }
    if (ts.isCallExpression(cur) && TSX_SKIP_CALLS.has(cur.expression.getText(sf))) return true;
    if (ts.isPropertyAssignment(cur) && CSS_KEYS.has(cur.name.getText(sf))) return true;
    if (ts.isJsxElement(cur) && cur.openingElement.tagName.getText(sf) === "address") return true;
  }
  return false;
}

function factIdAttr(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
): ts.StringLiteral | undefined {
  if (node.tagName.getText(sf) !== "Fact") return undefined;
  for (const prop of node.attributes.properties) {
    if (ts.isJsxAttribute(prop) && attrName(prop, sf) === "id" && prop.initializer) {
      // Dynamic ids ({fact.id}) can't be checked statically; getFact() throws
      // at render instead.
      if (ts.isStringLiteral(prop.initializer)) return prop.initializer;
    }
  }
  return undefined;
}

export function scanTsx(file: string, source: string, knownIds: ReadonlySet<string>): Violation[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Violation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const idNode = factIdAttr(node, sf);
      if (idNode && !knownIds.has(idNode.text)) {
        out.push({ file, line: lineAt(source, idNode.getStart(sf)), kind: "unknown-fact", text: idNode.text });
      }
    }
    if (ts.isJsxText(node)) {
      if (!isSkippedContext(node, sf)) out.push(...claimsIn(file, source, node.text, node.pos));
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (!isSkippedContext(node, sf)) {
        out.push(...claimsIn(file, source, node.text, node.getStart(sf) + 1));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

// ---------------------------------------------------------------------------
// Registry warnings: unverified facts and unfinished TODO(content) markers.
// ---------------------------------------------------------------------------

// This demo's own first-load JavaScript and caught-claim CSS figures are measured on a
// local build, so there is no public page to link. That is a decision, not unfinished
// work, and it is the only TODO(content) text treated as one. Exact match, and only
// as a fact's own source.url: any other TODO(content), or this text anywhere else,
// is still an unfinished marker and still warns.
export const NO_PUBLIC_URL = "TODO(content) local measurement, no public URL";

function todoPaths(value: unknown, at: string): string[] {
  if (typeof value === "string") return isTodo(value) ? [at] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => todoPaths(v, `${at}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => todoPaths(v, at ? `${at}.${k}` : k));
  }
  return [];
}

export interface RegistryReport {
  /** Unfinished work: unverified facts and TODO(content) markers. */
  warnings: string[];
  /** Fact ids whose source.url is deliberately absent (local measurements). */
  intentionalNoUrl: string[];
}

export function registryReport(facts: Fact[]): RegistryReport {
  const intentionalNoUrl = facts.filter((f) => f.source.url === NO_PUBLIC_URL).map((f) => f.id);
  const warnings = facts.flatMap((fact) => [
    ...(fact.verified ? [] : [`${fact.id}: verified is false`]),
    ...todoPaths(fact, fact.id)
      .filter((p) => !(p === `${fact.id}.source.url` && fact.source.url === NO_PUBLIC_URL))
      .map((p) => `${p}: TODO(content)`),
  ]);
  return { warnings, intentionalNoUrl };
}

// ---------------------------------------------------------------------------
// MDX: line based. Skips code fences, import/export lines, inline code,
// comments, URLs and tag attributes; checks <Fact id> references.
// ---------------------------------------------------------------------------

const MDX_FRONTMATTER_SKIP = /^(?:id|slug|date|accessed|project|sourceUrl|url|href|factIds?)\s*:/;

export function scanMdx(file: string, source: string, knownIds: ReadonlySet<string>): Violation[] {
  const out: Violation[] = [];
  const lines = source.split(/\r?\n/);
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (inFrontmatter) {
      if (i > 0 && raw.trim() === "---") inFrontmatter = false;
      else if (i > 0 && !MDX_FRONTMATTER_SKIP.test(raw.trim())) out.push(...lineClaims(raw, line));
      return;
    }
    if (/^\s*(?:```|~~~)/.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence || /^\s*(?:import|export)\s/.test(raw)) return;

    for (const m of raw.matchAll(/<Fact\b[^>]*?\bid\s*=\s*["']([^"']+)["']/g)) {
      if (!knownIds.has(m[1])) out.push({ file, line, kind: "unknown-fact", text: m[1] });
    }
    const prose = raw
      .replace(/`[^`]*`/g, " ")
      .replace(/\{\/\*.*?\*\/\}|<!--.*?-->/g, " ")
      .replace(/\]\([^)]*\)/g, "] ")
      .replace(/<[^>]*>/g, " ");
    out.push(...lineClaims(prose, line));
  });

  function lineClaims(text: string, line: number): Violation[] {
    return findClaims(text).map((hit) => ({ file, line, kind: "claim", text: hit.text }));
  }
  return out;
}
