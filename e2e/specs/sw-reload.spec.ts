import { test, expect } from "../fixtures.ts";

// Regression for the first-load self-reload race.
//
// The service worker posts SW_UPDATED from its `activate` handler on EVERY first
// activation (install → skipWaiting → claim → notify). The app must reload only
// on a GENUINE update — a page that already had a controller — not on this
// install-time notification. Before the fix, a brand-new visit reloaded itself
// the moment the SW claimed it: a spurious reload for real users, and one that
// destroyed the execution context mid-test on slower CI runners (axe / screen
// transition "navigation" failures in a11y.spec).
test.describe("service worker", () => {
  test("a first-ever load does not self-reload when the SW activates", async ({ page }) => {
    // framenavigated on the main frame fires for the initial load and for any
    // full reload, but NOT for SPA pushState/replaceState route changes — so the
    // count isolates real document navigations.
    let mainFrameNavigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) mainFrameNavigations++;
    });

    await page.goto("/welcome");

    // Wait until the SW has claimed this page (controller set) — the exact point
    // at which the install-time SW_UPDATED is delivered and the buggy reload fired.
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
      timeout: 15_000,
    });

    // Give any (buggy) reload time to land after the claim, then assert none did.
    await page.waitForTimeout(1_000);
    expect(mainFrameNavigations).toBe(1);
  });
});
