// pnpm lint:facts — CLAUDE.md §2.1. Exits 1 on any hardcoded business claim
// or unknown <Fact id>. Runs before `next build`, so violations fail the build.
// Also validates content/facts.json (via buildRegistry) and prints warnings
// for unverified facts and TODO(content) markers; those never fail the build.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import factsFile from "../content/facts.json";
import { buildRegistry } from "../src/lib/content";
import { formatViolation, registryReport, scanJson, scanMdx, scanTsx, type Violation } from "./lint-facts-core";

const ROOT = process.cwd();
const REGISTRY_FILE = path.join("content", "facts.json");

function walk(dir: string, accept: (file: string) => boolean): string[] {
  let entries;
  try {
    entries = readdirSync(path.join(ROOT, dir), { withFileTypes: true });
  } catch (error) {
    // A missing directory just means nothing to scan; anything else is real.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries.flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel, accept);
    return accept(rel) ? [rel] : [];
  });
}

function main(): number {
  const registry = buildRegistry(factsFile);
  const knownIds = new Set(registry.keys());

  const files = [
    ...walk("content", (f) => /\.(?:mdx|json)$/.test(f) && path.normalize(f) !== REGISTRY_FILE),
    ...walk("src", (f) => f.endsWith(".tsx")),
  ];

  const violations: Violation[] = files.flatMap((file) => {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    const display = file.split(path.sep).join("/");
    if (file.endsWith(".json")) return scanJson(display, source);
    if (file.endsWith(".mdx")) return scanMdx(display, source, knownIds);
    return scanTsx(display, source, knownIds);
  });

  const { warnings, intentionalNoUrl } = registryReport([...registry.values()]);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  if (intentionalNoUrl.length > 0) {
    // Information, not a warning: local measurements have no public page to cite.
    console.log(`note: ${intentionalNoUrl.length} local measurements intentionally have no public source URL.`);
  }

  for (const v of violations) console.error(formatViolation(v));
  if (violations.length > 0) {
    console.error(`\nlint:facts failed: ${violations.length} violation(s) in ${files.length} files.`);
    return 1;
  }
  console.log(
    `lint:facts passed: ${files.length} files, ${registry.size} facts, ${warnings.length} warning(s).`,
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
