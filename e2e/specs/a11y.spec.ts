import { test, expect } from "../fixtures.ts";
import AxeBuilder from "@axe-core/playwright";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { seedHistory, seedLastVisit } from "../helpers/storage.ts";
import { freezeDate } from "../helpers/clock.ts";

// Fail only on serious/critical violations — the launch-blocking bar. Lesser
// (moderate/minor) findings are surfaced by a full `axe` run but don't gate here.
async function seriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
}

test.describe("accessibility (axe — serious/critical)", () => {
  test("welcome screen has no serious/critical violations", async ({ page }) => {
    await page.goto("/welcome");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("game screen has no serious/critical violations", async ({ page }) => {
    await gotoPlayableGame(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("completion screen has no serious/critical violations", async ({ page }) => {
    await freezeDate(page, "2026-06-08T12:00:00Z");
    await seedHistory(page, [{ date: "2026-06-08", tries: 2 }]);
    await seedLastVisit(page, "2026-06-08");
    await page.goto("/solved");
    await expect(page.locator("[data-completion-heading]")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("archive page has no serious/critical violations", async ({ page }) => {
    await page.goto("/archive");
    await expect(page.locator("h1")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("keyboard: the skip-link is the first focusable control", async ({ page }) => {
    await page.goto("/welcome");
    await page.keyboard.press("Tab");
    await expect(page.locator("a.skip-link")).toBeFocused();
  });
});
