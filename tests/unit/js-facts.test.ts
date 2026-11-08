import { describe, expect, it } from "vitest";
import { getFact, getFindings } from "@/lib/content";

// Local first-load JavaScript facts (scripts/measure-weight.ts). Budget is the
// one in that script: 150 KiB. These pin the facts to each other so a
// re-measurement that updates one and not the others fails here.
const BUDGET_KIB = 150;
const kib = (id: string) => getFact(id).numeric as number;

describe("first-load JavaScript facts", () => {
  const routes = getFindings().bundle.routes;

  it.each(routes.map((r) => [r.label, r.fact]))("%s: a verified, measured, unapproved local fact", (_label, id) => {
    const fact = getFact(id);
    expect(fact.kind).toBe("actual");
    expect(fact.verified).toBe(true);
    expect(fact.approvedAt).toBeNull();
    expect(fact.basis).toMatch(/measured by scripts\/measure-weight\.ts, Playwright, 390px viewport, \d{4}-\d{2}-\d{2}/i);
    expect(fact.basis).toMatch(/local measurement, not the deployed site/);
    expect(fact.numeric).toBeLessThanOrEqual(BUDGET_KIB);
  });

  it("covers every measured route once", () => {
    expect(new Set(routes.map((r) => r.fact)).size).toBe(routes.length);
    // Home, Black Giant, Facts, Findings, Evals. /gaps was cut (CLAUDE.md §8).
    expect(routes).toHaveLength(5);
  });

  it("headroom is the budget minus the Black Giant figure, to one decimal", () => {
    expect(kib("demo-js-bg-headroom")).toBeCloseTo(BUDGET_KIB - kib("demo-js-black-giant"), 0);
    expect(getFact("demo-js-bg-headroom").value).toBe(`${kib("demo-js-bg-headroom").toFixed(1)} KiB`);
  });

  it("the Black Giant extra is the gap to the home page, to one decimal", () => {
    expect(kib("demo-js-bg-only-chunk")).toBeCloseTo(kib("demo-js-black-giant") - kib("demo-js-home"), 1);
  });

  it("derived shares are inferred, never forward-looking", () => {
    for (const id of ["demo-js-framework-share", "demo-js-own-chunk-share", "demo-js-bg-only-chunk"]) {
      expect(getFact(id).basisSource).toBe("inferred");
      expect(getFact(id).kind).toBe("actual");
      expect(getFact(id).basis).toMatch(/not module-exact|not module-level|fingerprint/i);
    }
  });
});
