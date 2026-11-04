// pnpm compose:posts — pre-generates whole LinkedIn posts, one per topic in
// content/assistant.json draft.voice.postTopics, with Gemini into
// data/composed-posts.json. Reads GEMINI_API_KEY and GEMINI_MODEL from the
// environment or .env.local; never prints the key. With either unset it exits
// without touching the file, and the site keeps the template for every topic.
//
//   pnpm compose:posts                  write every topic (replaces the posts)
//   pnpm compose:posts --retry-failed   re-send only topics that failed or were
//                                       refused; keeps reviewed posts
// Either way the rejection log is kept: it is evidence, never discarded.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { composePosts, mergePostStores } from "../src/lib/assistant/compose-posts";
import { PostStoreSchema } from "../src/lib/assistant/composed-posts";
import { settingsFromEnv } from "../src/lib/assistant/compose-facts";
import { getAllFacts, getAssistant, getSite } from "../src/lib/content";

const OUT = path.join(process.cwd(), "data", "composed-posts.json");

const COMMENT = [
  "Written by `pnpm compose:posts`. Do not edit by hand: re-run the script.",
  "One model-written LinkedIn post per topic. Each is re-checked when the site is built;",
  "a stale or failing post is dropped and its topic uses the built-in template.",
];

async function main(): Promise<number> {
  try {
    process.loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const settings = settingsFromEnv(process.env);
  if (!settings) {
    console.log("GEMINI_API_KEY or GEMINI_MODEL is not set: data/composed-posts.json left as is (template wording).");
    return 0;
  }
  const assistant = getAssistant();
  const retryFailed = process.argv.includes("--retry-failed");
  const previous = PostStoreSchema.parse(JSON.parse(readFileSync(OUT, "utf8")));
  const topicIds = retryFailed ? assistant.draft.voice.postTopics.filter((id) => id in previous.failed) : undefined;
  console.log(`Composing ${retryFailed ? `${topicIds?.length ?? 0} failed topics` : "every topic"} with ${settings.model}...`);
  const run = await composePosts(getAllFacts(), assistant, getSite().forwardLooking, {
    ...settings,
    topicIds,
    log: (line) => console.log(`  ${line}`),
  });
  const store = retryFailed ? mergePostStores(previous, run) : { ...run, rejections: [...previous.rejections, ...run.rejections] };
  writeFileSync(OUT, `${JSON.stringify({ $comment: COMMENT, ...store }, null, 2)}\n`);

  const ok = Object.values(run.posts);
  const attempts = [...ok, ...Object.values(run.failed)].flatMap((p) => p.attempts);
  console.log(`\nThis run: ${ok.length} posts, ${Object.keys(run.failed).length} failed or refused.`);
  console.log(`Attempts: ${attempts.length}, errors: ${attempts.filter((a) => a.status !== "200").length}.`);
  console.log(`Tokens: ${ok.reduce((n, p) => n + p.tokensIn, 0)} in, ${ok.reduce((n, p) => n + p.tokensOut, 0)} out.`);
  return 0;
}

main().then(
  (code) => (process.exitCode = code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
