import { test, expect } from "../fixtures.ts";
import { WelcomePage } from "../pages/welcome.page.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { seedHistory } from "../helpers/storage.ts";

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

  // Deferred (fragile / lower value): the /archive SSR-handoff analytics beacon and
  // the visibility/focus stale-day rollover. Tracked for a later pass — see the QA
  // regression design spec. They depend on document-unload beacon timing and
  // tab-visibility emulation that are flaky across the browser matrix.
});
