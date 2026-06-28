import { test, expect } from "../fixtures.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { solveRandom } from "../helpers/random.ts";

test.describe("/random", () => {
  test("solving a random puzzle lands on completion without error", async ({ page }) => {
    await solveRandom(page);

    // The feedback line must NOT show the generic error.
    const feedback = page.locator("[data-feedback]");
    await expect(feedback).not.toHaveText(/something went wrong/i);
    // Completion screen is shown, heading reflects a solved random puzzle.
    await expectActiveScreen(page, "completion");
    await expect(page.locator("[data-completion-heading]")).toHaveText(/solved/i);
  });

  test("random completion shows the 'play another random puzzle' entry link", async ({ page }) => {
    await solveRandom(page);

    await expectActiveScreen(page, "completion");
    // The only entry link to /random lives here on the random completion screen.
    const again = page.locator("[data-completion-links] [data-completion-random-again]");
    await expect(again).toBeVisible();
    await expect(again).toHaveAttribute("href", "/random");
  });
});
