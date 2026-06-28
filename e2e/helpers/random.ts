import type { Page } from "@playwright/test";
import { expect } from "../fixtures.ts";

/**
 * Load /random, solve it via the dev helper, and click submit — race-free.
 *
 * The race we avoid: `_devFillAnswer()` reads `gameState.token`, which
 * `startRandomPuzzle()` only sets inside the JS callback that runs AFTER the
 * `/api/puzzle/random` HTTP response arrives. Waiting on the response alone
 * (as the tests used to) lets the fill run before the puzzle is initialised,
 * so the digit boxes never resolve to size 1 and `[data-submit]` stays hidden
 * — reliably on webkit.
 *
 * The reliable readiness signal is the clue list: `renderClues()` (run inside
 * `startRandomPuzzle()`, after the token is set) removes `aria-busy` from
 * `[data-clue-list]`. Once that attribute is gone the token is guaranteed set.
 */
// /random fetches a fresh puzzle on every load; under full-matrix parallel load
// the resource-constrained webkit projects can be slow to initialise, so the
// readiness waits use a generous timeout (a real break still fails after it).
const READY_TIMEOUT = 15_000;

async function solveLoadedRandom(page: Page): Promise<void> {
  // Game is ready once clues have rendered (token is set by then).
  await expect(page.locator("[data-clue-list]")).not.toHaveAttribute(
    "aria-busy",
    "true",
    { timeout: READY_TIMEOUT },
  );
  await page.waitForFunction(() => typeof window._devFillAnswer === "function", null, {
    timeout: READY_TIMEOUT,
  });
  await page.evaluate(() => window._devFillAnswer());
  // Wait for VISIBLE (not just enabled) — checkSubmit() unhides the wrap only
  // when all three boxes are size 1.
  await expect(page.locator("[data-submit]")).toBeVisible({ timeout: READY_TIMEOUT });
  await page.locator("[data-submit]").click();
}

export async function solveRandom(page: Page): Promise<void> {
  await page.goto("/random");
  await solveLoadedRandom(page);
}

/**
 * From the random completion screen, click the sole `/random` entry link, then
 * solve the freshly loaded puzzle. The link is a real `<a href="/random">` and
 * /random boots without the router, so this is a full page navigation — wait for
 * the URL before driving the new game.
 */
export async function playAnotherRandom(page: Page): Promise<void> {
  await page
    .locator("[data-completion-links] [data-completion-random-again]")
    .click();
  await page.waitForURL(/\/random$/);
  await solveLoadedRandom(page);
}
