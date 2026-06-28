import { test, expect } from "../fixtures.ts";
import { WelcomePage } from "../pages/welcome.page.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { seedHistory } from "../helpers/storage.ts";
import { solvePuzzle } from "../helpers/solve.ts";

test.describe("routing", () => {
  test("history.scrollRestoration is set to 'manual' at boot", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => history.scrollRestoration)).toBe("manual");
  });

  test("back/forward popstate re-renders the correct screen", async ({ page }) => {
    // Seed a past entry so /play resolves to the game (hasData, no today entry) and
    // the first-play walkthrough stays off.
    await seedHistory(page, [{ date: "2026-01-01", tries: 2 }]);
    const welcome = new WelcomePage(page);

    await welcome.open();
    await expectActiveScreen(page, "welcome");

    await welcome.play();
    await expectActiveScreen(page, "game");
    expect(new URL(page.url()).pathname).toBe("/play");

    await page.goBack();
    await expectActiveScreen(page, "welcome");
    expect(new URL(page.url()).pathname).toBe("/welcome");

    await page.goForward();
    await expectActiveScreen(page, "game");
    expect(new URL(page.url()).pathname).toBe("/play");
  });

  test("back/forward after solving stays on completion (solved is terminal)", async ({ page }) => {
    // Past entry only: today is unsolved, so /play opens the live game and the
    // first-play walkthrough stays off.
    await seedHistory(page, [{ date: "2026-01-01", tries: 2 }]);
    const welcome = new WelcomePage(page);

    await welcome.open();
    await expectActiveScreen(page, "welcome");
    await welcome.play();
    await expectActiveScreen(page, "game");

    // Solve today's puzzle — the app replaceRoute()s /play → /solved.
    await solvePuzzle(page);
    await expectActiveScreen(page, "completion");
    expect(new URL(page.url()).pathname).toBe("/solved");

    // Once today is solved, every route resolves to completion (route-resolver
    // RTE-03). Back must NOT strand the player on a stale game board or welcome.
    await page.goBack();
    await expectActiveScreen(page, "completion");

    // Forward returns to the canonical /solved URL, still completion.
    await page.goForward();
    await expectActiveScreen(page, "completion");
    expect(new URL(page.url()).pathname).toBe("/solved");
  });

  // Deferred (fragile / lower value): the /archive SSR-handoff analytics beacon and
  // the visibility/focus stale-day rollover. Tracked for a later pass — see the QA
  // regression design spec. They depend on document-unload beacon timing and
  // tab-visibility emulation that are flaky across the browser matrix.
});
