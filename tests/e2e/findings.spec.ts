import { expect, test, type Page } from "@playwright/test";

const PATH = "/findings/";

const scriptSrcs = (page: Page) =>
  page.locator("script[src]").evaluateAll((els) => els.map((el) => new URL((el as HTMLScriptElement).src).pathname));

test("renders every section, with every table cell measured", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 1, name: "Findings" })).toBeVisible();
  for (const name of ["Where the bytes go", "Before and after", "What these numbers do not show", "What the registry found", "First week on your codebase"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
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
  await expect(page.locator("#caveats")).toBeInViewport();
});

test("loads no client JS beyond what /facts already loads", async ({ page }) => {
  await page.goto("/facts/");
  const baseline = new Set(await scriptSrcs(page));
  await page.goto(PATH);
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
