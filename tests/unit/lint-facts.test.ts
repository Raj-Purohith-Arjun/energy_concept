import { describe, expect, it } from "vitest";
import {
  findClaims,
  formatViolation,
  scanJson,
  scanMdx,
  scanTsx,
} from "../../scripts/lint-facts-core";

const claims = (text: string) => findClaims(text).map((c) => c.text);
const known = new Set(["fake-widgets"]);

describe("findClaims: flags business-claim shapes", () => {
  it.each([
    ["$52.5M raised", "$52.5M"],
    ["raised US$ 1,000 so far", "US$ 1,000"],
    ["a €3 billion market", "€3 billion"],
    ["500 USD per share", "500 USD"],
    ["84% of the payload", "84%"],
    ["up 12 percent", "12 percent"],
    ["52,500 tpa LCE", "52,500 tpa"],
    ["3,000 acres", "3,000 acres"],
    ["over 150 patents", "150 patents"],
    ["150+ patents", "150+ patents"],
    ["40 ppm lithium", "40 ppm"],
    ["a 12,000 m² site", "12,000 m²"],
    ["2 million tonnes", "2 million"],
    ["40K shareholders", "40K"],
    ["140+ worldwide", "140+"],
    ["48.3 MB total", "48.3 MB"],
    ["49432 KiB", "49432 KiB"],
    ["LCP of 7.5 s", "7.5 s"],
    ["180ms TTFB", "180ms"],
    ["5.9s LCP", "5.9s"],
  ])("%s → %s", (text, expected) => {
    expect(claims(text)).toEqual([expected]);
  });

  it("reports overlapping patterns once, widest match", () => {
    expect(claims("$52.5 million")).toEqual(["$52.5 million"]);
  });
});

describe("findClaims: allowlist (CLAUDE.md §2.1)", () => {
  it.each([
    ["years", "Founded in 2018, rebuilt in 2026"],
    ["year with plus", "the 2030+ roadmap"],
    ["decades", "since the 1990s"],
    ["ISO dates", "Accessed 2026-10-08"],
    ["list numbering", "1. First step\n2) Second step"],
    ["copyright year", "© 2026 Energy Exploration Technologies."],
    ["street address", "2535 Ridgepoint Dr. Austin, TX 78754"],
    ["version strings", "Next.js 16.4.0 and v16+ and react@19.3.0"],
    ["tailwind fragments", "w-1/2 gap-4 md:grid-cols-2 h-(--header-h) max-w-5xl"],
    ["display resolution", "4K video"],
    ["URLs", "https://example.com/2024/50%25/150-patents"],
    ["plain numbers", "Step 3 of 4, page 12"],
    ["network names", "Slow 4G on a phone"],
  ])("%s", (_name, text) => {
    expect(claims(text)).toEqual([]);
  });
});

describe("scanTsx", () => {
  const scan = (source: string) => scanTsx("x.tsx", source, known);

  it("flags JSX text with the right line", () => {
    const v = scan(`export const A = () => (\n  <p>\n    Over 140+ worldwide\n  </p>\n);`);
    expect(v).toEqual([{ file: "x.tsx", line: 3, kind: "claim", text: "140+" }]);
  });

  it("flags readable attributes like aria-label and alt", () => {
    const v = scan(`const A = () => <img alt="52,500 tpa plant" aria-label="84% done" src="/a.png" />;`);
    expect(v.map((x) => x.text)).toEqual(["52,500 tpa", "84%"]);
  });

  it("flags string literals in data arrays", () => {
    expect(scan(`const stats = [{ value: "40%" }];`).map((x) => x.text)).toEqual(["40%"]);
  });

  it("ignores className, style, cn() and CSS object keys", () => {
    const source = `
      const A = () => (
        <div className="w-[50%] translate-x-[-50%]" style={{ width: "50%", inset: "10%" }}>
          <span className={cn("w-[25%]", cond && "h-[75%]")} data-x="99%" />
        </div>
      );
      const s = { maxWidth: "50%" };`;
    expect(scan(source)).toEqual([]);
  });

  it("ignores comments, imports and <address> text", () => {
    const source = `
      import x from "./150-patents";
      // 140+ patents in a comment
      /* $5M in a block comment */
      const A = () => <address>2535 Ridgepoint Dr.</address>;`;
    expect(scan(source)).toEqual([]);
  });

  it("checks literal <Fact id> references against the registry", () => {
    const source = `const A = () => <p><Fact id="fake-widgets" /> and <Fact id="nope" /></p>;`;
    expect(scan(source)).toEqual([{ file: "x.tsx", line: 1, kind: "unknown-fact", text: "nope" }]);
  });

  it("skips dynamic <Fact id={...}> (getFact throws at render instead)", () => {
    expect(scan(`const A = ({ id }) => <Fact id={id} />;`)).toEqual([]);
  });
});

describe("scanJson", () => {
  it("flags copy strings with line numbers", () => {
    const v = scanJson("c.json", `{\n  "title": "Hello",\n  "summary": "We hold 150+ patents"\n}`);
    expect(v).toEqual([{ file: "c.json", line: 3, kind: "claim", text: "150+ patents" }]);
  });

  it("skips ids, urls, dates, addresses, $comment and note", () => {
    const source = JSON.stringify({
      id: "x-150",
      url: "https://e.com/50%",
      homeHref: "/150+",
      accessed: "2026-10-08",
      addressLines: ["2535 Ridgepoint Dr.", "Suite 200 B"],
      $comment: ["84% of things"],
      note: "52,500 tpa",
      copyright: "© 2026 Energy Exploration Technologies.",
    });
    expect(scanJson("c.json", source)).toEqual([]);
  });
});

describe("scanMdx", () => {
  const scan = (source: string) => scanMdx("p.mdx", source, known);

  it("flags prose and checks <Fact> ids, skipping frontmatter keys, code and links", () => {
    const source = [
      "---",
      "date: 2026-10-08",
      "sourceUrl: https://e.com/150",
      "title: Raising $5M",
      "---",
      "import X from './y'",
      "We now process 52,500 tpa.",
      "```",
      "const a = '84%';",
      "```",
      "See [the 140+ report](https://e.com/140) and `50%` inline code.",
      'Capacity is <Fact id="fake-widgets" />, not <Fact id="missing" />.',
    ].join("\n");
    expect(scan(source)).toEqual([
      { file: "p.mdx", line: 4, kind: "claim", text: "$5M" },
      { file: "p.mdx", line: 7, kind: "claim", text: "52,500 tpa" },
      { file: "p.mdx", line: 11, kind: "claim", text: "140+" },
      { file: "p.mdx", line: 12, kind: "unknown-fact", text: "missing" },
    ]);
  });
});

describe("formatViolation", () => {
  it("matches the required output format", () => {
    expect(formatViolation({ file: "a.tsx", line: 7, kind: "claim", text: "52,500 tpa" })).toBe(
      'a.tsx:7 — "52,500 tpa" is hardcoded; use <Fact id="..." />',
    );
  });
});
