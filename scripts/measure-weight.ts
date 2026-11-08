// Page weight per route at a 390px phone viewport, against CLAUDE.md §6
// (first-load JS ≤ 150 KB compressed, any page ≤ 3 MB). Reports; never changes a
// budget and never fails the build. Run `pnpm build` first.
//
// PERF_PUBLIC=1 is passed inline to the spawned server only (the local
// measurement bypass in src/proxy.ts). It is not read from, or written to, any
// .env file, and must never be set in a deployed environment.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { chromium, type CDPSession } from "@playwright/test";

const ROUTES = ["/", "/black-giant/", "/facts/", "/findings/", "/evals/"];
const JS_BUDGET = 150 * 1024;
const PAGE_BUDGET = 3 * 1024 * 1024;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address === null || typeof address === "string") return reject(new Error("no port"));
      srv.close(() => resolve(address.port));
    });
  });
}

async function waitFor(url: string, server: ChildProcess): Promise<void> {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(`next start exited early (code ${server.exitCode})`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not answer at ${url}`);
}

function stop(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (server.exitCode !== null || server.pid === undefined) return resolve();
    server.once("exit", () => resolve());
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    else server.kill("SIGTERM");
  });
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

async function main() {
  const port = await freePort();
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    env: { ...process.env, PERF_PUBLIC: "1" },
    stdio: "ignore",
  });
  let exitCode = 0;
  try {
    await waitFor(`http://127.0.0.1:${port}/robots.txt`, server);
    const browser = await chromium.launch();
    try {
      const rows: { route: string; js: number; total: number }[] = [];
      for (const route of ROUTES) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
        const page = await context.newPage();
        const cdp: CDPSession = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        const types = new Map<string, string>();
        const bytes = new Map<string, number>();
        cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
        cdp.on("Network.loadingFinished", (e) => bytes.set(e.requestId, e.encodedDataLength));
        const response = await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "networkidle" });
        if (!response?.ok()) throw new Error(`${route} answered ${response?.status()}`);
        let js = 0;
        let total = 0;
        for (const [id, n] of bytes) {
          total += n;
          if (types.get(id) === "Script") js += n;
        }
        rows.push({ route, js, total });
        await context.close();
      }
      console.log("Route               JS (compressed)   Total transferred");
      for (const r of rows) console.log(`${r.route.padEnd(18)}  ${kb(r.js).padStart(14)}   ${kb(r.total).padStart(14)}`);
      const over = rows.flatMap((r) => [
        ...(r.js > JS_BUDGET ? [`${r.route}: JS ${kb(r.js)} exceeds the ${kb(JS_BUDGET)} budget`] : []),
        ...(r.total > PAGE_BUDGET ? [`${r.route}: page ${kb(r.total)} exceeds the ${kb(PAGE_BUDGET)} budget`] : []),
      ]);
      console.log(over.length === 0 ? "\nAll routes are inside both budgets (JS 150 KB, page 3 MB)." : `\nOVER BUDGET:\n${over.join("\n")}`);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    await stop(server);
  }
  process.exit(exitCode);
}

void main();
