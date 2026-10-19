import { describe, expect, it } from "vitest";
import { getAllFacts, getFact } from "@/lib/content";

// The registry's unit convention (see the $comment in content/facts.json):
// byte facts keep `numeric` in KiB exactly as Lighthouse reports it, and
// `value` shows decimal MB = KiB * 1024 / 1e6 to one decimal place.
const facts = getAllFacts();
const byteFacts = facts.filter((f) => f.unit === "KiB");
const kib = (id: string) => getFact(id).numeric as number;

describe("byte facts", () => {
  it("has byte facts to check", () => {
    expect(byteFacts.length).toBeGreaterThanOrEqual(9);
  });

  it.each(byteFacts.map((f) => [f.id, f]))("%s: value is recomputed from numeric", (_id, fact) => {
    expect(fact.numeric, "byte facts need a numeric").toBeTypeOf("number");
    expect(fact.value).toBe(`${(((fact.numeric as number) * 1024) / 1e6).toFixed(1)} MB`);
  });

  // Catches a future size fact added without `unit: "KiB"`, which would
  // silently skip the check above.
  it.each(facts.filter((f) => /\bMB$/.test(f.value)).map((f) => [f.id, f]))("%s: an MB value has unit KiB", (_id, fact) => {
    expect(fact.unit).toBe("KiB");
  });

  // The inferred breakdown facts are arithmetic on measured ones.
  it("Black Giant video total is the sum of the two files", () => {
    expect(kib("lh-bg-video-total")).toBeCloseTo(kib("lh-bg-hero-video") + kib("lh-bg-second-video"), 1);
  });

  it("Black Giant other bytes are the total minus both videos", () => {
    expect(kib("lh-bg-other-bytes")).toBeCloseTo(kib("lh-bg-weight") - kib("lh-bg-video-total"), 1);
  });

  it("homepage other bytes are the total minus Box and the second video", () => {
    expect(kib("lh-home-other-bytes")).toBeCloseTo(
      kib("lh-home-weight") - kib("lh-home-box") - kib("lh-home-second-video"),
      1,
    );
  });
});

describe("implied water reduction", () => {
  it("is 1 - dle / conventional, from the two published figures", () => {
    const conventional = getFact("ex-water-conventional").numeric as number;
    const dle = getFact("ex-water-dle").numeric as number;
    const implied = getFact("ex-water-implied-reduction");
    const percent = Number(((1 - dle / conventional) * 100).toFixed(1));
    expect(implied.numeric).toBe(percent);
    expect(implied.value).toContain(`${percent}%`);
  });
});
