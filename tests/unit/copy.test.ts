import { describe, expect, it } from "vitest";
import findingsFile from "../../content/findings.json";
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
  // findings.json: the registry section shares the /facts framing, and the
  // rest of its copy has no reason to use these words either.
  const findings = { ...findingsFile, $comment: undefined };
  const copy = strings([siteFile.factsPage, siteFile.factUi, siteFile.forwardLooking, findings]);

  it("has copy to check", () => {
    expect(copy.length).toBeGreaterThan(0);
  });

  it.each(copy)("is neutral: %s", (text) => {
    expect(text).not.toMatch(BANNED);
  });
});
