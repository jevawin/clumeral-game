import { test, expect, type Page } from "@playwright/test";

// E2E for issue #214 — first-play octopus walkthrough.
// Runs against the PRODUCTION build (vite preview); see playwright.config.ts.
//
// A "new user" = no `dlng_history` in localStorage. The walkthrough waits ~5s,
// then types a scripted tutorial into the /play header in place of the
// "Clumeral" wordmark, and restores it once the gated steps complete.
//
// Script anchors: intro = "first time"; first gated (box-opened) = "number box";
// after opening a box, timed steps lead to the second gated (digit-eliminated) =
// "remove it"; the final timed step = "submit"; then it restores to "Clumeral".
// While talking the header is pinned (position: sticky) and reverts on finish.

// SKIPPED — the walkthrough is disabled (#294). It broke the Undo/Reset keyboard
// shortcuts for first-time players: the shortcut handler stands down while the
// walkthrough is active, and this sequence holds that flag indefinitely on its
// gated steps. Five of the six tests below assert it runs, so they would fail
// against the disabled build.
//
// Skipped rather than deleted, deliberately: it is the executable description of
// what the current sequence does, and the replacement first-play tutorial is
// easier to design with it than without. It goes when the code goes, per #294.
//
// The skip is applied per-test rather than in a blanket beforeEach, because one
// case asserts the walkthrough is ABSENT and so still passes — skipping it would
// buy nothing. It is NOT the guard on the disable (see the note on it); that job
// belongs to the first-time-player case in specs/undo-reset.spec.ts.
const walkthroughDisabled = () =>
  test.skip(true, "First-play walkthrough disabled pending its replacement — see #294");

const brand = (p: Page) => p.locator("[data-brand-text]");
const live = (p: Page) => p.locator("[data-walkthrough-live]");
const headerPosition = (p: Page) =>
  p.locator("[data-app-header]").evaluate((el) => getComputedStyle(el).position);

// Drive a fresh (new-user) session to /play. dlng_history absent → walkthrough runs.
// The welcome screen's Play button ([data-play-btn]) navigates to /play (welcome.ts).
async function gotoPlayAsNewUser(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.removeItem("dlng_history"));
  await page.goto("/welcome");
  await page.locator("[data-play-btn]").click();
  await expect(page.locator('[data-digit="0"]')).toBeVisible();
}

test("walkthrough types into the header on a first visit", async ({ page }) => {
  walkthroughDisabled();
  await gotoPlayAsNewUser(page);
  // After the ~5s hold the wordmark leaves "Clumeral" and types the intro.
  await expect(brand(page)).not.toHaveText("Clumeral", { timeout: 12_000 });
  await expect(brand(page)).toContainText("first time", { timeout: 12_000 });
});

test("aria-live announces the full sentence per step", async ({ page }) => {
  walkthroughDisabled();
  await gotoPlayAsNewUser(page);
  await expect(live(page)).toContainText("first time", { timeout: 12_000 });
});

test("gated step holds until a digit box is opened", async ({ page }) => {
  walkthroughDisabled();
  test.setTimeout(60_000); // two timed intro steps precede the gated prompt
  await gotoPlayAsNewUser(page);
  // Intro steps auto-advance to the first gated prompt.
  await expect(brand(page)).toContainText("number box", { timeout: 30_000 });
  // It holds on this prompt — no auto-advance while waiting on the user.
  await page.waitForTimeout(1500);
  await expect(brand(page)).toContainText("number box");
  // Header is pinned (sticky) while the octopus is talking.
  expect(await headerPosition(page)).toBe("sticky");
  // The "Tap a number box" lead is rendered bold (a <strong> inside the brand).
  await expect(page.locator("[data-brand-text] strong")).toHaveText("Tap a number box");
  // Open a box → advances to the next (timed) step.
  await page.locator('[data-digit="0"]').click();
  await expect(brand(page)).toContainText("prime", { timeout: 12_000 });
});

test("gated step holds for elimination, then restores the wordmark at the end", async ({ page }) => {
  walkthroughDisabled();
  test.setTimeout(90_000); // full run-through: ~5s hold + 7 scripted steps
  await gotoPlayAsNewUser(page);
  await expect(brand(page)).toContainText("number box", { timeout: 30_000 });
  await page.locator('[data-digit="0"]').click();
  // Timed steps auto-advance to the second gated prompt.
  await expect(brand(page)).toContainText("remove it", { timeout: 25_000 });
  // Holds until a digit is eliminated.
  await page.waitForTimeout(1500);
  await expect(brand(page)).toContainText("remove it");
  // Eliminate a digit via the keypad (key "1" is selectable in the hundreds box).
  await page.locator('[data-key="1"]').click();
  // Advances to the final timed step, then ends → wordmark restored.
  await expect(brand(page)).toContainText("submit", { timeout: 12_000 });
  await expect(brand(page)).toHaveText("Clumeral", { timeout: 15_000 });
  // Header reverts to its static position once the walkthrough finishes.
  expect(await headerPosition(page)).not.toBe("sticky");
});

test("returning player sees no walkthrough — wordmark from the start", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("dlng_history", JSON.stringify([{ n: 1, t: 3 }])),
  );
  await page.goto("/play");
  // Brand never leaves "Clumeral" for a returning player (well past the 5s start delay).
  //
  // Left RUNNING while the rest of this file is skipped — it is the one case here
  // that still passes against the disabled build (#294), so skipping it would buy
  // nothing.
  //
  // It is NOT a guard on the disable: it seeds dlng_history, and the walkthrough
  // never ran for a player who has that, so re-enabling WALKTHROUGH_ENABLED leaves
  // it green. The actual guard is "the shortcuts work for a first-time player with
  // no history" in specs/undo-reset.spec.ts, which seeds nothing and would go red.
  await page.waitForTimeout(7000);
  await expect(brand(page)).toHaveText("Clumeral");
});

test("prefers-reduced-motion: text appears instantly and still advances", async ({ page }) => {
  walkthroughDisabled();
  test.setTimeout(60_000); // two timed intro steps precede the gated prompt
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.removeItem("dlng_history"));
  await page.goto("/welcome");
  await page.locator("[data-play-btn]").click();
  await expect(page.locator('[data-digit="0"]')).toBeVisible();
  // Intro text set instantly (no per-char animation), still auto-advances.
  await expect(brand(page)).toContainText("first time", { timeout: 12_000 });
  await expect(brand(page)).toContainText("number box", { timeout: 30_000 });
  // Opening a box still advances the machine under reduced motion.
  await page.locator('[data-digit="0"]').click();
  await expect(brand(page)).toContainText("prime", { timeout: 12_000 });
});
