import { describe, expect, it } from "vitest";
import { getAllFacts, getSite } from "@/lib/content";
import { renderLlmsTxt } from "@/lib/llms";
import type { Fact } from "@/lib/schemas";

const site = getSite();
const facts = getAllFacts();
const render = (list: Fact[]) => renderLlmsTxt(list, site.llms, site.factUi.kinds);

describe("llms.txt", () => {
  const text = render(facts);

  it("starts with the llmstxt.org header: H1 then a blockquote summary", () => {
    const [h1, blank, quote] = text.split("\n");
    expect(h1).toBe(`# ${site.llms.title}`);
    expect(blank).toBe("");
    expect(quote).toBe(`> ${site.llms.summary}`);
  });

  it.each(facts.filter((f) => f.verified).map((f) => [f.id, f]))("lists verified fact %s with value and basis", (_id, fact) => {
    expect(text).toContain(`${fact.label}`);
    expect(text).toContain(`: ${fact.value}.`);
    expect(text).toContain(fact.basis);
  });

  it("marks planned and estimate figures as forward-looking", () => {
    const capacity = text.split("\n- ").find((block) => block.includes("Black Giant capacity"));
    expect(capacity).toContain("Forward-looking (Planned)");
    const location = text.split("\n- ").find((block) => block.includes("Black Giant location"));
    expect(location).not.toContain("Forward-looking");
  });

  it("includes every alsoPublishedAs figure with its own basis", () => {
    expect(text).toMatch(/Also published as: \[Hours\]\(https:\/\/energyx\.com\/\)\. Basis \(stated\)/);
  });

  it("never lists an unverified fact", () => {
    const gm = facts.find((f) => f.id === "ex-gm") as Fact;
    const withUnverified = render(facts.map((f) => (f.id === gm.id ? { ...f, verified: false } : f)));
    expect(withUnverified).not.toContain(gm.label);
    expect(withUnverified).not.toContain(gm.value);
  });

  it("never renders a TODO(content) url as a link", () => {
    expect(text).not.toMatch(/\]\(TODO/);
  });
});
