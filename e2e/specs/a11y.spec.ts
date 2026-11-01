import { test as rawTest } from "@playwright/test";
import { test, expect } from "../fixtures.ts";
import AxeBuilder from "@axe-core/playwright";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { seedHistory, seedLastVisit, seedTheme } from "../helpers/storage.ts";
import { freezeDate } from "../helpers/clock.ts";
import { expectActiveScreen, waitForScreenSettled } from "../helpers/screens.ts";
import { expectedModifier } from "../helpers/modifier.ts";
import { GamePage } from "../pages/game.page.ts";
import { MenuPage } from "../pages/menu.page.ts";
import { FeedbackPage } from "../pages/feedback.page.ts";

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

// This axe pass runs BOTH colour schemes. It was light-only while #243 was open
// (white-on-accent solid buttons, ~2.9:1 in dark) — solid-fill text is now the
// page bg (#255 removed the --color-on-accent token that first fixed it), so
// dark mode is a real gate rather than a known-red one. #255 also fixed the
// accent-on-surface failure #254 shipped: contrast now rides on a shared
// --accent-l, so every theme clears AA by construction.
// colorScheme is pinned per describe so each run is deterministic regardless
// of the runner's OS preference; GitHub's CI runner defaults to dark, which is
// how #243 surfaced in the first place.
for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility — ${scheme} (axe — serious/critical)`, () => {
    test.use({ colorScheme: scheme });

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

    // The burger menu ships `hidden` and the feedback modal is a closed <dialog>,
    // so axe skips both subtrees on every route above — they are invisible to the
    // screen-level scans. Two real dark-mode contrast failures hid there behind
    // exactly that blind spot (accent text on bg-surface is 4.03–4.13:1, below
    // AA), so open them and scan explicitly.
    test("open burger menu has no serious/critical violations", async ({ page }) => {
      await gotoPlayableGame(page);
      await waitForScreenSettled(page, "game");
      const menu = new MenuPage(page);
      await menu.open();
      await expect(menu.menu).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });

    test("open feedback modal has no serious/critical violations", async ({ page }) => {
      await gotoPlayableGame(page);
      await waitForScreenSettled(page, "game");
      const menu = new MenuPage(page);
      await menu.open();
      await menu.fbBtn.click();
      const feedback = new FeedbackPage(page);
      await expect(feedback.modal).toBeVisible();
      await expect(feedback.cats).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
}

// Every scan above runs on the default accent, Lime. The other three themes
// change --accent-h and --accent-c, and while the AA guarantee is structural —
// contrast rides on the shared --accent-l, asserted over the shipping numbers in
// tests/palette-contrast.spec.ts — that maths models flat accent-on-background.
// It does not model focus rings, tinted fills, or a border and its text in
// combination. So scan each theme for real (#255 DA review).
//
// The open menu is the surface worth spending the runs on: it is where accent
// text sits on --color-surface rather than --color-bg, which is the pairing #254
// shipped below AA, and it is the only screen showing all four swatches at once.
// Seeded via localStorage so the theme is applied at boot rather than by clicking.
for (const scheme of ["light", "dark"] as const) {
  for (const colour of ["Cherry", "Blueberry", "Grape"] as const) {
    test.describe(`accessibility — ${colour} ${scheme} (axe — serious/critical)`, () => {
      test.use({ colorScheme: scheme });

      test.beforeEach(({}, testInfo) => {
        test.skip(
          !A11Y_PROJECTS.includes(testInfo.project.name),
          "axe DOM/contrast checks are engine-independent — run on Chromium desktop + mobile",
        );
        test.slow();
      });

      test("game screen and open menu have no serious/critical violations", async ({ page }) => {
        await seedTheme(page, { colour });
        await gotoPlayableGame(page);
        await waitForScreenSettled(page, "game");

        // Confirm the seed actually took before trusting a green scan — a typo in
        // the theme name would silently fall back to Lime and scan it three times.
        await expect(page.locator("html")).toHaveAttribute("data-theme", colour);
        expect(await seriousViolations(page)).toEqual([]);

        const menu = new MenuPage(page);
        await menu.open();
        await expect(menu.menu).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
      });
    });
  }
}

// The shortcut hint is exposed as a DESCRIPTION, not part of the name: the
// button still leads with "Undo last change", and "Keyboard shortcut: Control Z"
// follows once, rather than bloating a name that is re-read on every
// aria-disabled change. The visible "Ctrl + Z" is hidden from the a11y tree so
// the words are spoken rather than a glyph soup.
test.describe("accessibility — board control shortcut hint", () => {
  test.use({ colorScheme: "light" });

  // All three desktop projects, not just Chromium: they all have a fine pointer
  // so they all render the hint, and name/description exposure is exactly the
  // thing most likely to differ between engines. Matches the hint test's own gate
  // in undo-reset.spec.ts. Mobile projects are excluded because the hint never
  // renders there without a keypress.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !testInfo.project.name.endsWith("-desktop"),
      "the hint only renders where a fine pointer is detected",
    );
  });

  test("each control exposes its name and its shortcut description", async ({ page }) => {
    await gotoPlayableGame(page);
    await waitForScreenSettled(page, "game");

    // Derived rather than hardcoded — the spoken form follows the platform too,
    // so "Control" alone would go red on any Mac.
    const mod = await expectedModifier(page);
    for (const [ctrl, name, spoken] of [
      ["[data-undo]", "Undo last change", `Keyboard shortcut: ${mod.spoken} Z`],
      ["[data-reset]", "Reset all boxes", `Keyboard shortcut: ${mod.spoken} X`],
    ] as const) {
      const button = page.locator(ctrl);
      await expect(button).toHaveAttribute("aria-label", name);
      const describedBy = await button.getAttribute("aria-describedby");
      expect(describedBy, `${ctrl} must carry a description`).toBeTruthy();
      await expect(page.locator(`#${describedBy}`)).toHaveText(spoken);
    }
  });

  test("the visible key text is hidden from the accessibility tree", async ({ page }) => {
    await gotoPlayableGame(page);
    await waitForScreenSettled(page, "game");

    await expect(page.locator("[data-undo-key]")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("[data-reset-key]")).toHaveAttribute("aria-hidden", "true");
  });
});

