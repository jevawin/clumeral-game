import { test, expect } from "../fixtures.ts";
import type { Locator } from "@playwright/test";
import { GamePage } from "../pages/game.page.ts";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { solvePuzzle, readAnswer, setBoxes } from "../helpers/solve.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { expectedModifier } from "../helpers/modifier.ts";
import { MenuPage } from "../pages/menu.page.ts";
import { FeedbackPage } from "../pages/feedback.page.ts";

// Undo / Reset controls above the digit boxes (#251). One acceptance criterion
// per test, driven through the real keypad rather than by poking state.

// The controls use aria-disabled rather than the native disabled attribute, so
// they stay focusable and pressing a just-unavailable one can't throw focus away
// (#251).
//
// Note Playwright resolves toBeEnabled/toBeDisabled through aria-disabled for
// button roles, so toBeEnabled() would FAIL here even though the element is not
// natively disabled. The native flag has to be read off the DOM directly.
async function expectUnavailable(button: Locator): Promise<void> {
  await expect(button).toHaveAttribute("aria-disabled", "true");
  expect(
    await button.evaluate((el) => (el as HTMLButtonElement).disabled),
    "must be aria-disabled, never natively disabled — native disabled steals focus",
  ).toBe(false);
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
    await expect(game.undoLabel).toHaveText("Undo");

    await game.reset.click();

    // The board is the starting board, so there is nothing left to reset...
    await expectUnavailable(game.reset);
    // ...but the reset itself is still undoable, and the button says so.
    await expectAvailable(game.undo);
    await expect(game.undoLabel).toHaveText("Undo reset");
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
    await expect(game.undoLabel).toHaveText("Undo");
  });

  test("the Undo label reverts to plain Undo on the next elimination", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await game.reset.click();
    await expect(game.undoLabel).toHaveText("Undo reset");

    await eliminate(game, [9]);
    await expect(game.undoLabel).toHaveText("Undo");
  });

  // The label follows the top of the stack, not a one-shot flag, so stepping
  // back down onto the reset entry has to bring "Undo reset" back.
  test("the Undo label returns to Undo reset when the stack steps back onto it", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await game.reset.click();
    await expect(game.undoLabel).toHaveText("Undo reset");

    // Toggle after the reset — label goes back to plain Undo...
    await eliminate(game, [9]);
    await expect(game.undoLabel).toHaveText("Undo");

    // ...and undoing that toggle lands back on the reset entry.
    await game.undo.click();
    await expect(game.undoLabel).toHaveText("Undo reset");

    // One more press unwinds the reset itself, restoring the pre-reset board.
    await game.undo.click();
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);

    // Still one entry left — the snapshot taken before 4 was eliminated — so the
    // label drops back to plain "Undo" and the control stays live.
    await expect(game.undoLabel).toHaveText("Undo");
    await expectAvailable(game.undo);

    // That last press empties the stack and returns the untouched board.
    await game.undo.click();
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expectUnavailable(game.undo);
    await expectUnavailable(game.reset);
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
    await expect(game.undoLabel).toHaveText("Undo reset");

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

    // force: Playwright's actionability check treats aria-disabled as disabled
    // and would otherwise wait forever. Pressing it anyway is the whole point —
    // a real user's tap is not gated on Playwright's opinion.
    await game.undo.focus();
    await game.undo.click({ force: true });

    // Focus stays exactly where the player put it, not thrown to a digit box.
    await expect(game.undo).toBeFocused();

    await game.reset.click({ force: true });

    await expect(game.digit(0)).not.toBeFocused();
    await expect(game.digit(1)).not.toBeFocused();
    await expect(game.digit(2)).not.toBeFocused();

    // Board untouched, box still open, controls still unavailable.
    expect(await game.digit(1).innerHTML()).toBe(digitsBefore);
    await expect(game.digit(1)).toHaveAttribute("aria-expanded", "true");
    await expectUnavailable(game.undo);
    await expectUnavailable(game.reset);
  });

  // Also from Dave's report: the digits inside a box were selectable text, so a
  // stray double-tap or long-press put a selection highlight on a single
  // character. The How To Play box had user-select:none; the game boxes, built
  // from utilities rather than the .digit-box class, had missed it.
  test("digits in the boxes cannot be text-selected", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    // Check the behaviour on the digit SPAN, not its computed style. `user-select`
    // is NOT an inherited property: `auto` on a child resolves to the parent's
    // *used* value, so a span inside a `none` box reports "auto" in Firefox while
    // being perfectly unselectable. Chromium reports the used value instead, and
    // WebKit exposes only `-webkit-user-select`, so `.userSelect` is undefined
    // there. Reading computed style off the span asserted an engine quirk, not the
    // fix — it passed on Chromium and failed on the other three. Double-clicking
    // and finding no selection is the symptom Dave actually reported.
    for (const box of [0, 1, 2]) {
      await game.page.locator(`[data-digit="${box}"] .digit-box__grid span`).first().dblclick();
      const selected = await game.page.evaluate(() => window.getSelection()?.toString() ?? "");
      expect(selected, `digits in box ${box} must not be selectable`).toBe("");
    }

    // The style assertion still has a place — on the elements that carry the rule,
    // where the computed value is the declared one. `webkitUserSelect` is the
    // fallback for WebKit, which doesn't surface the unprefixed property at all.
    const declaredSelect = (el: Element) => {
      const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitUserSelect?: string };
      return cs.userSelect ?? cs.webkitUserSelect ?? cs.getPropertyValue("-webkit-user-select");
    };
    for (const box of [0, 1, 2]) {
      const boxSelect = await game.page.locator(`[data-digit="${box}"]`).evaluate(declaredSelect);
      expect(boxSelect, `box ${box} must declare user-select: none`).toBe("none");
    }

    // And the keypad keys, which had the same gap.
    await game.openBox(1);
    const keySelect = await game.key(5).evaluate(declaredSelect);
    expect(keySelect, "keypad keys must not be selectable").toBe("none");
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

