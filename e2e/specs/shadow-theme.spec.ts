import { test, expect } from "../fixtures.ts";
import type { Page } from "@playwright/test";

// The active digit-box shadow is `color-mix(in srgb, var(--color-accent) 30%,
// transparent)`, so its RGB channels equal the *selected accent's* RGB — and the
// accent resolves to a different value per light/dark theme (colours.ts picks the
// light or dark variant via isDark()). Both variants must drive the shadow, so we
// assert the channels in each theme. The old bug used a hardcoded Lime shadow that
// ignored both the accent and the theme.

// Select the Berry accent on a live /random board, activate box 0, and read back
// the active-state shadow's RGB. color-mix serialises as `color(srgb r g b / .3)`.
async function berryActiveShadow(page: Page): Promise<{ r: number; g: number; b: number }> {
  // /random loads the game screen with live digit boxes.
  await page.goto("/random");
  await expect(page.locator('[data-digit="0"]')).toBeVisible();

  // Pick the Berry accent via the menu.
  await page.locator("[data-menu-btn]").click();
  await page.locator('[data-swatches] [data-colour="Berry"]').click();
  await page.locator("[data-menu-btn]").click(); // close menu

  // Activate box 0 — this applies the active-state shadow.
  await page.locator('[data-digit="0"]').click();

  const shadow = await page
    .locator('[data-digit="0"]')
    .evaluate((el) => getComputedStyle(el).boxShadow);

  const srgb = shadow.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  expect(srgb, `expected an srgb color-mix shadow, got: ${shadow}`).not.toBeNull();
  const [r, g, b] = srgb!.slice(1, 4).map((c) => Math.round(parseFloat(c) * 255));
  return { r, g, b };
}

test.describe("light mode", () => {
  // Force light mode so the Berry *light* value (#de1f46 = rgb(222,31,70)) applies.
  test.use({ colorScheme: "light" });

  test("active digit-box shadow follows the light accent", async ({ page }) => {
    const rgb = await berryActiveShadow(page);
    // Berry light, not the old hardcoded Lime.
    expect(rgb).toEqual({ r: 222, g: 31, b: 70 });
    expect(rgb).not.toEqual({ r: 10, g: 133, b: 10 });
  });
});

test.describe("dark mode", () => {
  // Force dark mode so the Berry *dark* value (#ea6c85 = rgb(234,108,133)) applies.
  test.use({ colorScheme: "dark" });

  test("active digit-box shadow follows the dark accent", async ({ page }) => {
    const rgb = await berryActiveShadow(page);
    // Berry dark, NOT the light variant (proves the shadow tracks the theme) and
    // NOT the old hardcoded Lime.
    expect(rgb).toEqual({ r: 234, g: 108, b: 133 });
    expect(rgb).not.toEqual({ r: 222, g: 31, b: 70 });
    expect(rgb).not.toEqual({ r: 10, g: 133, b: 10 });
  });
});
