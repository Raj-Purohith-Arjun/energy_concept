import { describe, expect, it } from "vitest";
import { EVAL_CASES, STUBS, TECHNIQUES } from "@/lib/assistant/eval-cases";
import { MUTANTS } from "@/lib/assistant/evals";
import { getEvals } from "@/lib/content";
import { fill, percent, questionText } from "@/lib/evals-view";

describe("content/evals.json", () => {
  const copy = getEvals();

  it("labels every mutant, group, technique and stub", () => {
    for (const { id } of MUTANTS) expect(copy.mutation.labels[id], id).toBeDefined();
    for (const group of new Set(EVAL_CASES.map((c) => c.group))) expect(copy.groups[group], group).toBeDefined();
    for (const t of TECHNIQUES) expect(copy.adversarial.techniques[t], t).toBeDefined();
    for (const s of STUBS) expect(copy.modelSlot.stubs[s], s).toBeDefined();
  });

  it("every adversarial technique has at least one case", () => {
    for (const t of TECHNIQUES) expect(EVAL_CASES.some((c) => c.technique === t), t).toBe(true);
  });
});

describe("evals view helpers", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("{count} of {total}", { count: 3, total: 9 })).toBe("3 of 9");
    expect(fill("{count} {missing}", { count: 1 })).toBe("1 {missing}");
  });

  it("rounds the pass rate down, so one failure never shows as 100%", () => {
    expect(percent(137, 138)).toBe("99%");
    expect(percent(138, 138)).toBe("100%");
    expect(percent(0, 0)).toBe("0%");
  });

  it("shows blank questions as (empty) and truncates long ones", () => {
    expect(questionText("    ")).toBe(getEvals().table.empty);
    expect(questionText("a".repeat(301))).toHaveLength(81);
  });
});
