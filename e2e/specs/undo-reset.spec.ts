import { test, expect } from "../fixtures.ts";
import type { Locator } from "@playwright/test";
import { GamePage } from "../pages/game.page.ts";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { solvePuzzle } from "../helpers/solve.ts";
import { expectActiveScreen } from "../helpers/screens.ts";

// Undo / Reset controls above the digit boxes (#251). One acceptance criterion
// per test, driven through the real keypad rather than by poking state.

// The controls use aria-disabled rather than the native disabled attribute, so
// they stay focusable and pressing a just-disabled one can't throw focus away
// (#251). Assert the attribute directly rather than relying on toBeDisabled()
// inferring it — the distinction is the point.
async function expectUnavailable(button: Locator): Promise<void> {
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).toBeEnabled();   // never NATIVELY disabled
}

async function expectAvailable(button: Locator): Promise<void> {
  await expect(button).not.toHaveAttribute("aria-disabled", "true");
}

// Eliminate `digits` from box 1, which starts {0..9}.
//
// Only opens the box if it isn't already open: selectBox() TOGGLES, so clicking
// an already-active box closes the keypad instead of opening it.
async function eliminate(game: GamePage, digits: number[]): Promise<void> {
  if ((await game.digit(1).getAttribute("aria-expanded")) !== "true") {
    await game.openBox(1);
  }
  await expect(game.page.locator("[data-keypad] [data-key]").first()).toBeVisible();
  for (const d of digits) await game.tapKey(d);
}

