// pnpm compose:facts — pre-generates answer wording with Gemini into
// data/composed.json. Reads GEMINI_API_KEY and GEMINI_MODEL from the
// environment or .env.local; never prints the key. With either unset it exits
// without touching the file, and the site keeps the template for every fact
// without a stored sentence.
//
//   pnpm compose:facts                  word every fact (replaces the sentences)
//   pnpm compose:facts --retry-failed   re-send only facts that failed or were
//                                       rejected; keeps reviewed sentences
// Either way the rejection log is kept: it is evidence, never discarded.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAllFacts } from "../src/lib/content";
import { composeFacts, mergeStores, settingsFromEnv } from "../src/lib/assistant/compose-facts";
import { ComposedStoreSchema } from "../src/lib/assistant/composed";

const OUT = path.join(process.cwd(), "data", "composed.json");

const COMMENT = [
  "Written by `pnpm compose:facts`. Do not edit by hand: re-run the script.",
  "One model-written sentence per verified fact. Each is re-checked at build; a stale",
  "or failing sentence is rejected and its fact uses the built-in template.",
];

async function main(): Promise<number> {
  try {
    process.loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const settings = settingsFromEnv(process.env);
  if (!settings) {
    console.log("GEMINI_API_KEY or GEMINI_MODEL is not set: data/composed.json left as is (template wording).");
    return 0;
  }
  const retryFailed = process.argv.includes("--retry-failed");
  const previous = ComposedStoreSchema.parse(JSON.parse(readFileSync(OUT, "utf8")));
  const facts = retryFailed ? getAllFacts().filter((f) => f.id in previous.failed) : getAllFacts();
  console.log(`Composing ${retryFailed ? `${facts.length} failed facts` : "every fact"} with ${settings.model}...`);
  const run = await composeFacts(facts, { ...settings, log: (line) => console.log(`  ${line}`) });
  const store = retryFailed
    ? mergeStores(previous, run)
    : { ...run, rejections: [...previous.rejections, ...run.rejections] };
  writeFileSync(OUT, `${JSON.stringify({ $comment: COMMENT, ...store }, null, 2)}\n`);

  const ok = Object.values(run.sentences);
  const times = ok.map((s) => s.attempts.at(-1)!.ms).sort((a, b) => a - b);
  const allAttempts = [...ok, ...Object.values(run.failed)].flatMap((s) => s.attempts);
  console.log(`\nThis run: ${ok.length} sentences, ${Object.keys(run.failed).length} failed or rejected.`);
  if (times.length > 0) {
    console.log(`Successful call latency: min ${times[0]} ms, median ${times[Math.floor(times.length / 2)]} ms, max ${times.at(-1)} ms.`);
  }
  console.log(`Attempts: ${allAttempts.length}, errors: ${allAttempts.filter((a) => a.status !== "200").length}.`);
  console.log(`Tokens: ${ok.reduce((n, s) => n + s.tokensIn, 0)} in, ${ok.reduce((n, s) => n + s.tokensOut, 0)} out.`);
  return 0;
}

main().then(
  (code) => (process.exitCode = code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
