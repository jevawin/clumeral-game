import { test, expect } from "../fixtures.ts";
import { WelcomePage } from "../pages/welcome.page.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { seedHistory, seedLastVisit } from "../helpers/storage.ts";

test.describe("welcome screen", () => {
  test("first visit shows the welcome screen with a Play CTA", async ({ page }) => {
    const welcome = new WelcomePage(page);
    await welcome.open();
    await expectActiveScreen(page, "welcome");
    await expect(welcome.playBtn).toBeVisible();
  });

  test("clicking Play navigates to the game screen", async ({ page }) => {
    const welcome = new WelcomePage(page);
    await welcome.open();
    await welcome.play();
    await expectActiveScreen(page, "game");
    await expect(page.locator("[data-clue-list]")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/play");
  });

  test("cold deep-link to /play with a stale last-visit redirects to /welcome", async ({ page }) => {
    // Stale-day rollover (router cold-load): a prior visit date older than today
    // forces /welcome so the player never sees a stale board. Seed history so the
    // resolver would otherwise allow /play — proving the rollover is what redirects.
    await seedHistory(page, [{ date: "2026-01-01", tries: 2 }]);
    await seedLastVisit(page, "2026-01-01");
    await page.goto("/play");
    await expectActiveScreen(page, "welcome");
    expect(new URL(page.url()).pathname).toBe("/welcome");
  });
});
