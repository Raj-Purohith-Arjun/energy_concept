import { describe, expect, it, vi } from "vitest";
import type { Composer } from "@/lib/assistant/compose";
import { baseNormalize, deLeet, fixTypos, joinSpacedLetters } from "@/lib/assistant/normalize";
import { ask } from "@/lib/assistant/pipeline";
import { numbersIn, postcheck } from "@/lib/assistant/postcheck";
import { getAllFacts, getAssistant } from "@/lib/content";
import type { Fact } from "@/lib/schemas";

const NOW = new Date("2026-10-10T12:00:00Z");
const assistant = getAssistant();
const realFacts = getAllFacts();
const gm = realFacts.find((f) => f.id === "ex-gm") as Fact;
const bgWeight = realFacts.find((f) => f.id === "lh-bg-weight") as Fact;

describe("normalisation", () => {
  it("folds full-width, Cyrillic homoglyphs, zero-width and accents", () => {
    expect(baseNormalize("ＩＰＯ")).toBe("ipo");
    expect(baseNormalize("ІРО")).toBe("ipo");
    expect(baseNormalize("I​P​O")).toBe("ipo");
    expect(baseNormalize("Inversión")).toBe("inversion");
  });

  it("joins spaced-out letters and reads leetspeak only in mixed tokens", () => {
    expect(joinSpacedLetters("the i.p.o. date")).toBe("the ipo date");
    expect(joinSpacedLetters("r - o - i")).toBe("roi");
    expect(deLeet("the 1p0 and r3turns")).toBe("the ipo and returns");
    expect(deLeet("founded 2018, 10x")).toBe("founded 2018, iox"); // pure numbers untouched
  });

  it("corrects one-edit typos of risk keywords but not real words", () => {
    expect(fixTypos("retruns valuaton guarenteed")).toBe("returns valuation guaranteed");
    expect(fixTypos("the page is divided")).toBe("the page is divided");
  });
});

describe("post-check", () => {
  it("passes when every number comes from the facts", () => {
    expect(postcheck({ text: "Black Giant page total payload: 50.6 MB.", citations: [bgWeight.id] }, [bgWeight]))
      .toEqual({ ok: true });
  });

  it("canonicalises numbers (commas, leading/trailing zeros)", () => {
    expect(numbersIn("52,500 and 007.50 and 2026-10-08")).toEqual(["52500", "7.5", "2026", "10", "8"]);
  });

  it.each([
    ["an invented number", "Black Giant page total payload: 50.6 MB, about 99.8% heavier.", "untraced numbers: 99.8"],
    ["a number in words", "The page is forty megabytes.", "untraced number words: forty"],
    ["a computed figure", "That is 51 MB.", "untraced numbers: 51"],
  ])("drops %s", (_name, text, reason) => {
    expect(postcheck({ text, citations: [bgWeight.id] }, [bgWeight])).toEqual({ ok: false, reason });
  });

  it("drops citations of facts that were not retrieved", () => {
    expect(postcheck({ text: "x", citations: ["ex-patents"] }, [bgWeight])).toEqual({
      ok: false,
      reason: "cites unretrieved facts: ex-patents",
    });
  });

  it("drops answers without citations", () => {
    expect(postcheck({ text: "x", citations: [] }, [bgWeight])).toMatchObject({ ok: false });
  });
});

describe("pipeline with a stubbed composer", () => {
  const question = "How heavy is the Black Giant page?";

  it("replaces a dropped answer with the no-sourced-answer message and logs why", async () => {
    const warn = vi.fn();
    const lying: Composer = async () => ({ text: "It is 99 MB.", citations: [bgWeight.id] });
    const outcome = await ask(question, { facts: realFacts, assistant, compose: lying, now: NOW, warn });
    expect(outcome).toMatchObject({ kind: "no-answer", reason: "post-check" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("untraced numbers: 99"));
  });

  it("treats a composer failure as no answer, and logs it", async () => {
    const warn = vi.fn();
    const broken: Composer = async () => {
      throw new Error("model timeout");
    };
    const outcome = await ask(question, { facts: realFacts, assistant, compose: broken, now: NOW, warn });
    expect(outcome).toMatchObject({ kind: "no-answer", reason: "post-check" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("model timeout"));
  });

  it("never calls the composer for a refused question", async () => {
    const compose = vi.fn<Composer>();
    await ask("When is the IPO?", { facts: realFacts, assistant, compose, now: NOW, warn: () => {} });
    expect(compose).not.toHaveBeenCalled();
  });

  it("rejects non-string input", async () => {
    const outcome = await ask({ q: "When is the IPO?" }, { facts: realFacts, assistant, now: NOW });
    expect(outcome).toMatchObject({ kind: "no-answer", reason: "empty" });
  });
});

describe("unverified facts are invisible", () => {
  const unverifiedGm: Fact = { ...gm, verified: false };
  const facts = realFacts.map((f) => (f.id === gm.id ? unverifiedGm : f));

  it("can't be retrieved, listed or leaked", async () => {
    const outcome = await ask("Has GM invested in EnergyX?", { facts, assistant, now: NOW, warn: () => {} });
    expect(outcome).toMatchObject({ kind: "no-answer", reason: "no-match" });
    expect(JSON.stringify(outcome)).not.toContain(gm.value);
    expect(outcome.kind === "no-answer" && outcome.coverage).not.toContain(gm.label);
  });
});
