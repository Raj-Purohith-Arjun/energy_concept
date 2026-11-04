import { expect, test, type Page } from "@playwright/test";

const PATH = "/findings/";

const scriptSrcs = (page: Page) =>
  page.locator("script[src]").evaluateAll((els) => els.map((el) => new URL((el as HTMLScriptElement).src).pathname));

test("renders every section, with every table cell measured", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 1, name: "Findings" })).toBeVisible();
  for (const name of ["What that wait looks like", "Where the bytes go", "Before and after", "What these numbers do not show", "What the registry found", "First week on your codebase"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  // Verdict above all prose: three before/after pairs, each a registry fact.
  await expect(page.locator("#verdict ~ dl [data-fact]")).toHaveCount(6);
  // Bundle weight (added in 17ee5b6), caveats, registry findings and first week start collapsed.
  await expect(page.locator("details")).toHaveCount(4);
  await expect(page.locator("details[open]")).toHaveCount(0);
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(6); // header + five measures
  await expect(table.locator("[data-fact]")).toHaveCount(10); // every before and after cell is a registry fact
  await expect(table.getByText("Pending measurement")).toHaveCount(0);
  // No planned/estimate figures on this page, so no forward-looking footnote.
  await expect(page.locator(".fl-footnote")).toBeHidden();
});

test("the caveats link targets the caveats section", async ({ page }) => {
  await page.goto(PATH);
  await page.getByRole("link", { name: "Read the caveats" }).click();
  await expect(page).toHaveURL(/#caveats$/);
  await expect(page.locator("details:has(#caveats)")).toHaveAttribute("open", "");
  await expect(page.locator("#caveats")).toBeInViewport();
});

test("load timeline: end state by default, replays from blank on play", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(PATH);
  const main = page.locator(".lt-main").first();
  await expect(main).toHaveCSS("opacity", "1");
  await page.getByRole("checkbox", { name: "Play at real speed" }).check({ force: true });
  // Mid-replay, EnergyX's largest element has not painted yet.
  await expect(main).toHaveCSS("opacity", "0");
});

test("load timeline: reduced motion hides play and shows end states", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PATH);
  await expect(page.locator(".lt-play-label")).toBeHidden();
  await expect(page.locator(".lt-main").first()).toHaveCSS("opacity", "1");
  await expect(page.locator(".lt-main").first()).toHaveCSS("animation-name", "none");
});

// networkidle on both pages: the header prefetches "/" (and its next/form
// chunk) after load, so reading scripts before that raced the prefetch.
test("loads no client JS beyond what /facts already loads", async ({ page }) => {
  await page.goto("/facts/");
  await page.waitForLoadState("networkidle");
  const baseline = new Set(await scriptSrcs(page));
  await page.goto(PATH);
  await page.waitForLoadState("networkidle");
  const extra = (await scriptSrcs(page)).filter((src) => !baseline.has(src));
  expect(extra).toEqual([]);
});

test("stays inside the page-weight budget and has no horizontal scroll", async ({ page }) => {
  await page.goto(PATH);
  await page.waitForLoadState("load");
  const bytes = await page.evaluate(() =>
    (performance.getEntriesByType("navigation") as PerformanceResourceTiming[])
      .concat(performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .reduce((n, e) => n + e.transferSize, 0),
  );
  expect(bytes).toBeLessThan(3_000_000); // CLAUDE.md §5: any page ≤ 3 MB
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("renders, and a table figure's source panel opens", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole("heading", { level: 1, name: "Findings" })).toBeVisible();
    const cell = page.getByRole("table").locator("[data-fact='lh-bg-lcp']");
    await expect(cell.locator(".fact-panel")).toBeHidden();
    await cell.getByRole("checkbox").check({ force: true });
    await expect(cell.locator(".fact-panel")).toBeVisible();
  });
});