test.describe("undo and reset controls", () => {
  test("both controls appear above the digit boxes", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    await expect(game.undo).toBeVisible();
    await expect(game.reset).toBeVisible();

    // Above the boxes, not below: compare rendered positions rather than DOM order,
    // so a CSS change that visually reorders them is caught too.
    const controls = await game.boardControls.boundingBox();
    const boxes = await game.digit(0).boundingBox();
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(boxes!.y);
  });

  test("both are disabled on a fresh board", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    await expectUnavailable(game.undo);
    await expectUnavailable(game.reset);
  });

  test("both enable after an elimination", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await expectAvailable(game.undo);
    await expectAvailable(game.reset);
  });

  test("undo reverts the most recent elimination, one press at a time", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5, 6]);

    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 5)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 6)).toHaveClass(/elim/);

    // One press restores 6 only — not the whole box interaction.
    await game.undo.click();
    await expect(game.boxDigit(1, 6)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 5)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);

    // Repeated presses walk further back.
    await game.undo.click();
    await expect(game.boxDigit(1, 5)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);

    await game.undo.click();
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
  });

  test("undo disables again once the stack runs out", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [7]);

    await game.undo.click();
    await expectUnavailable(game.undo);
    await expectUnavailable(game.reset);
  });

  test("reset restores every box to its full starting set", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    // Eliminate across all three boxes so the reset has to clear more than one.
    await game.openBox(0);
    await game.tapKey(3);
    await eliminate(game, [4]);
    await game.openBox(2);
    await game.tapKey(8);

    await expect(game.boxDigit(0, 3)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expect(game.boxDigit(2, 8)).toHaveClass(/elim/);

    await game.reset.click();

    await expect(game.boxDigit(0, 3)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(2, 8)).not.toHaveClass(/elim/);
    // The hundreds 0 is permanently struck (no leading zero) — reset must not
    // "restore" it into play.
    await expect(game.boxDigit(0, 0)).toHaveClass(/elim/);
  });

  test("after a reset, Reset disables but Undo stays live and relabels", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5]);
    await expect(game.undo).toHaveText("Undo");

    await game.reset.click();

    // The board is the starting board, so there is nothing left to reset...
    await expectUnavailable(game.reset);
    // ...but the reset itself is still undoable, and the button says so.
    await expectAvailable(game.undo);
    await expect(game.undo).toHaveText("Undo reset");
    await expect(game.undo).toHaveAttribute("aria-label", "Undo reset");
    // A relabelled button is silent to a screen reader unless it happens to be
    // focused, so the reset is announced separately.
    await expect(game.undoMsg).toHaveText(/Board reset/);
  });

  test("undoing a reset restores the whole pre-reset board in one press", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5, 6]);

    await game.reset.click();
    await game.undo.click();

    // All three come back together — not one press per elimination.
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 5)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 6)).toHaveClass(/elim/);
    await expect(game.undo).toHaveText("Undo");
  });

  test("the Undo label reverts to plain Undo on the next elimination", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await game.reset.click();
    await expect(game.undo).toHaveText("Undo reset");

    await eliminate(game, [9]);
    await expect(game.undo).toHaveText("Undo");
  });

  // The label follows the top of the stack, not a one-shot flag, so stepping
  // back down onto the reset entry has to bring "Undo reset" back.
  test("the Undo label returns to Undo reset when the stack steps back onto it", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await game.reset.click();
    await expect(game.undo).toHaveText("Undo reset");

    // Toggle after the reset — label goes back to plain Undo...
    await eliminate(game, [9]);
    await expect(game.undo).toHaveText("Undo");

    // ...and undoing that toggle lands back on the reset entry.
    await game.undo.click();
    await expect(game.undo).toHaveText("Undo reset");

    // One more press unwinds the reset itself, restoring the original board.
    await game.undo.click();
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expectUnavailable(game.undo);
  });

  test("the last remaining candidate in a box still cannot be eliminated", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    // Whittle box 1 down to a single digit, then try to remove it.
    await eliminate(game, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(game.digit(1)).toContainText("9");

    await game.tapKey(9);
    await expect(game.digit(1)).toContainText("9");

    // The blocked tap must not have pushed a no-op onto the stack: the next undo
    // has to restore 8, not appear to do nothing.
    await game.undo.click();
    await expect(game.boxDigit(1, 8)).not.toHaveClass(/elim/);
  });

  test("a solved puzzle cannot be unwound back into play", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await solvePuzzle(page);

    // Solving the daily puzzle lands on the completion screen.
    await expectActiveScreen(page, "completion");

    // Back to the board via the completion screen's Show-puzzle link. A plain
    // goto("/play") would NOT work: once today is solved, RTE-03 resolves /play
    // straight back to /solved, so the assertions below would never run.
    await page.locator("[data-completion-show-puzzle]").click();
    await expectActiveScreen(page, "game");
    await expect(game.feedback).toContainText(/Solved in/i);
    await expect(game.boardControls).toBeHidden();
  });

  test("the undo stack survives a reload along with the board", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5]);

    await page.reload();
    await expectActiveScreen(page, "game");

    // Board restored from dlng_active...
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 5)).toHaveClass(/elim/);

    // ...and the stack from sessionStorage, so Undo still steps back.
    await expectAvailable(game.undo);
    await game.undo.click();
    await expect(game.boxDigit(1, 5)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
  });

  // The whole point of persisting the stack: this sequence used to lose the
  // eliminations for good.
  test("a reset can still be undone after a reload", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5, 6]);

    await game.reset.click();
    await page.reload();
    await expectActiveScreen(page, "game");

    // The button still knows the next step back is a reset.
    await expectAvailable(game.undo);
    await expect(game.undo).toHaveText("Undo reset");

    await game.undo.click();
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 5)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 6)).toHaveClass(/elim/);
  });

  test("controls are keyboard operable", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await game.undo.focus();
    await expect(game.undo).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expectUnavailable(game.undo);

    // The press emptied the stack, so Undo is now unavailable — but focus must
    // stay put. An earlier build natively disabled it, which blurred it and
    // dumped focus onto the first digit box (reported by Dave, 2026-07-31).
    await expect(game.undo).toBeFocused();
  });

  // Regression: pressing a control that has nothing to do must be inert. It must
  // not move focus, and it must not touch the board.
  test("pressing an unavailable control does nothing at all", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    // Open a box so there is a selected box to disturb, then confirm both
    // controls are unavailable on the untouched board.
    await game.openBox(1);
    await expectUnavailable(game.undo);
    await expectUnavailable(game.reset);

    const digitsBefore = await game.digit(1).innerHTML();

    await game.undo.click();
    await game.reset.click();

    // Focus stays on whatever the player pressed — not thrown to a digit box.
    await expect(game.digit(0)).not.toBeFocused();
    await expect(game.digit(1)).not.toBeFocused();
    await expect(game.digit(2)).not.toBeFocused();

    // Board untouched, box still open, controls still unavailable.
    expect(await game.digit(1).innerHTML()).toBe(digitsBefore);
    await expect(game.digit(1)).toHaveAttribute("aria-expanded", "true");
    await expectUnavailable(game.undo);
    await expectUnavailable(game.reset);
  });

  test("controls carry accessible names", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    await expect(game.undo).toHaveAttribute("aria-label", /undo/i);
    await expect(game.reset).toHaveAttribute("aria-label", /reset/i);
  });

  test("Reset sits to the right of Undo", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    const undo = await game.undo.boundingBox();
    const reset = await game.reset.boundingBox();
    const row = await game.boardControls.boundingBox();

    // Anchored to the ends of the row, not merely in DOM order — a plain
    // "reset.x > undo.x" would still pass with the two buttons sitting side by
    // side on the left, which is the layout this replaced.
    expect(undo!.x).toBeCloseTo(row!.x, 0);
    expect(reset!.x + reset!.width).toBeCloseTo(row!.x + row!.width, 0);
  });
});
