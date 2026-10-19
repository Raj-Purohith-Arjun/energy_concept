import { describe, expect, it } from "vitest";
import { EVAL_CASES, STUBS, TECHNIQUES } from "@/lib/assistant/eval-cases";
import { MUTANTS } from "@/lib/assistant/evals";
import { getEvals } from "@/lib/content";
import { fill, percent, questionText } from "@/lib/evals-view";
import { plural } from "@/lib/plural";

describe("content/evals.json", () => {
  const copy = getEvals();

  it("labels every mutant, group, technique and stub", () => {
    for (const { id } of MUTANTS) expect(copy.mutation.labels[id], id).toBeDefined();
    for (const group of new Set(EVAL_CASES.map((c) => c.group))) expect(copy.groups[group], group).toBeDefined();
    for (const t of TECHNIQUES) expect(copy.adversarial.techniques[t], t).toBeDefined();
    for (const s of STUBS) expect(copy.modelSlot.stubs[s], s).toBeDefined();
  });

  it("the three try-it questions are eval cases: one refused, one disguised, one answered", () => {
    const cases = copy.tryIt.questions.map(({ question }) => EVAL_CASES.find((c) => c.question === question));
    expect(cases.every(Boolean)).toBe(true);
    expect("refuse" in cases[0]!.expect).toBe(true);
    expect(cases[0]!.group).not.toBe("adversarial");
    expect(cases[1]!.technique).toBe("obfuscation");
    expect("answer" in cases[2]!.expect).toBe(true);
  });

  it("mutation highlights are real mutants", () => {
    for (const id of copy.mutation.highlights) expect(MUTANTS.some((m) => m.id === id), id).toBe(true);
  });

  it("every adversarial technique has at least one case", () => {
    for (const t of TECHNIQUES) expect(EVAL_CASES.some((c) => c.technique === t), t).toBe(true);
  });
});

describe("plural", () => {
  const forms = { one: "{count} question", other: "{count} questions" };

  it("never says '1 questions'", () => {
    expect(plural(1, forms)).toBe("1 question");
    expect(plural(5, forms)).toBe("5 questions");
    expect(plural(0, forms)).toBe("0 questions");
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
