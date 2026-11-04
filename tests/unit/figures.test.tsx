import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FactCard } from "@/components/facts/FactCard";
import { buildRegistry, getAllFacts } from "@/lib/content";
import { orderedFigures } from "@/lib/figures";
import { fakeAlso, fakeFact, fakeFile } from "../fixtures/facts";

const fact = (overrides: Record<string, unknown>) => [...buildRegistry(fakeFile(fakeFact(overrides))).values()][0];

describe("orderedFigures", () => {
  it("puts a stated figure before an inferred one", () => {
    const f = fact({ value: "Days", basisSource: "inferred", alsoPublishedAs: [fakeAlso({ value: "Hours", basisSource: "stated" })] });
    expect(orderedFigures(f).map((x) => x.value)).toEqual(["Hours", "Days"]);
  });

  it("keeps registry order when the main figure is already stated", () => {
    const f = fact({ alsoPublishedAs: [fakeAlso({ basisSource: "inferred" })] });
    expect(orderedFigures(f).map((x) => x.value)).toEqual(["123 widgets", "456 widgets"]);
  });

  it("the real ex-dle-time leads with Hours, and the facts card shows Days as also published and inferred", () => {
    const dle = getAllFacts().find((f) => f.id === "ex-dle-time");
    expect(dle).toBeDefined();
    expect(orderedFigures(dle!)[0].value).toBe("Hours");
    const html = renderToStaticMarkup(<FactCard fact={dle!} />);
    expect(html.indexOf("Hours")).toBeLessThan(html.indexOf("Days"));
    expect(html).toContain("Also published as");
  });
});