// ─── Keyboard shortcuts ──────────────────────────────────────────────────────

// Every case below presses Control, never Meta. CI runs on Linux, where Meta is
// not the platform modifier and Meta+X does not cut — a harness that depended on
// the Mac modifier would be testing the runner, not the app. The matcher accepts
// either modifier on either platform, which is what makes Control sufficient.
test.describe("undo and reset keyboard shortcuts", () => {
  test("Ctrl+Z steps back over an elimination", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5]);

    await page.keyboard.press("Control+z");

    await expect(game.boxDigit(1, 5)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
  });

  test("Ctrl+X clears the board and Ctrl+Z brings the whole thing back", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5, 6]);

    await page.keyboard.press("Control+x");

    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 5)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 6)).not.toHaveClass(/elim/);
    await expect(game.undoLabel).toHaveText("Undo reset");

    // One press, not three — the reset is a single entry on the stack.
    await page.keyboard.press("Control+z");

    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 5)).toHaveClass(/elim/);
    await expect(game.boxDigit(1, 6)).toHaveClass(/elim/);
  });

  test("pressing Ctrl+Z past the bottom of the stack unwinds and then stops", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5, 6]);

    // Five presses for three entries — the two extra must be inert, not errors.
    // The console guard in fixtures.ts fails the test on any pageerror.
    for (let i = 0; i < 5; i++) await page.keyboard.press("Control+z");

    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 5)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 6)).not.toHaveClass(/elim/);
    await expectUnavailable(game.undo);
    await expectUnavailable(game.reset);
  });

  test("neither shortcut does anything on a solved board", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    const answer = await solvePuzzle(page);

    await expectActiveScreen(page, "completion");
    await page.locator("[data-completion-show-puzzle]").click();
    await expectActiveScreen(page, "game");

    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+x");

    // The revealed answer is still in the boxes and the controls are still gone.
    await expect(game.boardControls).toBeHidden();
    for (let box = 0; box < 3; box++) {
      await expect(game.digit(box)).toContainText(String(answer[box]));
    }
  });

  // Ctrl+Shift+Z is Redo. We have no redo, so it has to do nothing at all
  // rather than quietly perform an undo.
  test("Ctrl+Shift+Z does nothing", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await page.keyboard.press("Control+Shift+z");

    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expectAvailable(game.undo);
  });

  // Regression: the shortcut branch sits ahead of every other binding in the
  // same keydown handler, so all of them have to still work.
  test("the existing key bindings still work with the shortcut branch ahead of them", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    // Digits still toggle.
    await game.openBox(1);
    await expect(page.locator("[data-keypad] [data-key]").first()).toBeVisible();
    await page.keyboard.press("4");
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);

    // Arrows still move between boxes.
    await page.keyboard.press("ArrowRight");
    await expect(game.digit(2)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(game.digit(1)).toHaveAttribute("aria-expanded", "true");

    // Tab still moves between boxes.
    await page.keyboard.press("Tab");
    await expect(game.digit(2)).toHaveAttribute("aria-expanded", "true");

    // Escape still closes the keypad.
    await page.keyboard.press("Escape");
    await expect(game.keypad).toBeHidden();
  });

  // Item 59: a shortcut never moves focus. A board change rebuilds every keypad
  // key, so without care a player focused on one is dumped to <body> — the same
  // class of bug as the natively-disabled Undo that started #251.
  test("a shortcut keeps focus on the keypad key it was pressed from", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5]);

    await game.key(7).focus();
    await expect(game.key(7)).toBeFocused();

    await page.keyboard.press("Control+z");
    await expect(game.boxDigit(1, 5)).not.toHaveClass(/elim/);
    await expect(game.key(7)).toBeFocused();

    await page.keyboard.press("Control+x");
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expect(game.key(7)).toBeFocused();
  });

  // The other half of item 59, and the easier one to get wrong: if nothing had
  // focus, the shortcut must not GIVE it any. That is the normal state for a
  // mouse user — macOS Safari and Firefox don't focus a button on click — so a
  // naive "focus is on <body>, therefore it was lost" recovery hands every mouse
  // player an unrequested focus ring, and pre-empts the pending announcement.
  test("a shortcut gives no focus when the player had none", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5]);

    // Drop focus without putting it anywhere: blur whatever the clicks left.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName ?? null))
      .toBe("BODY");

    await page.keyboard.press("Control+z");
    await expect(game.boxDigit(1, 5)).not.toHaveClass(/elim/);

    await expect(game.undo).not.toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.tagName ?? null)).toBe("BODY");
  });

  test("Enter still submits a resolved board", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    const digits = await readAnswer(page);
    await setBoxes(page, digits);

    await page.keyboard.press("Enter");
    await expectActiveScreen(page, "completion");
  });
});

