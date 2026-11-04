import { expect, test, type Page } from "@playwright/test";

const PATH = "/evals/";

const scriptSrcs = (page: Page) =>
  page.locator("script[src]").evaluateAll((els) => els.map((el) => new URL((el as HTMLScriptElement).src).pathname));

test("verdict first, with the mutants-caught count; every section collapsed, post rejections first", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 1, name: "Guardrails, and how they're tested (evals)" })).toBeVisible();
  // The verdict is the only thing open above the fold, and it says so in numbers.
  await expect(page.locator("#eval-verdict")).toBeVisible();
  await expect(page.getByText("which on its own proves nothing")).toBeVisible();
  const verdict = page.locator("section[aria-labelledby='eval-verdict']");
  await expect(verdict.getByText(/switched-off guardrails caught/)).toBeVisible();
  await expect(verdict.locator("dd")).toHaveCount(4);
  // DOM order (the sections are collapsed, so they have no box to measure).
  const order = ["eval-verdict", "post-rejections", "rejections", "mutation", "try-it"];
  const positions = await page.evaluate(
    (ids) => ids.map((id) => Array.from(document.querySelectorAll("*")).indexOf(document.getElementById(id)!)),
    order,
  );
  expect(positions.every((n) => n >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // Three highlighted guardrails, every one of them caught.
  await expect(page.locator("[data-mutant]")).toHaveCount(3);
  await expect(page.getByText("Not caught")).toHaveCount(0);
  // The must-not-refuse point stays visible even with its list collapsed.
  await expect(page.getByText("most test suites don't have them")).toBeVisible();
  await expect(page.locator("details")).toHaveCount(11);
  await expect(page.locator("details[open]")).toHaveCount(0);
  await expect(page.locator("details").first().locator(":scope > summary")).toHaveText("See a whole post the model wrote that was refused");
});

test("try-it links open the live assistant with the question asked", async ({ page }) => {
  await page.goto(PATH);
  await page.locator("details:has(#try-it) > summary").first().click();
  const links = page.locator("section[aria-labelledby='try-it'] a");
  await expect(links).toHaveCount(3);
  await links.first().click();
  await expect(page).toHaveURL(/\/\?q=When%20is%20the%20IPO%3F$/);
  await expect(page.getByRole("heading", { name: "I can't discuss an IPO or a stock listing." })).toBeVisible();
});

test("every example question is a link to /?q=, and no counts or arrows render broken", async ({ page }) => {
  await page.goto(PATH);
  for (const summary of await page.locator("summary").all()) await summary.click();
  const hrefs = await page.locator("main").locator("td a, dd a, p a").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(100);
  for (const href of hrefs) expect(href).toMatch(/^\/\?q=/);
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\b1 (questions|tests|guardrails|cases)\b/);
  expect(text).not.toMatch(/→\s*\./);
});

test("the nav calls it Guardrails", async ({ page }) => {
  await page.goto(PATH);
  // At phone width the desktop nav is hidden and the menu closed, so check the markup.
  await expect(page.locator('header a[href="/evals/"]').first()).toHaveText("Guardrails");
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
  await page.locator("details:has(#rejections) > summary").first().click();
  const section = page.locator("section[aria-labelledby='rejections']");
  await expect(section.getByRole("heading", { level: 2, name: "When the model got it wrong" })).toBeVisible();
  await expect(section.locator("[data-rejection]")).not.toHaveCount(0);
  await expect(section.getByText("What readers see instead").first()).toBeVisible();
});
