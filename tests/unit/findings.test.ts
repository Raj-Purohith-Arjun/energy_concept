import { describe, expect, it } from "vitest";
import factsFile from "../../content/facts.json";
import findingsFile from "../../content/findings.json";
import { buildRegistry, ContentError, getFindings, parseContent, validateFindings, type FactRegistry } from "@/lib/content";
import { factTokenIds, malformedFactTokens, parseFactText } from "@/lib/fact-text";
import { FindingsSchema, type FindingsContent } from "@/lib/schemas";

describe("parseFactText", () => {
  it("splits prose around {fact:id} tokens", () => {
    expect(parseFactText("Weighs {fact:lh-bg-weight} in total.")).toEqual([
      { text: "Weighs " },
      { factId: "lh-bg-weight" },
      { text: " in total." },
    ]);
  });

  it("handles adjacent tokens and text with none", () => {
    expect(factTokenIds("{fact:a}{fact:b-c}")).toEqual(["a", "b-c"]);
    expect(parseFactText("plain")).toEqual([{ text: "plain" }]);
  });

  it.each(["{fact:Bad_Id}", "{fact:lh-bg-weight", "{fact:}"])("flags malformed token %s", (text) => {
    expect(malformedFactTokens(text)).toBe(true);
  });
});

describe("findings content", () => {
  const registry = buildRegistry(factsFile);
  const fresh = (): FindingsContent => parseContent(FindingsSchema, structuredClone(findingsFile), "findings");
  const invalid = (mutate: (f: FindingsContent) => void, reg: FactRegistry = registry) => {
    const findings = fresh();
    mutate(findings);
    return () => validateFindings(findings, reg);
  };

  it("accepts the real content/findings.json", () => {
    expect(() => getFindings()).not.toThrow();
  });

  // The real cells are all measured now, so inject a pending one.
  it("allows TODO(content) cells", () => {
    expect(invalid((f) => (f.comparison.rows[0].after = "TODO(content) later"))).not.toThrow();
  });

  it("rejects an unknown fact id in a table cell", () => {
    expect(invalid((f) => (f.comparison.rows[0].before = "no-such-fact"))).toThrow(/unknown fact id "no-such-fact"/);
  });

  it("rejects an unknown fact id in a prose token", () => {
    expect(invalid((f) => (f.caveats.points[0] = "See {fact:no-such-fact}."))).toThrow(ContentError);
  });

  it("rejects a malformed prose token", () => {
    expect(invalid((f) => (f.intro = "Broken {fact:lh-bg-weight"))).toThrow(/malformed/);
  });

  it("rejects an unverified fact anywhere", () => {
    const unverified = new Map(registry);
    unverified.set("lh-bg-weight", { ...registry.get("lh-bg-weight")!, verified: false });
    expect(invalid(() => {}, unverified)).toThrow(/"lh-bg-weight" is unverified/);
  });

  it("rejects a payload part that is not a byte fact", () => {
    expect(invalid((f) => (f.payload.pages[0].parts[0].fact = "lh-bg-lcp"))).toThrow(/must be a byte fact/);
  });

  it("rejects payload parts under a pending total", () => {
    expect(
      invalid((f) => (f.payload.pages[0].total = "TODO(content) later")),
    ).toThrow(/parts need a measured total/);
  });

  it("rejects a figures case whose fact has no other published figures", () => {
    expect(invalid((f) => (f.registry.cases[0].figures = "ex-founded"))).toThrow(/no alsoPublishedAs/);
  });

  it("payload parts add up to their page total", () => {
    for (const page of getFindings().payload.pages) {
      if (page.parts.length === 0) continue;
      const sum = page.parts.reduce((n, p) => n + (registry.get(p.fact)?.numeric ?? 0), 0);
      expect(sum, page.label).toBeCloseTo(registry.get(page.total)?.numeric ?? NaN, 1);
    }
  });
});
