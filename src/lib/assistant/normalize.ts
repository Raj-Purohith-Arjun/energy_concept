// Normalisation for the deterministic refusal gate. The pre-filter checks every
// variant returned by `variants()`; a hit in ANY of them refuses. Each variant
// undoes one kind of disguise, so they widen what is refused and can never
// narrow it.

const ZERO_WIDTH = /[​-‍⁠﻿­]/g;

// Cyrillic and Greek letters that render like Latin ones (lower case; input is
// lower-cased first). Lets "ІРО" (Cyrillic) read as "ipo".
const HOMOGLYPHS: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c",
  т: "t", у: "y", х: "x", і: "i", ї: "i", ј: "j", ѕ: "s", ԁ: "d", ɡ: "g", һ: "h",
  α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t",
  υ: "u", χ: "x", ω: "w",
};
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPHS).join("")}]`, "g");

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i",
};

/** NFKC, lower case, no zero-width or combining marks, homoglyphs mapped. */
export function baseNormalize(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(ZERO_WIDTH, "")
    .replace(HOMOGLYPH_RE, (ch) => HOMOGLYPHS[ch] ?? ch)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** "i.p.o", "i p o", "r-o-i" -> "ipo", "roi" (three or more single letters). */
export function joinSpacedLetters(text: string): string {
  return text.replace(/\b[a-z](?:[\s.\-_*·/|]+[a-z]\b){2,}\.?/g, (run) => run.replace(/[^a-z]/g, ""));
}

/** Inside tokens that mix letters with digits/symbols only: "1p0" -> "ipo". */
export function deLeet(text: string): string {
  return text.replace(/[\p{L}\p{N}@$!]+/gu, (token) =>
    /\p{L}/u.test(token) && /[0-9@$!]/.test(token)
      ? token.replace(/[0134578@$!]/g, (ch) => LEET[ch] ?? ch)
      : token,
  );
}

// One-edit typos of high-risk keywords: "retruns", "valuaton", "guarenteed".
// Only long words, and plural/longer forms, to keep collisions with real words
// (e.g. "divided" vs "dividend") out; TYPO_EXCEPTIONS lists known ones.
const TYPO_KEYWORDS = [
  "returns", "investment", "investing", "guaranteed", "guarantee", "valuation",
  "dividends", "forecast", "projections", "nasdaq", "offering", "upside",
];
const TYPO_EXCEPTIONS = new Set(["divided", "investments", "guarantees", "forecasts", "offerings"]);

function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  // Damerau-Levenshtein distance <= 1 (substitution, insertion, deletion,
  // or one adjacent transposition).
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

export function fixTypos(text: string): string {
  return text.replace(/\p{L}{6,}/gu, (word) => {
    if (TYPO_EXCEPTIONS.has(word) || TYPO_KEYWORDS.includes(word)) return word;
    return TYPO_KEYWORDS.find((keyword) => withinOneEdit(word, keyword)) ?? word;
  });
}

/** Every reading of the question the pre-filter must check. */
export function variants(input: string): string[] {
  const base = baseNormalize(input);
  const joined = joinSpacedLetters(base);
  const unleet = deLeet(joined);
  return [...new Set([base, joined, unleet, fixTypos(unleet)])];
}

/** True if the text has letters outside the Latin script (after homoglyphs). */
export function hasNonLatinLetters(normalized: string): boolean {
  return /(?![\p{Script=Latin}])\p{L}/u.test(normalized);
}
