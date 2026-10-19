import { expect, test, type Page } from "@playwright/test";

const PATH = "/evals/";

const scriptSrcs = (page: Page) =>
  page.locator("script[src]").evaluateAll((els) => els.map((el) => new URL((el as HTMLScriptElement).src).pathname));

test("verdict first, mutation table, every section, long lists collapsed", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 1, name: "Evals" })).toBeVisible();
  await expect(page.getByText("which on its own proves nothing")).toBeVisible();
  for (const name of [
    "Mutation testing: switch a guardrail off, count what breaks",
    "What gets refused, and why",
    "Attempts to get around the refusals",
    "Questions it must not refuse",
    "If the model misbehaves",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  // Every mutant is caught: each row shows a count, none shows "Not caught".
  await expect(page.locator("[data-mutant]")).not.toHaveCount(0);
  await expect(page.getByText("Not caught")).toHaveCount(0);
  await expect(page.locator("details[open]")).toHaveCount(0);
  await expect(page.locator("details")).toHaveCount(5);
});

test("a collapsed list opens without JavaScript and shows pass results", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(PATH);
  const details = page.locator("details:has(#must-not-refuse-all)");
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  await expect(details.getByRole("cell", { name: "Pass", exact: true }).first()).toBeVisible();
  await expect(details.getByRole("cell", { name: "Fail", exact: true })).toHaveCount(0);
  await context.close();
});

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
  for (const summary of await page.locator("summary").all()) await summary.click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("an answer says which composer worded it, and makes no network call to a model", async ({ page }) => {
  const modelCalls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("generativelanguage.googleapis.com")) modelCalls.push(r.url());
  });
  await page.goto("/?q=How%20heavy%20is%20the%20Black%20Giant%20page%3F");
  await expect(page.locator("[data-worded-by]")).toHaveText(/^Worded by /);
  expect(modelCalls).toEqual([]);
});

test("the composer section states whether results match a template-only run", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 2, name: "Who writes the answers" })).toBeVisible();
  await expect(page.locator("[data-same-as-template]")).toHaveAttribute("data-same-as-template", "true");
});

test("real model rejections are shown with what shipped instead", async ({ page }) => {
  await page.goto(PATH);
  const section = page.locator("section[aria-labelledby='rejections']");
  await expect(section.getByRole("heading", { level: 2, name: "When the model got it wrong" })).toBeVisible();
  await expect(section.locator("[data-rejection]")).not.toHaveCount(0);
  await expect(section.getByText("What readers see instead").first()).toBeVisible();
});
