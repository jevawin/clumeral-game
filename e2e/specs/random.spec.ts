import { test, expect } from "../fixtures.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { solveRandom, playAnotherRandom } from "../helpers/random.ts";

// Each /random test triggers a fresh `/api/puzzle/random` fetch (and the
// play-another test triggers two). The local miniflare preview Worker serialises
// these, so running the file's tests serially keeps the slower WebKit projects
// from starving under full-matrix load — without it they flake on contention.
test.describe.configure({ mode: "serial" });

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

  test("clicking 'play another random puzzle' loads and solves a second puzzle", async ({ page }) => {
    await solveRandom(page);
    await expectActiveScreen(page, "completion");

    // Following the entry link must reach a fresh, solvable random puzzle —
    // not bounce to welcome or throw the generic error (the regression class
    // that orphaned this link in the redesign).
    await playAnotherRandom(page);

    await expect(page.locator("[data-feedback]")).not.toHaveText(/something went wrong/i);
    await expectActiveScreen(page, "completion");
    await expect(page.locator("[data-completion-heading]")).toHaveText(/solved/i);
  });
});
