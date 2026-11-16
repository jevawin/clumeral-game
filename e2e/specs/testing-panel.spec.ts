import { test, expect } from "../fixtures.ts";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { expectActiveScreen, waitForScreenSettled } from "../helpers/screens.ts";
import { seedHistory } from "../helpers/storage.ts";
import type { Page } from "@playwright/test";

// The preview-only Testing panel (time chart brief item 127). The suite runs on
// localhost, which the panel treats as a preview host; tests/testing-panel.spec.ts
// covers the clumeral.com refusal.

test.use({ serviceWorkers: "block" });
const PROJECTS = ["chromium-desktop", "mobile-chromium", "mobile-webkit"];
test.beforeEach(({}, info) => {
  test.skip(!PROJECTS.includes(info.project.name), "testing panel runs on chromium-desktop and the two mobile projects");
});

const today = () => new Date().toLocaleDateString("en-CA");

async function choose(page: Page, selector: string) {
  await page.locator("[data-testing-open]").click();
  await expect(page.locator("[data-testing-panel]")).toBeVisible();
  await page.locator(selector).click();
}

test("picks a leaderboard field and redraws the card", async ({ page }) => {
  await seedHistory(page, [{ date: today(), tries: 2, answer: 123, seconds: 90 }]);
  await page.goto("/solved");
  await waitForScreenSettled(page, "completion");
  await choose(page, '[data-testing-field="tie"]');
  await expect(page.locator(".time-chart__line")).toHaveText("You're the joint fastest today");
  await choose(page, '[data-testing-field="slowest"]');
  await expect(page.locator(".time-chart__line")).toHaveText("12 players solved today");
  // Kept for the tab, so a reload still shows it.
  await page.reload();
  await expect(page.locator(".time-chart__line")).toHaveText("12 players solved today");
  await choose(page, '[data-testing-field="fail"]');
  await expect(page.locator("[data-time-chart]")).toBeHidden();
});

test("solves the puzzle from the panel", async ({ page }) => {
  await gotoPlayableGame(page);
  await choose(page, '[data-testing-play="solve"]');
  await expectActiveScreen(page, "completion");
});

test("submits a wrong answer from the panel", async ({ page }) => {
  await gotoPlayableGame(page);
  await choose(page, '[data-testing-play="wrong"]');
  await expect(page.locator("[data-feedback]")).not.toBeEmpty();
  await expectActiveScreen(page, "game");
});

// Starts from nothing: seedHistory re-seeds on every navigation, which would
// overwrite what the panel writes.
test("swaps in a rich history", async ({ page }) => {
  await page.goto("/welcome");
  await waitForScreenSettled(page, "welcome");
  await choose(page, '[data-testing-history="rich"]');
  await expect(page).toHaveURL(/\/solved$/);
  await waitForScreenSettled(page, "completion");
  await expect(page.locator('[data-stat-block="streak"]')).toBeVisible();
});

// 45 days (src/testing-panel.ts MISSED_BACKS): seven skipped days, each an empty
// column (results brief 97), and a 12-day break as one marked column (brief 98).
// The play streak breaks three days back.
test("swaps in a history with missed days", async ({ page }) => {
  await page.goto("/welcome");
  await waitForScreenSettled(page, "welcome");
  await choose(page, '[data-testing-history="missed"]');
  await expect(page).toHaveURL(/\/solved$/);
  await waitForScreenSettled(page, "completion");
  await expect(page.locator("[data-strip-day]")).toHaveCount(26);
  await expect(page.locator("[data-strip-missed]")).toHaveCount(7);
  await expect(page.locator("[data-strip-break]")).toHaveText("12d");
  await expect(page.locator('[data-stat-block="streak"]')).toContainText("3-day play streak");
});

// The 20-day break sits next to today, so it is in view when the strip opens.
test("swaps in a history with a long break", async ({ page }) => {
  await page.goto("/welcome");
  await waitForScreenSettled(page, "welcome");
  await choose(page, '[data-testing-history="long-break"]');
  await waitForScreenSettled(page, "completion");
  const mark = page.locator("[data-strip-break]");
  await expect(mark).toHaveText("20d");
  // A broken column either side of the break, and neither touches the mark.
  const broken = page.locator("[data-strip-day][data-broken]");
  await expect(broken).toHaveCount(2);
  const m = (await mark.boundingBox())!;
  for (const k of [0, 1]) {
    const c = (await broken.nth(k).boundingBox())!;
    expect(c.x + c.width <= m.x || c.x >= m.x + m.width).toBe(true);
  }
  // The mark is on the bottom row: its foot is level with a column's bottom cell.
  const cell = (await page.locator("[data-strip-day] .goes-strip__cell").first().boundingBox())!;
  expect(Math.abs(m.y + m.height - (cell.y + cell.height))).toBeLessThanOrEqual(0.5);
  const s = await page.locator("[data-strip-scroller]").boundingBox();
  const b = await mark.boundingBox();
  expect(b!.x).toBeGreaterThanOrEqual(s!.x);
  expect(b!.x + b!.width).toBeLessThanOrEqual(s!.x + s!.width);
});
