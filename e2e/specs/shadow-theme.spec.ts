import { test, expect } from "../fixtures.ts";
import type { Page } from "@playwright/test";

// The active digit-box shadow is `color-mix(in srgb, var(--color-accent) 30%,
// transparent)`, so its RGB channels equal the *selected accent's* RGB — and the
// accent resolves to a different value per light/dark theme. Both variants must
// drive the shadow, so we assert the channels in each theme. The old bug used a
// hardcoded Lime shadow that ignored both the accent and the theme.
//
// The expected values are read back from --color-accent on the live page rather
// than hardcoded. Hardcoding meant every palette change silently invalidated
// this spec: it pinned the pre-#255 hexes and would have kept asserting them.
// What matters here is that the shadow tracks the accent, not what the accent
// currently is.

interface Rgb { r: number; g: number; b: number }

/** The page's current --color-accent, rasterised to sRGB. Needed because
 *  getComputedStyle returns oklch() verbatim, which is not comparable to the
 *  color(srgb ...) that color-mix serialises to. */
async function resolvedAccent(page: Page): Promise<Rgb> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-accent)";
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();

    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
  });
}

/** Select the Cherry accent on a live /random board, activate box 0, and read
 *  back the active-state shadow's RGB alongside the accent it should match. */
async function cherryActiveShadow(page: Page): Promise<{ shadow: Rgb; accent: Rgb }> {
  // /random loads the game screen with live digit boxes.
  await page.goto("/random");
  await expect(page.locator('[data-digit="0"]')).toBeVisible();

  // Pick the Cherry accent via the menu.
  await page.locator("[data-menu-btn]").click();
  await page.locator('[data-swatches] [data-colour="Cherry"]').click();
  await page.locator("[data-menu-btn]").click(); // close menu

  // Activate box 0 — this applies the active-state shadow.
  await page.locator('[data-digit="0"]').click();

  const boxShadow = await page
    .locator('[data-digit="0"]')
    .evaluate((el) => getComputedStyle(el).boxShadow);

  const srgb = boxShadow.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  expect(srgb, `expected an srgb color-mix shadow, got: ${boxShadow}`).not.toBeNull();
  const [r, g, b] = srgb!.slice(1, 4).map((c) => Math.round(parseFloat(c) * 255));

  return { shadow: { r, g, b }, accent: await resolvedAccent(page) };
}

/** Per-channel comparison with a tolerance — OKLCH to sRGB rounding differs by
 *  a step or so between engines, and this suite runs across five of them. */
function expectRgbClose(actual: Rgb, expected: Rgb, label: string): void {
  for (const ch of ["r", "g", "b"] as const) {
    expect(
      Math.abs(actual[ch] - expected[ch]),
      `${label} ${ch}: got ${actual[ch]}, expected ~${expected[ch]}`
    ).toBeLessThanOrEqual(2);
  }
}

test.describe("light mode", () => {
  test.use({ colorScheme: "light" });

  test("active digit-box shadow follows the light accent", async ({ page }) => {
    const { shadow, accent } = await cherryActiveShadow(page);
    expectRgbClose(shadow, accent, "light shadow vs accent");
  });
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("active digit-box shadow follows the dark accent", async ({ page }) => {
    const { shadow, accent } = await cherryActiveShadow(page);
    expectRgbClose(shadow, accent, "dark shadow vs accent");
  });
});

test.describe("the two modes differ", () => {
  // The point of the original bug: a hardcoded shadow looks correct in whichever
  // mode it was picked for. Asserting the two modes produce different values is
  // what actually catches that, and it holds whatever the palette becomes.
  test("light and dark resolve to different shadows", async ({ browser }) => {
    const light = await browser.newContext({ colorScheme: "light" });
    const dark = await browser.newContext({ colorScheme: "dark" });
    try {
      const a = await cherryActiveShadow(await light.newPage());
      const b = await cherryActiveShadow(await dark.newPage());
      expect(a.shadow).not.toEqual(b.shadow);
    } finally {
      await light.close();
      await dark.close();
    }
  });
});
