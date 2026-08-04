import { test, expect } from "../fixtures.ts";
import { expectActiveScreen } from "../helpers/screens.ts";

test.describe("SSR / shell routes", () => {
  // Was "200 or the documented 503". The 503 branch is gone: stats read D1, so
  // there are no API secrets left to be missing and 200 is the only right answer.
  test("/stats serves the dashboard", async ({ request }) => {
    const res = await request.get("/stats");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Clumeral Stats");
  });

  test("/puzzles/<date> redirects to /archive/<date>", async ({ page }) => {
    await page.goto("/puzzles/2026-03-10");
    expect(new URL(page.url()).pathname).toBe("/archive/2026-03-10");
    await expectActiveScreen(page, "game");
  });

  test("/puzzles/<num> redirects into the archive replay", async ({ page }) => {
    await page.goto("/puzzles/1");
    expect(new URL(page.url()).pathname).toMatch(/^\/archive\/\d{4}-\d{2}-\d{2}$/);
    await expectActiveScreen(page, "game");
  });

  test("/random serves the app shell and starts a random puzzle", async ({ page }) => {
    await page.goto("/random");
    await expectActiveScreen(page, "game");
    await expect(page.locator("[data-clue-list]")).toBeVisible();
  });
});
