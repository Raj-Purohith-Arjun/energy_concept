import { test } from "@playwright/test";
for (const path of ["/facts/", "/black-giant/", "/"]) {
  test(`probe ${path}`, async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
    await page.addInitScript(() => {
      (window as unknown as { __lcp: unknown[] }).__lcp = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { element?: Element; size: number })[]) {
          (window as unknown as { __lcp: unknown[] }).__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? `${e.element.tagName}.${(e.element.className || "").toString().slice(0, 40)}` : "?" });
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(path, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const data = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
      return { lcp: (window as unknown as { __lcp: unknown[] }).__lcp, fcp: Math.round(fcp ?? -1), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) };
    });
    console.log(path, JSON.stringify(data), logs.length ? "\n  " + logs.join("\n  ") : "(no console errors)");
  });
}
