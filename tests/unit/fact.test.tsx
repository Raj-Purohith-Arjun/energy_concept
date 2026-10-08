import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import siteFile from "../../content/site.json";
import { fakeFact } from "../fixtures/facts";

// Render <Fact> against a fixture registry, so these tests don't change when
// the real facts.json is updated (e.g. when a fact gets verified).
const fixture = vi.hoisted(() => ({ facts: new Map<string, unknown>() }));

vi.mock("@/lib/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content")>();
  return {
    ...actual,
    getFact: (id: string, options?: { requireVerified?: boolean }) =>
      actual.lookupFact(fixture.facts as never, id, options),
  };
});

const { buildRegistry } = await import("@/lib/content");
const { Fact } = await import("@/components/ui/Fact");

function render(overrides: Record<string, unknown> = {}): string {
  const registry = buildRegistry({ facts: [fakeFact(overrides)] });
  fixture.facts = registry as Map<string, unknown>;
  return renderToStaticMarkup(<Fact id="fake-widgets" />);
}

const ui = siteFile.factUi;

describe("<Fact>", () => {
  beforeEach(() => {
    fixture.facts = new Map();
  });

  it("renders the value string as-is (unit is not appended)", () => {
    const html = render();
    expect(html).toContain(">123 widgets</span>");
    expect(html).not.toContain("123 widgets widgets");
  });

  it("always shows an Unverified marker for verified: false", () => {
    expect(render({ verified: false })).toContain(`>${ui.unverified}</span>`);
  });

  it("shows no Unverified marker for verified: true", () => {
    expect(render({ verified: true })).not.toContain(`>${ui.unverified}</span>`);
  });

  it.each(["planned", "estimate"])("chips %s and registers the forward-looking footnote", (kind) => {
    const html = render({ kind });
    expect(html).toContain('data-forward-looking=""');
    expect(html).toContain(ui.kinds[kind as "planned" | "estimate"]);
  });

  it.each(["actual", "company-claim"])("does not register a footnote for %s", (kind) => {
    expect(render({ kind })).not.toContain("data-forward-looking");
  });

  it("says pending owner approval when approvedAt is null", () => {
    expect(render({ approvedAt: null })).toContain(ui.pendingApproval);
  });

  it("labels the disclosure for screen readers", () => {
    expect(render()).toContain('aria-label="Show source for Fake widgets"');
  });

  it("visibly marks an inferred basis", () => {
    expect(render({ basisSource: "inferred" })).toContain(ui.inferred);
    expect(render({ basisSource: "stated" })).not.toContain(ui.inferred);
  });

  it("never renders a TODO(content) url as a link", () => {
    const html = render({
      source: { title: "T", url: "TODO(content) — find it", accessed: "2026-01-01" },
    });
    expect(html).not.toContain('href="TODO');
    expect(html).toContain(ui.sourcePending);
  });

  it("links a real source and shows the access date", () => {
    const html = render();
    expect(html).toContain('href="https://example.com/fixture"');
    expect(html).toContain('<time dateTime="2026-01-01">');
  });

  it("throws on an unknown id, which fails the build", () => {
    fixture.facts = new Map();
    expect(() => renderToStaticMarkup(<Fact id="nope" />)).toThrow(/Unknown fact id "nope"/);
  });
});