// ─── Shortcut announcements ──────────────────────────────────────────────────

// Whether these strings are WRITTEN is what a spec can assert. Whether they are
// SPOKEN is a manual screen-reader check and no substitute for one.
test.describe("keyboard shortcut announcements", () => {
  test("undoing a toggle announces Undone", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await page.keyboard.press("Control+z");
    await expect(game.undoMsg).toHaveText("Undone.");
  });

  test("undoing a reset announces Undo reset", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await page.keyboard.press("Control+x");
    await page.keyboard.press("Control+z");
    await expect(game.undoMsg).toHaveText("Undo reset.");
  });

  // A dead press has to say so. Silence is indistinguishable from a broken key.
  test("undo on an untouched board announces that there is nothing to undo", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    await page.keyboard.press("Control+z");
    await expect(game.undoMsg).toHaveText("Nothing to undo.");
  });

  test("reset on an untouched board announces that the board is already clear", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);

    await page.keyboard.press("Control+x");
    await expect(game.undoMsg).toHaveText("Board is already clear.");
  });

  // Unchanged wording — the reset announcement is shared with the button path.
  test("reset on a touched board keeps its existing announcement", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    await page.keyboard.press("Control+x");
    await expect(game.undoMsg).toHaveText("Board reset. Undo reset available.");
  });
});

// ─── Shortcut exclusions ─────────────────────────────────────────────────────

test.describe("keyboard shortcut exclusions", () => {
  // A shortcut that eats Cut inside a textarea is a bug, not a feature.
  test("Ctrl+X cuts inside the feedback textarea and leaves the board alone", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    const menu = new MenuPage(page);
    await menu.open();
    await menu.fbBtn.click();
    const feedback = new FeedbackPage(page);
    await expect(feedback.modal).toBeVisible();

    await feedback.msg.fill("cut me");
    await feedback.msg.selectText();
    await page.keyboard.press("Control+x");

    await expect(feedback.msg).toHaveValue("");
    // The board is untouched: 4 is still eliminated and nothing was reset.
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
  });

  test("neither shortcut reaches the board while the menu is open", async ({ page }) => {
    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4]);

    const menu = new MenuPage(page);
    await menu.open();
    await expect(menu.menu).toBeVisible();

    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+x");

    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await expectAvailable(game.undo);
  });

  // Regression: the shortcuts were completely dead for a first-time player
  // (reported by Jamie, macOS Firefox, 2026-08-02). The handler returns early
  // while isWalkthroughActive() is true, and the walkthrough set that flag on
  // entering the game screen and held it indefinitely on its gated steps — so a
  // player with no history had no shortcuts at all, in any focus state. The
  // walkthrough is now disabled (#294); this is the test that would have caught
  // it, and that will catch its replacement making the same mistake.
  test("the shortcuts work for a first-time player with no history", async ({ page }) => {
    const game = new GamePage(page);
    // NOT gotoPlayableGame — that seeds history, which is exactly what hid this.
    // Reach the board the way a first-time player does.
    await page.goto("/welcome");
    await page.locator("[data-play-btn]").click();
    await expectActiveScreen(page, "game");

    await game.openBox(1);
    await expect(page.locator("[data-keypad] [data-key]").first()).toBeVisible();
    await game.tapKey(4);
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);

    await page.keyboard.press("Control+z");
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);

    // And reset, which was equally dead.
    await game.tapKey(4);
    await expect(game.boxDigit(1, 4)).toHaveClass(/elim/);
    await page.keyboard.press("Control+x");
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
  });
});

