import { test, expect } from "../fixtures.ts";
import { seedHistory } from "../helpers/storage.ts";
import { expectActiveScreen } from "../helpers/screens.ts";

// Reloading mid-game must restore the in-progress board (D-06): saveActive() runs
// on every digit change, and boot calls loadActive() to rebuild possibles. This is
// the probe for the "phone refresh restarts the puzzle" report — if same-day
// restore ever breaks, this fails. (The iOS overnight / storage-eviction case is a
// platform behaviour tracked separately, not reproducible here.)
test.describe("mid-game restore", () => {
  test("reloading keeps eliminated digits (in-progress board survives a refresh)", async ({ page }) => {
    // Past entry only → hasData, today unsolved (live game), first-play walkthrough off.
    await seedHistory(page, [{ date: "2026-01-01", tries: 2 }]);

    await page.goto("/play");
    await expectActiveScreen(page, "game");
    const box = page.locator('[data-digit="1"]');
    await expect(box).toBeVisible();

    // Eliminate 2, 3, 4 from box 1 via the real keypad — each click persists state.
    await box.click();
    await expect(page.locator("[data-keypad] [data-key]").first()).toBeVisible();
    for (const d of [2, 3, 4]) {
      await page.locator(`[data-key="${d}"]`).click();
    }

    const spans = page.locator('[data-digit="1"] .digit-box__grid span');
    // Eliminated digits carry the `elim` class; survivors don't. Assert the full
    // before-state so it matches the post-reload check exactly.
    await expect(spans.nth(2)).toHaveClass(/elim/);
    await expect(spans.nth(3)).toHaveClass(/elim/);
    await expect(spans.nth(4)).toHaveClass(/elim/);
    await expect(spans.nth(5)).not.toHaveClass(/elim/);

    // The actual refresh.
    await page.reload();

    // Board must come back to the game screen with the same eliminations intact —
    // not reset to a fresh puzzle or bounce to welcome.
    await expectActiveScreen(page, "game");
    const restored = page.locator('[data-digit="1"] .digit-box__grid span');
    await expect(restored.nth(2)).toHaveClass(/elim/);
    await expect(restored.nth(3)).toHaveClass(/elim/);
    await expect(restored.nth(4)).toHaveClass(/elim/);
    await expect(restored.nth(5)).not.toHaveClass(/elim/);
  });
});

// #284 — the same refresh, by a player who has never finished a puzzle. The test
// above seeds history, which is exactly why it stayed green while this was broken:
// the router's deep-link gate read dlng_history alone, so a first-timer's reload
// failed it and landed on /welcome with their board still in dlng_active.
//
// No seeding here on purpose. That means the first-play walkthrough is live, but
// it only types into the header and never blocks the board, so it can't affect
// these assertions.
test.describe("mid-game restore — first-time player (#284)", () => {
  test("reloading after eliminating a digit resumes the board, not welcome", async ({ page }) => {
    await page.goto("/welcome");
    await page.locator("[data-play-btn]").click();
    await expectActiveScreen(page, "game");

    const box = page.locator('[data-digit="1"]');
    await box.click();
    await expect(page.locator("[data-keypad] [data-key]").first()).toBeVisible();
    await page.locator('[data-key="4"]').click();
    await expect(page.locator('[data-digit="1"] .digit-box__grid span').nth(4)).toHaveClass(/elim/);

    await page.reload();

    await expectActiveScreen(page, "game");
    expect(new URL(page.url()).pathname).toBe("/play");
    await expect(page.locator('[data-digit="1"] .digit-box__grid span').nth(4)).toHaveClass(/elim/);
  });

  test("reloading before touching anything still resumes the board", async ({ page }) => {
    // Pressing Play is the commitment — a refresh a second later must not throw the
    // player back to the landing screen just because they hadn't tapped a digit yet.
    await page.goto("/welcome");
    await page.locator("[data-play-btn]").click();
    await expectActiveScreen(page, "game");
    // Wait for the puzzle fetch, not just the static markup: the digit boxes are in
    // index.html from the start, but the marker can only be written once today's
    // puzzle has loaded. renderClues drops aria-busy, so this is the real signal.
    await expect(page.locator("[data-clue-list]")).not.toHaveAttribute("aria-busy", "true");

    await page.reload();

    await expectActiveScreen(page, "game");
    expect(new URL(page.url()).pathname).toBe("/play");
  });

  test("a stranger deep-linking /play still lands on welcome", async ({ page }) => {
    // The gate this fix widened. Someone who was sent a /play link has neither
    // history nor a board of their own, and must not be dropped into the game.
    // Twice: the first visit must not leave anything behind that lets the second in.
    await page.goto("/play");
    await expectActiveScreen(page, "welcome");
    expect(new URL(page.url()).pathname).toBe("/welcome");

    await page.goto("/play");
    await expectActiveScreen(page, "welcome");
    expect(new URL(page.url()).pathname).toBe("/welcome");
  });
});
