import { test, expect } from "../fixtures.ts";
import { expectActiveScreen } from "../helpers/screens.ts";

test.describe("/random", () => {
  test("solving a random puzzle lands on completion without error", async ({ page }) => {
    // Wait for the /api/puzzle/random response (the dev helper reads the token below).
    const tokenResp = page.waitForResponse((r) => r.url().includes("/api/puzzle/random"));
    await page.goto("/random");
    await tokenResp;
    // Fill the correct answer via the dev helper, which reads gameState.token and
    // fetches /api/dev/answer for the served random puzzle (race-free — no need to
    // read the response body, which Chromium evicts for sub-resource fetches).
    await page.waitForFunction(() => typeof window._devFillAnswer === "function");
    await page.evaluate(() => window._devFillAnswer());
    await expect(page.locator("[data-submit]")).toBeEnabled();
    await page.locator("[data-submit]").click();

    // The feedback line must NOT show the generic error.
    const feedback = page.locator("[data-feedback]");
    await expect(feedback).not.toHaveText(/something went wrong/i);
    // Completion screen is shown, heading reflects a solved random puzzle.
    await expectActiveScreen(page, "completion");
    await expect(page.locator("[data-completion-heading]")).toHaveText(/solved/i);
  });
});
