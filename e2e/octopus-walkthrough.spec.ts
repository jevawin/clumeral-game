import { test, expect, type Page } from "@playwright/test";

// E2E for issue #214 — first-play octopus walkthrough.
// Runs against the PRODUCTION build (vite preview); see playwright.config.ts.
//
// A "new user" = no `dlng_history` in localStorage. The walkthrough waits ~5s,
// then types a scripted tutorial into the /play header in place of the
// "Clumeral" wordmark, and restores it once the gated steps complete.
//
// Script anchors: step 0 (gated, box-opened) = "number box"; after opening a box
// the timed steps lead to step 3 (gated, digit-eliminated) = "not prime"; the
// final timed step = "submit"; then the wordmark restores to "Clumeral".

const brand = (p: Page) => p.locator("[data-brand-text]");
const live = (p: Page) => p.locator("[data-walkthrough-live]");

// Drive a fresh (new-user) session to /play. dlng_history absent → walkthrough runs.
// The welcome screen's Play button ([data-play-btn]) navigates to /play (welcome.ts).
async function gotoPlayAsNewUser(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.removeItem("dlng_history"));
  await page.goto("/welcome");
  await page.locator("[data-play-btn]").click();
  await expect(page.locator('[data-digit="0"]')).toBeVisible();
}

test("walkthrough types into the header on a first visit", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  // After the ~5s hold the wordmark leaves "Clumeral" and types step 0.
  await expect(brand(page)).not.toHaveText("Clumeral", { timeout: 12_000 });
  await expect(brand(page)).toContainText("number box", { timeout: 12_000 });
});

test("aria-live announces the full sentence per step", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  await expect(live(page)).toContainText("number box", { timeout: 12_000 });
});

test("gated step holds until a digit box is opened", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  await expect(brand(page)).toContainText("number box", { timeout: 12_000 });
  // It holds on this prompt — no auto-advance while waiting on the user.
  await page.waitForTimeout(1500);
  await expect(brand(page)).toContainText("number box");
  // Open a box → advances to the next (timed) step.
  await page.locator('[data-digit="0"]').click();
  await expect(brand(page)).toContainText("based on the clues", { timeout: 12_000 });
});

test("gated step holds for elimination, then restores the wordmark at the end", async ({ page }) => {
  test.setTimeout(60_000); // full run-through: ~5s hold + 5 scripted steps
  await gotoPlayAsNewUser(page);
  await expect(brand(page)).toContainText("number box", { timeout: 12_000 });
  await page.locator('[data-digit="0"]').click();
  // Timed steps auto-advance to the second gated prompt.
  await expect(brand(page)).toContainText("not prime", { timeout: 25_000 });
  // Holds until a digit is eliminated.
  await page.waitForTimeout(1500);
  await expect(brand(page)).toContainText("not prime");
  // Eliminate a digit via the keypad (key "1" is selectable in the hundreds box).
  await page.locator('[data-key="1"]').click();
  // Advances to the final timed step, then ends → wordmark restored.
  await expect(brand(page)).toContainText("submit", { timeout: 12_000 });
  await expect(brand(page)).toHaveText("Clumeral", { timeout: 15_000 });
});

test("returning player sees no walkthrough — wordmark from the start", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("dlng_history", JSON.stringify([{ n: 1, t: 3 }])),
  );
  await page.goto("/play");
  // Brand never leaves "Clumeral" for a returning player (well past the 5s start delay).
  await page.waitForTimeout(7000);
  await expect(brand(page)).toHaveText("Clumeral");
});

test("prefers-reduced-motion: text appears instantly and still advances", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.removeItem("dlng_history"));
  await page.goto("/welcome");
  await page.locator("[data-play-btn]").click();
  await expect(page.locator('[data-digit="0"]')).toBeVisible();
  // First gated prompt present (set instantly, no per-char animation).
  await expect(brand(page)).toContainText("number box", { timeout: 12_000 });
  // Opening a box still advances the machine under reduced motion.
  await page.locator('[data-digit="0"]').click();
  await expect(brand(page)).toContainText("based on the clues", { timeout: 12_000 });
});
