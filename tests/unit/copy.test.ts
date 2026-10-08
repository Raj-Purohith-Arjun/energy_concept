import { describe, expect, it } from "vitest";
import siteFile from "../../content/site.json";

// The /facts framing is "same subject, different measures": figures that are
// most likely all accurate and counting different things. Copy that implies
// EnergyX got something wrong must not slip in.
const BANNED = /\b(?:contradict\w*|conflict\w*|errors?|erroneous|inconsistent\w*|inconsistenc\w*|discrepanc\w*|wrong|mistakes?)\b/i;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("facts copy framing", () => {
  const copy = strings([siteFile.factsPage, siteFile.factUi, siteFile.forwardLooking]);

  it("has copy to check", () => {
    expect(copy.length).toBeGreaterThan(0);
  });

  it.each(copy)("is neutral: %s", (text) => {
    expect(text).not.toMatch(BANNED);
  });
});