// The digit boxes paint all ten digits always and strike out the eliminated ones.
// Strikethrough is paint, not semantics, so a screen reader learned nothing from a
// box however much the player had narrowed it. The grid is now aria-hidden and the
// state is spoken instead — the count in the name, the digits in a description —
// which makes those two the ONLY place the board is exposed non-visually. Worth
// asserting directly rather than leaving it to the aggregate axe scan, which does
// not cover it either way.
//
// It does NOT clear axe 4.14's label-content-name-mismatch on these boxes, and
// nothing reasonable does: 4.14 compares the name against text VISIBLE ON SCREEN
// and ignores aria-hidden, so the only passing names are the literal painted digits
// ("Hundreds box 0123456789") or no button role at all. #345 holds that question,
// which is why the axe bump is not on this branch.
test.describe("accessibility — digit box names", () => {
  test.use({ colorScheme: "light" });

  const BOXES = [
    [0, "Hundreds box", 9, "1, 2, 3, 4, 5, 6, 7, 8, 9"],
    [1, "Tens box", 10, "0, 1, 2, 3, 4, 5, 6, 7, 8, 9"],
    [2, "Units box", 10, "0, 1, 2, 3, 4, 5, 6, 7, 8, 9"],
  ] as const;

  // Deliberately NOT gated to A11Y_PROJECTS like the axe scans above. Those check
  // DOM and contrast, which don't vary by engine; the accessible DESCRIPTION is a
  // computed accname value resolved through an IDREF, and that is exactly the kind
  // of thing WebKit and Gecko implement differently. Worth the five runs.
  test("each box hides its digits, counts what is left and describes it", async ({ page }) => {
    await gotoPlayableGame(page);
    await waitForScreenSettled(page, "game");
    const game = new GamePage(page);

    // Untouched board. The hundreds box has no 0 — the answer is 100-999.
    for (const [i, name, count, digits] of BOXES) {
      const box = game.digit(i);
      await expect(box).toHaveAttribute("aria-label", `${name}, ${count} remaining`);
      await expect(page.locator(`[data-digit="${i}"] .digit-box__grid`)).toHaveAttribute(
        "aria-hidden",
        "true",
      );

      // The computed description, not just the target's text, and the assertion
      // this suite most needs. The IDREF is the whole delivery mechanism — drop
      // aria-describedby or typo one id and every other assertion here still
      // passes while the fix is dead — and the targets are aria-hidden, so this is
      // also what proves an engine still honours a hidden node that
      // aria-describedby references directly. If one ever stops, this goes red
      // instead of the description silently disappearing.
      await expect(box).toHaveAccessibleDescription(digits);
      // The accessible name is asserted twice on purpose — once as the attribute
      // above, once as the computed name here, which is what a screen reader
      // actually says and which the description must not leak into.
      await expect(box).toHaveAccessibleName(`${name}, ${count} remaining`);
    }

    // Eliminate 0 and 1 from the tens box: the count and the description follow.
    await game.digit(1).click();
    await game.key(0).click();
    await game.key(1).click();
    await expect(game.digit(1)).toHaveAccessibleName("Tens box, 8 remaining");
    await expect(game.digit(1)).toHaveAccessibleDescription("2, 3, 4, 5, 6, 7, 8, 9");
  });

  // The one-digit branch paints a single big digit instead of the grid, and hides
  // it the same way. Nothing else covers that branch's aria-hidden: game-solve
  // asserts the span's text, which the attribute doesn't affect.
  test("a box narrowed to one digit hides it and says so", async ({ page }) => {
    await gotoPlayableGame(page);
    await waitForScreenSettled(page, "game");
    const game = new GamePage(page);

    await game.digit(1).click();
    for (const d of [0, 1, 2, 3, 4, 5, 6, 7, 8]) await game.key(d).click();

    await expect(game.digit(1)).toHaveAccessibleName("Tens box, 1 remaining");
    await expect(game.digit(1)).toHaveAccessibleDescription("9");
    await expect(page.locator('[data-digit="1"] span[aria-hidden="true"]')).toHaveText("9");
  });

  // The sort in renderBox is load-bearing and invisible to any test that only
  // eliminates: Set.add appends, so a digit toggled back on re-enters iteration
  // order at the END. Without the sort this reads "1, 2, … 9, 0" and drifts out of
  // step with the grid, which is always drawn 0-9.
  test("a digit toggled back on is described in its place, not last", async ({ page }) => {
    await gotoPlayableGame(page);
    await waitForScreenSettled(page, "game");
    const game = new GamePage(page);

    await game.digit(1).click();
    await game.key(0).click();
    await expect(game.digit(1)).toHaveAccessibleDescription("1, 2, 3, 4, 5, 6, 7, 8, 9");
    await game.key(0).click();
    await expect(game.digit(1)).toHaveAccessibleDescription("0, 1, 2, 3, 4, 5, 6, 7, 8, 9");
    await expect(game.digit(1)).toHaveAccessibleName("Tens box, 10 remaining");
  });

  // The regression guard for this fix's own first draft, which dropped the static
  // aria-label and composed the name purely at render time. renderBox runs after
  // the await in loadPuzzle, so until it does — and for good if the request fails —
  // the boxes are visible, tabbable role="button"s. Nameless, they read as "button,
  // collapsed" three times with nothing to tell hundreds from units.
  //
  // This also pins the two copies of each name to each other: index.html carries
  // the string twice, as the static label and as the base the composed one is built
  // from, and nothing else would catch them drifting apart.
  //
  // rawTest, not the suite's `test`: killing the request is the point of this one,
  // and the fixture's console guard fails on the "Failed to load resource" it
  // produces. The guard's ALLOW list is global and deliberately tight, so widening
  // it with /Failed to load resource/ for one test would blind the whole suite to
  // genuine fetch regressions. Scoping the exception to this test is the narrow
  // option, not the lazy one.
  //
  // No axe assertion here either: the failed-load screen has a pre-existing
  // critical violation of its own, unrelated to names — renderClues writes a <p>
  // into role="list", which requires listitem children (aria-required-children).
  // Confirmed identical on staging without this change. No test covers that screen
  // at all, which is why nothing had caught it.
  rawTest("the boxes are named before the puzzle arrives, and if it never does", async ({
    page,
  }, testInfo) => {
    rawTest.skip(
      testInfo.project.name !== "chromium-desktop",
      "route interception is unreliable on WebKit with an active service worker (see fixtures.ts)",
    );

    await seedHistory(page, [{ date: "2026-01-01", tries: 3, answer: 123 }]);
    await page.route("**/api/puzzle**", (route) => route.abort());
    await page.goto("/play");
    await expectActiveScreen(page, "game");

    for (const [i, name] of BOXES) {
      const box = page.locator(`[data-digit="${i}"]`);
      await expect(box).toHaveAttribute("aria-label", name);
      await expect(box).toHaveAttribute("data-box-name", name);
    }
  });
});

// Scheme-independent — focus order doesn't vary by colour, so run it once.
test.describe("accessibility — keyboard", () => {
  test.use({ colorScheme: "light" });

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
