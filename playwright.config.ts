import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

// Runs against the production build (`pnpm build` first). PERF_PUBLIC=1 is the
// local measurement bypass in src/proxy.ts, so tests don't need credentials.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  // Phone-first demo: emulate a mid-range Android phone.
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/robots.txt`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { PERF_PUBLIC: "1" },
  },
});
