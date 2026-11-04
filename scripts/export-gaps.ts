// pnpm export:gaps — turns data/unanswered.jsonl (git-ignored, local) into
// content/gaps.json (committed). It redacts emails, numbers and links, merges
// repeats, and files each question under a subject from assistant.json.
//
// Run it by hand, then READ content/gaps.json before committing: a name typed
// into a question cannot be detected automatically. It never runs at build time.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAllFacts, getAssistant } from "../src/lib/content";
import { GapsFileSchema } from "../src/lib/schemas";
import { buildGaps } from "./export-gaps-core";

const LOG = path.join(process.cwd(), "data", "unanswered.jsonl");
const OUT = path.join(process.cwd(), "content", "gaps.json");

function main(): number {
  const exists = existsSync(LOG);
  if (!exists) console.log(`${LOG} does not exist: writing an empty snapshot.`);
  const lines = exists ? readFileSync(LOG, "utf8").split(/\r?\n/) : [];

  const { file, malformed } = buildGaps(lines, getAllFacts(), getAssistant(), new Date().toISOString());
  for (const m of malformed) console.error(`line ${m.line}: not a valid log entry (${m.problem})`);
  if (malformed.length > 0) {
    console.error(`${malformed.length} malformed line(s): content/gaps.json left untouched. Fix or remove them and re-run.`);
    return 1;
  }
  // The same schema the site validates with, so a bad export fails here, not in the build.
  writeFileSync(OUT, `${JSON.stringify(GapsFileSchema.parse(file), null, 2)}\n`);

  const { source, gaps } = file;
  const skipped = Object.entries(source.skipped)
    .map(([reason, n]) => `${reason}: ${n}`)
    .join(", ");
  console.log(`Read ${source.linesRead} line(s); kept ${source.kept}; ${gaps.length} distinct question(s) written to content/gaps.json.`);
  console.log(`Skipped (not unanswered questions): ${skipped === "" ? "none" : skipped}.`);
  console.log("Now review content/gaps.json by hand (names cannot be redacted automatically) before committing.");
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
