import { isForwardLooking, type Fact } from "@/lib/schemas";
import type { ComposedAnswer } from "./compose";

// Step 5: every number in a composed answer must appear in the retrieved
// facts, and every citation must be one of them. Otherwise the answer is
// dropped. Numbers written as words count too, so a model can't route around
// the check with "forty thousand". ("one" is excluded: "one of", "no one".)

const DIGITS = /\d[\d,]*(?:\.\d+)?/g;
const NUMBER_WORDS =
  /\b(?:zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|dozen)\b/gi;

function canonicalNumber(raw: string): string {
  const [int, frac] = raw.replace(/,/g, "").split(".");
  const intPart = int.replace(/^0+(?=\d)/, "");
  const fracPart = (frac ?? "").replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

export function numbersIn(text: string): string[] {
  return (text.match(DIGITS) ?? []).map(canonicalNumber);
}

export function numberWordsIn(text: string): string[] {
  return (text.match(NUMBER_WORDS) ?? []).map((w) => w.toLowerCase());
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

export type PostcheckResult = { ok: true } | { ok: false; reason: string };

export function postcheck(answer: ComposedAnswer, facts: Fact[]): PostcheckResult {
  if (answer.text.trim() === "") return { ok: false, reason: "empty answer text" };

  const ids = new Set(facts.map((f) => f.id));
  if (answer.citations.length === 0) return { ok: false, reason: "no citations" };
  const unknown = answer.citations.filter((id) => !ids.has(id));
  if (unknown.length > 0) return { ok: false, reason: `cites unretrieved facts: ${unknown.join(", ")}` };

  const source = strings(facts).join(" ");
  const allowedNumbers = new Set(numbersIn(source));
  const allowedWords = new Set(numberWordsIn(source));

  const badNumbers = numbersIn(answer.text).filter((n) => !allowedNumbers.has(n));
  if (badNumbers.length > 0) return { ok: false, reason: `untraced numbers: ${badNumbers.join(", ")}` };
  const badWords = numberWordsIn(answer.text).filter((w) => !allowedWords.has(w));
  if (badWords.length > 0) return { ok: false, reason: `untraced number words: ${badWords.join(", ")}` };

  return { ok: true };
}

// A plan's own figure ("50Ktpa LiOH by 2030") is published text, and the
// pre-filter would read its year as a forecast. Remove exactly those strings,
// from plans and estimates only, before the check; every other word is still
// checked, and postcheck has already tied every number to a retrieved fact.
export function withoutPublishedPlans(text: string, facts: Fact[]): string {
  return facts
    .filter(isForwardLooking)
    .flatMap((f) => [f.value, ...f.alsoPublishedAs.map((a) => a.value)])
    .reduce((out, value) => out.split(value).join(" "), text);
}