// ─── Analytics ───────────────────────────────────────────────────────────────

// The whole reason the worker allowlist was touched is to compare keyboard use
// against button use. track() posts and swallows every failure, so a wrong
// source string, a dropped call or a mis-ordered argument records nothing while
// the dashboard shows a confident zero. Nothing else in the suite would notice.
//
// Intercepting at the network layer means workerd is never reached, so this
// cannot go red because a local writeDataPoint has no binding — the ambiguity
// that kept the plan from asserting on a real POST. sw.js returns early for
// /api/ without calling respondWith, so the service worker is not in the path.
test.describe("undo and reset analytics", () => {
  test("both routes report their own source, and dead presses report nothing", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "route interception is unreliable on WebKit with an active service worker (see fixtures.ts)",
    );

    const events: { event: string; source?: string }[] = [];
    await page.route("**/api/event", async (route) => {
      const body = route.request().postDataJSON() as { event: string; source?: string };
      // Projected to the two fields under test, NOT pushed whole: every payload
      // also carries uid and newUser, which would defeat the exact toEqual
      // matches below.
      events.push({ event: body.event, source: body.source });
      await route.fulfill({ status: 202, body: "" });
    });
    const boardEvents = () => events.filter((e) => e.event === "undo_used" || e.event === "reset_used");

    const game = new GamePage(page);
    await gotoPlayableGame(page);

    // Button undo. Interception is asserted separately from the payload so that
    // a route that never attached reads as "the harness missed it", not as "the
    // app sent nothing" — fixtures.ts records that page.route can be unreliable
    // with a service worker active, which is why this case is Chromium-only.
    await eliminate(game, [4]);
    await game.undo.click();
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expect
      .poll(() => events.length, { message: "page.route never intercepted /api/event" })
      .toBeGreaterThan(0);
    await expect.poll(boardEvents).toEqual([{ event: "undo_used", source: "button" }]);

    // Keyboard undo.
    await eliminate(game, [4]);
    await page.keyboard.press("Control+z");
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expect.poll(boardEvents).toHaveLength(2);
    expect(boardEvents()[1]).toEqual({ event: "undo_used", source: "keyboard" });

    // Button reset.
    await eliminate(game, [5]);
    await game.reset.click();
    await expect.poll(boardEvents).toHaveLength(3);
    expect(boardEvents()[2]).toEqual({ event: "reset_used", source: "button" });

    // Keyboard reset.
    await eliminate(game, [6]);
    await page.keyboard.press("Control+x");
    await expect.poll(boardEvents).toHaveLength(4);
    expect(boardEvents()[3]).toEqual({ event: "reset_used", source: "keyboard" });

    // A press that changes nothing must send nothing — otherwise the counts
    // measure frustration rather than use.
    //
    // Unwind to the bottom of the stack first. Driven by the control's own state
    // rather than a hardcoded press count: the resets above each left an extra
    // entry behind them, and an off-by-one here would silently turn the check
    // below into "some presses were dead", which is not the claim.
    for (let i = 0; i < 20 && (await game.undo.getAttribute("aria-disabled")) !== "true"; i++) {
      await page.keyboard.press("Control+z");
    }
    await expectUnavailable(game.undo);
    await expectUnavailable(game.reset);

    const beforeDeadPresses = boardEvents().length;
    await page.keyboard.press("Control+z");   // empty stack
    await page.keyboard.press("Control+x");   // already the starting board
    await game.undo.click({ force: true });
    await game.reset.click({ force: true });

    // The announcement proves the presses actually reached the handler, so the
    // unchanged count below is "did nothing", not "never fired".
    await expect(game.undoMsg).toHaveText("Board is already clear.");
    expect(boardEvents(), "dead presses must not be logged").toHaveLength(beforeDeadPresses);
  });

  // Items 69 and 93: auto-repeat unwinds the board but must not announce or log
  // per step — a one-second hold would otherwise write to a polite live region at
  // the OS repeat rate and post thirty identical rows. Playwright's keyboard API
  // always sends repeat: false, so the repeat has to be synthesised.
  test("a held key unwinds the board without announcing or logging per step", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "route interception is unreliable on WebKit with an active service worker (see fixtures.ts)",
    );

    const events: { event: string; source?: string }[] = [];
    await page.route("**/api/event", async (route) => {
      const body = route.request().postDataJSON() as { event: string; source?: string };
      events.push({ event: body.event, source: body.source });
      await route.fulfill({ status: 202, body: "" });
    });
    const undoEvents = () => events.filter((e) => e.event === "undo_used");

    const game = new GamePage(page);
    await gotoPlayableGame(page);
    await eliminate(game, [4, 5, 6]);

    // One real press, then two repeats — the shape of a held key.
    await page.keyboard.press("Control+z");
    await expect(game.boxDigit(1, 6)).not.toHaveClass(/elim/);
    await expect.poll(undoEvents).toHaveLength(1);
    await expect(game.undoMsg).toHaveText("Undone.");

    await page.evaluate(() => {
      for (let i = 0; i < 2; i++) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "z", ctrlKey: true, repeat: true, bubbles: true }),
        );
      }
    });

    // The action still happens on every repeat — that is what makes holding the
    // key feel like a native undo.
    await expect(game.boxDigit(1, 5)).not.toHaveClass(/elim/);
    await expect(game.boxDigit(1, 4)).not.toHaveClass(/elim/);
    await expectUnavailable(game.undo);

    // But the announcement and the analytics stay at one apiece.
    await expect(game.undoMsg).toHaveText("Undone.");
    expect(undoEvents(), "a repeat must not log its own event").toHaveLength(1);
  });
});

