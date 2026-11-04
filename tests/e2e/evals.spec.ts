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

test.describe("caught claim walkthrough", () => {
  const section = (page: Page) => page.locator("[data-caught-claim]");
  const running = (page: Page) => page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSAnimation && a.animationName !== "").length);
  const firstStepTime = (page: Page) =>
    page.locator(".cc-step").first().evaluate((el) => {
      const [a] = el.getAnimations();
      return { name: (a as CSSAnimation).animationName, time: Number(a.currentTime) };
    });

  test("is in its final state, with everything readable and nothing moving, until play", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(PATH);
    await expect(section(page).getByRole("heading", { level: 2 })).toContainText("so the post was stopped");
    await expect(section(page)).toContainText("describes");
    await expect(section(page).locator(".cc-word")).toHaveText("backing");
    await expect(section(page)).toContainText('don\'t call it "backing"');
    await expect(section(page)).toContainText("The check was added after this post was stored");
    // The back-navigation limitation is in view, not inside a fold.
    await expect(section(page).locator(".cc-note")).toBeVisible();
    await expect(section(page).locator(".cc-note")).toContainText("press back to this page after playing");
    await expect(section(page).locator(".cc-step")).toHaveCount(4);
    for (const step of await section(page).locator(".cc-step").all()) await expect(step).toHaveCSS("opacity", "1");
    expect(await running(page)).toBe(0);
    // Every figure comes from the registry; the planned one keeps its chip and the page its footnote.
    await expect(section(page).locator(".fact-value")).toHaveCount(3);
    await expect(section(page).locator("[data-forward-looking]")).toHaveCount(1);
    await expect(page.locator(".fl-footnote")).toBeVisible();
    // No source panel, and no link, in the walkthrough.
    await expect(section(page).locator(".fact-toggle, a")).toHaveCount(0);
  });

  test("one tap plays and one tap replays from the start, animating only opacity and transform", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(PATH);
    const button = section(page).locator(".lt-play-label").first();
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    const hit = async () => {
      const b = await button.boundingBox();
      await page.mouse.click(b!.x + b!.width / 2, b!.y + b!.height / 2);
    };
    await hit();
    await expect(section(page).locator(".cc-step").last()).toHaveCSS("opacity", "0");
    const properties = await page.evaluate(() =>
      document.getAnimations().flatMap((a) =>
        (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key))),
      ),
    );
    expect([...new Set(properties)].sort()).toEqual(["opacity", "transform"]);

    await page.locator(".cc-step").first().evaluate((el) => new Promise((done) => setTimeout(done, 1000, el)));
    const first = await firstStepTime(page);
    await hit();
    const second = await firstStepTime(page);
    expect(second.name).not.toBe(first.name);
    expect(second.time).toBeLessThan(first.time);
    // And again: the third tap goes back to the first radio and still restarts.
    await page.locator(".cc-step").first().evaluate((el) => new Promise((done) => setTimeout(done, 1000, el)));
    const before = await firstStepTime(page);
    await hit();
    const third = await firstStepTime(page);
    expect(third.name).toBe(first.name);
    expect(third.time).toBeLessThan(before.time);
  });

  test("a keyboard user can reach the control and replay it", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(PATH);
    const radios = section(page).getByRole("radio");
    await radios.first().focus();
    await page.keyboard.press("Space");
    await expect(radios.first()).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(section(page).getByRole("radio", { name: "Play the check again" })).toBeChecked();
    await expect(section(page).locator(".cc-step").last()).toHaveCSS("opacity", "0");
  });

  test("a reload does not restore a checked state and self-start", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(PATH);
    await section(page).getByRole("radio").first().check({ force: true });
    await page.reload();
    await expect(section(page).getByRole("radio").first()).not.toBeChecked();
    expect(await running(page)).toBe(0);
  });

  test("reduced motion shows the same final state, with no control and no motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH);
    await expect(section(page).locator(".lt-play-label").first()).toBeHidden();
    await expect(section(page).locator(".cc-note")).toBeHidden();
    await expect(section(page).locator(".cc-step")).toHaveCount(4);
    for (const step of await section(page).locator(".cc-step").all()) {
      await expect(step).toHaveCSS("opacity", "1");
      await expect(step).toHaveCSS("animation-name", "none");
    }
    await expect(section(page).locator(".cc-strike")).toHaveCSS("animation-name", "none");
    await expect(section(page).locator(".cc-word")).toHaveText("backing");
  });
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
