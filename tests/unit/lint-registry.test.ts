import { describe, expect, it } from "vitest";
import factsFile from "../../content/facts.json";
import { NO_PUBLIC_URL, registryReport } from "../../scripts/lint-facts-core";
import { buildRegistry } from "@/lib/content";
import { fakeAlso, fakeFact, fakeFile } from "../fixtures/facts";

const report = (...facts: Record<string, unknown>[]) => registryReport([...buildRegistry(fakeFile(...facts)).values()]);
const noUrl = { title: "Local measurement", url: NO_PUBLIC_URL, accessed: "2026-01-01" };

describe("lint:facts registry report", () => {
  it("is quiet for a finished fact", () => {
    expect(report(fakeFact())).toEqual({ warnings: [], intentionalNoUrl: [] });
  });

  it("warns about an unverified fact", () => {
    expect(report(fakeFact({ verified: false })).warnings).toEqual(["fake-widgets: verified is false"]);
  });

  it("warns about an unfinished TODO(content) anywhere, including a source url", () => {
    const basis = report(fakeFact({ basis: "TODO(content) find out" }));
    expect(basis.warnings).toEqual(["fake-widgets.basis: TODO(content)"]);
    const url = report(fakeFact({ source: { ...noUrl, url: "TODO(content) find the page" } }));
    expect(url.warnings).toEqual(["fake-widgets.source.url: TODO(content)"]);
    const also = report(fakeFact({ alsoPublishedAs: [fakeAlso({ basis: "TODO(content) later" })] }));
    expect(also.warnings).toEqual(["fake-widgets.alsoPublishedAs[0].basis: TODO(content)"]);
  });

  it("treats the one exact 'no public URL' marker on a fact's own source as intentional, not a warning", () => {
    const r = report(fakeFact({ source: noUrl }));
    expect(r.warnings).toEqual([]);
    expect(r.intentionalNoUrl).toEqual(["fake-widgets"]);
  });

  it("does not forgive the marker anywhere else, or any near-miss", () => {
    // In a basis, or on an alternate figure's url: still an unfinished marker.
    expect(report(fakeFact({ basis: NO_PUBLIC_URL })).warnings).toEqual(["fake-widgets.basis: TODO(content)"]);
    expect(report(fakeFact({ alsoPublishedAs: [fakeAlso({ url: NO_PUBLIC_URL })] })).warnings).toEqual([
      "fake-widgets.alsoPublishedAs[0].url: TODO(content)",
    ]);
    // A different TODO in the same place.
    expect(report(fakeFact({ source: { ...noUrl, url: `${NO_PUBLIC_URL} (find one)` } })).warnings).toEqual(["fake-widgets.source.url: TODO(content)"]);
  });

  it("the real registry has no warnings, and every intentional case is a local demo measurement", () => {
    const registry = buildRegistry(factsFile);
    const r = registryReport([...registry.values()]);
    expect(r.warnings).toEqual([]);
    expect(r.intentionalNoUrl.length).toBeGreaterThan(0);
    for (const id of r.intentionalNoUrl) expect(id, id).toMatch(/^demo-(?:js|css)-/);
  });
});
