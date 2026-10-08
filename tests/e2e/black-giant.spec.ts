import { expect, test, type Page, type Request } from "@playwright/test";

const PATH = "/black-giant/";
const isVideo = (r: Request) => r.resourceType() === "media" || /\.(?:mp4|webm|mov|m4v)(?:[?#]|$)/i.test(r.url());

function recordVideoRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on("request", (r) => {
    if (isVideo(r)) requests.push(r);
  });
  return requests;
}

/** Wall-clock time (ms since epoch) at which the page's load event started. */
function loadEventAt(page: Page): Promise<number> {
  return page.evaluate(() => {
    const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return performance.timeOrigin + nav.loadEventStart;
  });
}

const videoState = (page: Page) =>
  page.locator("video").evaluate((v: HTMLVideoElement) => ({ paused: v.paused, src: v.currentSrc }));

test.describe("deferred hero video", () => {
  test("no video file is requested before the load event, and it does load afterwards", async ({ page }) => {
    // Hold the poster back so `load` fires well after hydration, as it would on
    // a slow phone. Without this, hydration happens after `load` locally anyway
    // and an implementation that ignored `load` would still pass.
    await page.route("**/_next/image**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      await route.continue();
    });
    const requests = recordVideoRequests(page);
    await page.goto(PATH);
    const loadAt = await loadEventAt(page);

    // The deferred attach must actually happen, or this test would prove nothing.
    await expect.poll(() => requests.length, { timeout: 15_000 }).toBeGreaterThan(0);
    for (const request of requests) {
      // timing() is only populated once the response headers arrive. startTime
      // is the browser's own wall-clock start, not when the test saw the event.
      await request.response();
      const { startTime } = request.timing();
      expect(startTime, `${request.url()} has no timing`).toBeGreaterThan(0);
      expect(startTime, request.url()).toBeGreaterThan(loadAt);
    }
  });

  test("there is no <video> element in the server-rendered HTML", async ({ request }) => {
    const html = await (await request.get(PATH)).text();
    expect(html).not.toMatch(/<video\b/i);
    expect(html).toContain("black-giant-poster");
  });

  test("the poster image is the Largest Contentful Paint element", async ({ page }) => {
    await page.goto(PATH);
    // Let the video start playing first, so we also prove it doesn't take over LCP.
    await expect.poll(async () => (await videoState(page)).paused, { timeout: 15_000 }).toBe(false);
    const lcp = await page.evaluate(
      () =>
        new Promise<{ tag?: string; url: string }>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries() as (PerformanceEntry & { element?: Element; url: string })[];
            const last = entries[entries.length - 1];
            resolve({ tag: last.element?.tagName, url: last.url });
          }).observe({ type: "largest-contentful-paint", buffered: true });
        }),
    );
    expect(lcp.tag).toBe("IMG");
    expect(decodeURIComponent(lcp.url)).toContain("black-giant-poster");
  });

  test("the pause control pauses and resumes the video", async ({ page }) => {
    await page.goto(PATH);
    const pause = page.getByRole("button", { name: "Pause background video" });
    await expect(pause).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
    await pause.click();
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);
    await page.getByRole("button", { name: "Play background video" }).click();
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
  });

  test("the video pauses when scrolled off screen and resumes when back", async ({ page }) => {
    await page.goto(PATH);
    await expect.poll(async () => (await videoState(page)).paused, { timeout: 15_000 }).toBe(false);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
  });

  test("the placeholder footage is labelled on the page", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByText("Placeholder footage")).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("never requests the video", async ({ page }) => {
    const requests = recordVideoRequests(page);
    await page.goto(PATH);
    await page.waitForTimeout(3_000); // well past load + idle
    expect(requests.map((r) => r.url())).toEqual([]);
    await expect(page.locator("video")).toHaveCount(0);
  });
});

test.describe("Save-Data", () => {
  test("never requests the video", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "connection", {
        configurable: true,
        get: () => ({ saveData: true }),
      });
    });
    const requests = recordVideoRequests(page);
    await page.goto(PATH);
    await page.waitForTimeout(3_000);
    expect(requests.map((r) => r.url())).toEqual([]);
    await expect(page.locator("video")).toHaveCount(0);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page renders and a fact's source panel still opens", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole("heading", { level: 1, name: "Black Giant" })).toBeVisible();
    const panel = page.locator(".fact-panel").first();
    await expect(panel).toBeHidden();
    await page.getByRole("checkbox", { name: /Show source for Black Giant location/ }).check({ force: true });
    await expect(panel).toBeVisible();
    await expect(page.locator(".fl-footnote")).toBeVisible(); // planned capacity on this page
  });
});
