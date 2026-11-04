import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GapsReport } from "@/components/gaps/GapsReport";
import { getAllFacts, getGapsCopy } from "@/lib/content";
import type { GapRow, GapsFile } from "@/lib/schemas";

const copy = getGapsCopy();
const facts = getAllFacts();

const file = (gaps: GapRow[]): GapsFile => ({
  generatedAt: "2026-11-03T00:00:00.000Z",
  source: { linesRead: gaps.length, kept: gaps.length, skipped: {}, malformed: 0 },
  gaps,
});
const row = (overrides: Partial<GapRow> = {}): GapRow => ({
  question: "Who is the CEO?",
  subject: "unmatched",
  count: 1,
  firstAt: "2026-11-03T00:00:00.000Z",
  lastAt: "2026-11-03T00:00:00.000Z",
  reason: "no-match",
  nearest: [],
  ...overrides,
});

describe("<GapsReport>", () => {
  it("empty state is honest: explains itself, has no verdict and no rows", () => {
    const html = renderToStaticMarkup(<GapsReport gaps={file([])} facts={facts} copy={copy} />);
    expect(html).toContain(copy.empty.heading);
    expect(html).toContain("data-gaps-empty");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("data-gaps-verdict");
  });

  it("non-empty: verdict first, counted from the data, detail behind <details>", () => {
    const [fact] = facts;
    const html = renderToStaticMarkup(
      <GapsReport
        gaps={file([row(), row({ question: "Is there a second one?" }), row({ question: "A DLE one?", subject: "dle", count: 3, nearest: [fact.id] })])}
        facts={facts}
        copy={copy}
      />,
    );
    expect(html).toContain("3 questions across 2 subjects.");
    expect(html.indexOf("data-gaps-verdict")).toBeLessThan(html.indexOf("<details"));
    expect(html).toContain("Who is the CEO?");
    expect(html).toContain(copy.unmatchedSubject);
    expect(html).toContain("Asked 3 times");
    expect(html).toContain(`href="/facts#fact-${fact.id}"`);
    expect(html).toContain(fact.label);
    expect(html).toContain("TODO(content)");
  });

  it("uses singular forms and says so when there are no nearest facts", () => {
    const html = renderToStaticMarkup(<GapsReport gaps={file([row()])} facts={facts} copy={copy} />);
    expect(html).toContain("1 question across 1 subject.");
    expect(html).toContain(copy.noNearest);
  });
});
