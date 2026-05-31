import { test, expect, type Page } from "@playwright/test";

// E2E for issue #214 — first-play octopus walkthrough.
// Runs against the PRODUCTION build (vite preview); see playwright.config.ts.
//
// A "new user" = no `dlng_history` in localStorage. The walkthrough types a
// scripted tutorial into the /play header in place of the "Clumeral" wordmark,
// then restores it once the gated steps complete.

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
  // The wordmark leaves "Clumeral" and types the first tutorial sentence.
  await expect(brand(page)).not.toHaveText("Clumeral", { timeout: 10_000 });
  await expect(brand(page)).toContainText("first time", { timeout: 10_000 });
});

test("aria-live announces the full sentence per step", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  await expect(live(page)).toContainText("first time", { timeout: 10_000 });
});

test("gated step 2 holds until a digit box is opened", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  // Wait for the box-tap prompt (step 2).
  await expect(brand(page)).toContainText("digit boxes", { timeout: 20_000 });
  // It holds on this prompt — no auto-advance while waiting on the user.
  await page.waitForTimeout(1500);
  await expect(brand(page)).toContainText("digit boxes");
  // Open a box → advances to step 3.
  await page.locator('[data-digit="0"]').click();
  await expect(brand(page)).toContainText("disable digits", { timeout: 10_000 });
});

test("gated step 3 advances after a digit is eliminated, then restores the wordmark", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  await expect(brand(page)).toContainText("digit boxes", { timeout: 20_000 });
  await page.locator('[data-digit="0"]').click();
  await expect(brand(page)).toContainText("disable digits", { timeout: 10_000 });
  // Holds until a digit is eliminated.
  await page.waitForTimeout(1500);
  await expect(brand(page)).toContainText("disable digits");
  // Eliminate a digit via the keypad (key "1" is selectable in the hundreds box).
  await page.locator('[data-key="1"]').click();
  // Sequence ends → wordmark restored.
  await expect(brand(page)).toHaveText("Clumeral", { timeout: 10_000 });
});

test("returning player sees no walkthrough — wordmark from the start", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("dlng_history", JSON.stringify([{ n: 1, t: 3 }])),
  );
  await page.goto("/play");
  // Brand never leaves "Clumeral" for a returning player.
  await page.waitForTimeout(2000);
  await expect(brand(page)).toHaveText("Clumeral");
});

test("prefers-reduced-motion: text appears instantly and still advances", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.removeItem("dlng_history"));
  await page.goto("/welcome");
  await page.locator("[data-play-btn]").click();
  await expect(page.locator('[data-digit="0"]')).toBeVisible();
  // Full sentence present immediately (no per-char animation).
  await expect(brand(page)).toContainText("first time", { timeout: 5_000 });
  // Still reaches the gated box-tap prompt.
  await expect(brand(page)).toContainText("digit boxes", { timeout: 15_000 });
});