// ─── The shortcut hint ───────────────────────────────────────────────────────

// Each case names the projects it applies to. This file runs on all five, and an
// ungated hint assertion would fail on the four it doesn't describe.
test.describe("keyboard shortcut hint", () => {
  test("desktop shows the hint on load, before any keypress", async ({ page }, testInfo) => {
    test.skip(
      !testInfo.project.name.endsWith("-desktop"),
      "the pointer-based reveal only applies to desktop projects",
    );

    const game = new GamePage(page);
    await gotoPlayableGame(page);

    // Derived, not hardcoded: the hint follows the platform, so "Ctrl" would only
    // ever be asserting that the runner is not a Mac.
    const mod = await expectedModifier(page);
    await expect(game.undoKey).toHaveText(`${mod.visible} + Z`);
    await expect(game.resetKey).toHaveText(`${mod.visible} + X`);
    await expect(game.undoKey).toBeVisible();
  });

  test("touch-only shows no hint until a key is pressed", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "the touch case needs a project with no fine pointer",
    );

    const game = new GamePage(page);
    await gotoPlayableGame(page);

    // Empty and collapsed — a touch player's layout is untouched.
    await expect(game.undoKey).toHaveText("");
    await expect(page.locator("html")).not.toHaveAttribute("data-keyboard", "true");

    // One keypress outside a text field is enough: this is the tablet-with-a-
    // keyboard case, and Tab or a digit is what a keyboard player presses first.
    await page.keyboard.press("Tab");

    await expect(page.locator("html")).toHaveAttribute("data-keyboard", "true");
    const mod = await expectedModifier(page);
    await expect(game.undoKey).toHaveText(`${mod.visible} + Z`);
  });

  // Regression: an on-screen keyboard is not a keyboard. Typing feedback on an
  // iPhone used to reveal a hint for shortcuts that phone can never send
  // (reported by Jamie, 2026-08-02). iOS cannot raise its keyboard without a
  // focused text field, so ignoring keydowns from one is what closes it.
  test("typing into the feedback box does not reveal the hint", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-webkit",
      "the false positive is an on-screen-keyboard case — assert it on the iPhone project",
    );

    const game = new GamePage(page);
    await gotoPlayableGame(page);

    const menu = new MenuPage(page);
    await menu.open();
    await menu.fbBtn.click();
    const feedback = new FeedbackPage(page);
    await expect(feedback.modal).toBeVisible();

    await feedback.msg.click();
    await feedback.msg.pressSequentially("mashing the keys");

    await expect(page.locator("html")).not.toHaveAttribute("data-keyboard", "true");
    await expect(game.undoKey).toHaveText("");

    // ...and the detection still works afterwards. The listener has to survive
    // the typing rather than being spent by it.
    await feedback.close.click();
    await expect(feedback.modal).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(page.locator("html")).toHaveAttribute("data-keyboard", "true");
  });
});
