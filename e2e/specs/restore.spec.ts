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
