// Prose with embedded figures: "{fact:lh-bg-weight}" becomes a <Fact>, so copy
// in content/*.json can say a number without typing it (CLAUDE.md §2.1).

export type FactTextPart = { text: string } | { factId: string };

const TOKEN = /\{fact:([a-z0-9]+(?:-[a-z0-9]+)*)\}/g;
const TOKEN_START = "{fact:";

export function parseFactText(text: string): FactTextPart[] {
  const parts: FactTextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ factId: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// A "{fact:" left in the text parts is a token that didn't parse (bad id,
// missing brace) and would otherwise render literally.
export function malformedFactTokens(text: string): boolean {
  return parseFactText(text).some((part) => "text" in part && part.text.includes(TOKEN_START));
}

export function factTokenIds(text: string): string[] {
  return parseFactText(text).flatMap((part) => ("factId" in part ? [part.factId] : []));
}
