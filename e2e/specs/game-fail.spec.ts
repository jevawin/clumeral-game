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

  test("the submit button re-enables after a wrong guess (no stuck state)", async ({ page }) => {
    await gotoPlayableGame(page);
    const game = new GamePage(page);

    await submitWrongGuess(page);

    // Boxes stay resolved, so submit stays available and clickable for a retry.
    await expect(game.submit).toBeVisible();
    await expect(game.submit).toBeEnabled();
  });
});
