import { test, expect } from "../fixtures.ts";
import AxeBuilder from "@axe-core/playwright";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { seedHistory, seedLastVisit } from "../helpers/storage.ts";
import { freezeDate } from "../helpers/clock.ts";
import { waitForScreenSettled } from "../helpers/screens.ts";

// Fail only on serious/critical violations — the launch-blocking bar. Lesser
// (moderate/minor) findings are surfaced by a full `axe` run but don't gate here.
async function seriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
}

// axe rules check the DOM/ARIA/contrast, which don't vary by rendering engine, so
// run them on Chromium desktop + mobile (viewport coverage) rather than the whole
// matrix. The behavioral specs still cover all 5 engines. This also removes the
// flaky redundant axe runs that overload the single preview server.
const A11Y_PROJECTS = ["chromium-desktop", "mobile-chromium"];

// This axe pass is intentionally light-theme-only (see the QA regression design
// doc). Pin colorScheme so the gate is deterministic regardless of the runner's
// OS preference — GitHub's CI runner defaults to prefers-color-scheme: dark, which
// would otherwise run these checks against dark mode and trip a KNOWN, separately
// tracked dark-mode contrast bug (white-on-accent solid buttons, ~2.9:1): #243.
// Dark-mode a11y remains a tracked gap, not part of this light-theme gate.
test.use({ colorScheme: "light" });
test.describe("accessibility (axe — serious/critical)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !A11Y_PROJECTS.includes(testInfo.project.name),
      "axe DOM/contrast checks are engine-independent — run on Chromium desktop + mobile",
    );
    // axe injects + analyses a large script in-page; give it headroom under load.
    test.slow();
  });

  test("welcome screen has no serious/critical violations", async ({ page }) => {
    await page.goto("/welcome");
    await waitForScreenSettled(page, "welcome");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("game screen has no serious/critical violations", async ({ page }) => {
    await gotoPlayableGame(page);
    await waitForScreenSettled(page, "game");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("completion screen has no serious/critical violations", async ({ page }) => {
    await freezeDate(page, "2026-06-08T12:00:00Z");
    await seedHistory(page, [{ date: "2026-06-08", tries: 2 }]);
    await seedLastVisit(page, "2026-06-08");
    await page.goto("/solved");
    await waitForScreenSettled(page, "completion");
    await expect(page.locator("[data-completion-heading]")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("archive page has no serious/critical violations", async ({ page }) => {
    await page.goto("/archive");
    await expect(page.locator("h1")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("the skip-link is present and (where supported) the first focusable control", async ({
    page,
    browserName,
  }) => {
    await page.goto("/welcome");
    const skip = page.locator("a.skip-link");
    await expect(skip).toHaveAttribute("href", "#main");

    // WebKit on macOS doesn't move Tab focus to links/buttons unless "Full Keyboard
    // Access" is enabled, so the tab-order guarantee is only assertable on
    // Chromium/Firefox. The link's presence + target is checked cross-browser above.
    test.skip(browserName === "webkit", "WebKit doesn't Tab-focus links by default");
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
  });
});
