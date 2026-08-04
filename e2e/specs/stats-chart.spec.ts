import { test, expect } from "../fixtures.ts";

// The daily-plays chart against the built Worker and the local D1 seeded by
// `e2e:db` (tests/fixtures/analytics-seed.sql).
//
// These assert bar COUNTS rather than the empty state on purpose. An
// empty-state assertion passes whether the chart is correct, empty or completely
// broken, which is no gate at all — so the fixture is shaped to make each range
// produce a different, known number of marks:
//
//   7d   ->   7 marks, one of them a zero-day stub (the fixture leaves day -3 empty)
//   30d  ->  30 marks
//   90d  ->  90 marks
//   All  -> 101 marks (the earliest fixture row is exactly 100 days back)
//
// Locally the request host is `localhost`, and /stats is locked to the host it is
// called from — so the fixture's other-hostname row must never show up here.

const RANGES = [
  { period: "7", pill: "7d", bars: 7 },
  { period: "30", pill: "30d", bars: 30 },
  { period: "90", pill: "90d", bars: 90 },
  { period: "all", pill: "All", bars: 101 },
] as const;

test.describe("/stats daily plays chart", () => {
  for (const { period, pill, bars } of RANGES) {
    test(`renders ${bars} marks and the right active pill at ?period=${period}`, async ({ page }) => {
      await page.goto(`/stats?period=${period}`);

      await expect(page.locator("svg[role='img']")).toHaveCount(1);
      // One mark per day in the range: a bar where there were plays, a stub where
      // there were none. Both are needed — counting only bars would let a chart
      // that silently drops empty days pass.
      await expect(page.locator("svg path.bar, svg rect.zero")).toHaveCount(bars);

      const active = page.locator(".period-nav a.active");
      await expect(active).toHaveCount(1);
      await expect(active).toHaveText(pill);
    });
  }

  test("defaults to 30 days when no period is given", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.locator("svg path.bar, svg rect.zero")).toHaveCount(30);
    await expect(page.locator(".period-nav a.active")).toHaveText("30d");
  });

  test("falls back to 30 days for a period it does not offer", async ({ page }) => {
    for (const bad of ["60", "junk", "-1", "999", ""]) {
      await page.goto(`/stats?period=${bad}`);
      await expect(page.locator(".period-nav a.active")).toHaveText("30d");
    }
  });

  test("marks the fixture's empty day with a stub rather than dropping it", async ({ page }) => {
    await page.goto("/stats?period=7");
    // Day -3 has no rows; every other day in the window does.
    await expect(page.locator("svg rect.zero")).toHaveCount(1);
    await expect(page.locator("svg path.bar")).toHaveCount(6);
  });

  test("keeps the hidden table in step with the chart", async ({ page }) => {
    await page.goto("/stats?period=7");
    const fromChart = await page.locator("svg title").allTextContents();
    const fromTable = await page.locator("table.visually-hidden tr td:first-child").allTextContents();
    expect(fromTable).toEqual(fromChart.map((t) => t.split(": ")[0]));
  });

  test("counts a sampled row by its interval, not as one event", async ({ page }) => {
    await page.goto("/stats?period=7");
    // The fixture's day -4 holds a single row with sample_interval = 4.
    const titles = await page.locator("svg title").allTextContents();
    expect(titles.some((t) => t.endsWith(": 4 plays"))).toBe(true);
  });

  test("shows only this host's data", async ({ page }) => {
    await page.goto("/stats?period=all");
    await expect(page.locator(".domain-label")).toHaveText("localhost");
    // Ten distinct localhost uids in the fixture. The other-hostname row would
    // make it eleven.
    const unique = page.locator(".card").filter({ hasText: "Unique users" }).locator(".card__val");
    await expect(unique).toHaveText("10");
  });

  test("states the real span in the period label", async ({ page }) => {
    await page.goto("/stats?period=all");
    await expect(page.locator(".period-label")).toContainText("All time");
    await expect(page.locator(".period-label")).toContainText("101 days");
  });

  test("describes the chart for a screen reader", async ({ page }) => {
    await page.goto("/stats?period=7");
    const label = await page.locator("svg[role='img']").getAttribute("aria-label");
    expect(label).toMatch(/^Daily plays, .+ to .+\. Average [\d.]+ per day, highest \d+ on .+\.$/);
  });

  test("puts no part of the chart in the tab order", async ({ page }) => {
    await page.goto("/stats?period=all");
    await expect(page.locator("svg [tabindex]")).toHaveCount(0);
    await expect(page.locator("svg a, svg button")).toHaveCount(0);
  });
});
