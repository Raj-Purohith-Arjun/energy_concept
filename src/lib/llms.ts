import { isForwardLooking, isTodo, type Fact, type LlmsCopy, type Site } from "./schemas";

// llms.txt (https://llmstxt.org) generated from the registry, so it can't drift
// from the pages. Verified facts only. Planned/estimate figures ARE included,
// labelled forward-looking: this file discloses what EnergyX has published,
// whereas the assistant answers questions, where stating a target is an
// assertion. Different job, different rule.

function link(label: string, url: string): string {
  return isTodo(url) ? label : `[${label}](${url})`;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

function factBlock(fact: Fact, copy: LlmsCopy, kinds: Site["factUi"]["kinds"]): string[] {
  const lines = [
    `- ${link(fact.label, fact.source.url)}: ${fact.value}. ${kinds[fact.kind]}.`,
    `  - ${fill(copy.basis, { basisSource: fact.basisSource })}: ${fact.basis}`,
    `  - ${copy.source}: ${fact.source.title}, ${copy.accessed} ${fact.source.accessed}.`,
  ];
  if (isForwardLooking(fact)) lines.push(`  - ${fill(copy.forwardLooking, { kind: kinds[fact.kind] })}`);
  for (const alt of fact.alsoPublishedAs) {
    lines.push(
      `  - ${copy.alsoPublishedAs}: ${link(alt.value, alt.url)}. ${fill(copy.basis, { basisSource: alt.basisSource })}: ${alt.basis} (${copy.accessed} ${alt.accessed})`,
    );
  }
  lines.push(`  - ${copy.approval}`);
  return lines;
}

export function renderLlmsTxt(facts: Fact[], copy: LlmsCopy, kinds: Site["factUi"]["kinds"]): string {
  const verified = facts.filter((f) => f.verified);
  return [
    `# ${copy.title}`,
    "",
    `> ${copy.summary}`,
    "",
    ...copy.notes.flatMap((note) => [note, ""]),
    `## ${copy.pagesHeading}`,
    "",
    ...copy.pages.map((p) => `- [${p.label}](${p.href}): ${p.note}`),
    "",
    `## ${copy.factsHeading}`,
    "",
    ...verified.flatMap((fact) => factBlock(fact, copy, kinds)),
    "",
  ].join("\n");
}
