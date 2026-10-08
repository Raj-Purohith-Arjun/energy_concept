import { describe, expect, it } from "vitest";
import factsFile from "../../content/facts.json";
import { buildRegistry, ContentError, lookupFact } from "@/lib/content";
import { fakeAlso, fakeFact, fakeFile } from "../fixtures/facts";

describe("facts registry schema", () => {
  it("accepts the real content/facts.json", () => {
    expect(() => buildRegistry(factsFile)).not.toThrow();
  });

  it("accepts a valid fixture, with $comment and note ignored", () => {
    const registry = buildRegistry(
      fakeFile(fakeFact({ note: "author note", alsoPublishedAs: [fakeAlso({ note: "n" })] })),
    );
    expect(registry.get("fake-widgets")?.alsoPublishedAs).toHaveLength(1);
  });

  it("defaults alsoPublishedAs to an empty array", () => {
    expect(buildRegistry(fakeFile(fakeFact())).get("fake-widgets")?.alsoPublishedAs).toEqual([]);
  });

  it.each([
    ["missing basis", { basis: undefined }],
    ["blank basis", { basis: "   " }],
    ["missing basisSource", { basisSource: undefined }],
    ["unknown basisSource", { basisSource: "guessed" }],
    ["missing verified", { verified: undefined }],
    ["non-boolean verified", { verified: "yes" }],
    ["unknown kind", { kind: "rumour" }],
    ["non-kebab id", { id: "Fake_Widgets" }],
    ["http source url", { source: { title: "t", url: "http://example.com", accessed: "2026-01-01" } }],
    ["bad accessed date", { source: { title: "t", url: "https://example.com", accessed: "Oct 8" } }],
    ["unknown key (typo)", { approvedat: null }],
  ])("rejects a fact with %s", (_name, overrides) => {
    expect(() => buildRegistry(fakeFile(fakeFact(overrides)))).toThrow(ContentError);
  });

  it.each([
    ["missing basis", { basis: undefined }],
    ["missing basisSource", { basisSource: undefined }],
    ["unknown key", { title: "not allowed here" }],
  ])("rejects an alsoPublishedAs entry with %s", (_name, overrides) => {
    const file = fakeFile(fakeFact({ alsoPublishedAs: [fakeAlso(overrides)] }));
    expect(() => buildRegistry(file)).toThrow(ContentError);
  });

  it("allows an explicit TODO(content) source url", () => {
    const file = fakeFile(fakeFact({ alsoPublishedAs: [fakeAlso({ url: "TODO(content) — find it" })] }));
    expect(() => buildRegistry(file)).not.toThrow();
  });

  it("names the file in the error", () => {
    expect(() => buildRegistry(fakeFile(fakeFact({ basis: "" })), "content/facts.json")).toThrow(
      /content\/facts\.json is invalid/,
    );
  });

  it("rejects duplicate ids", () => {
    expect(() => buildRegistry(fakeFile(fakeFact(), fakeFact()))).toThrow(/duplicate fact id "fake-widgets"/);
  });
});

describe("lookupFact", () => {
  const registry = buildRegistry(
    fakeFile(fakeFact(), fakeFact({ id: "fake-unverified", verified: false })),
  );

  it("throws on an unknown id", () => {
    expect(() => lookupFact(registry, "nope")).toThrow(/Unknown fact id "nope"/);
  });

  it("returns unverified facts by default (the /facts page shows them)", () => {
    expect(lookupFact(registry, "fake-unverified").verified).toBe(false);
  });

  it("throws on an unverified fact when requireVerified is set", () => {
    expect(() => lookupFact(registry, "fake-unverified", { requireVerified: true })).toThrow(
      /unverified/,
    );
  });

  it("returns a verified fact when requireVerified is set", () => {
    expect(lookupFact(registry, "fake-widgets", { requireVerified: true }).id).toBe("fake-widgets");
  });
});
