import { test, expect } from "../fixtures.ts";
import { GamePage } from "../pages/game.page.ts";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { submitWrongGuess } from "../helpers/solve.ts";
import { expectActiveScreen } from "../helpers/screens.ts";

test.describe("game — wrong guess", () => {
  test("a wrong guess shows feedback and stays on the game screen", async ({ page }) => {
    await gotoPlayableGame(page);
    const game = new GamePage(page);

    await submitWrongGuess(page);

    // Feedback message appears (data-feedback un-hides) and we have NOT advanced
    // to completion — still on the game screen.
    await expect(game.feedback).toBeVisible();
    await expect(game.feedback).not.toHaveText("");
    await expectActiveScreen(page, "game");
  });

  test("after a wrong guess submit hides but is not stuck — a box re-engages to retry", async ({ page }) => {
    await gotoPlayableGame(page);
    const game = new GamePage(page);

    await submitWrongGuess(page);
    // Wait for the guess handler to finish (feedback paints in the same branch that
    // hides submit), so we assert settled state, not the in-flight race.
    await expect(game.feedback).toBeVisible();

    // Real behavior (app.ts: wrong branch hides submitWrap): submit is hidden after
    // a wrong guess; the player re-engages a box to try again.
    await expect(game.submit).toBeHidden();
    // But it is NOT stuck in the submitting state — the disabled flag is cleared.
    await expect(game.submit).toBeEnabled();

    // Re-opening a box reopens the keypad, so a retry is possible (no dead end).
    await game.openBox(0);
    await expect(game.keypad).toBeVisible();
  });
});
