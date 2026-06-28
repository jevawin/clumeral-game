import { test, expect } from "../fixtures.ts";

// Force light mode so the Berry *light* value (#de1f46 = rgb(222,31,70)) applies.
test.use({ colorScheme: "light" });

test("active digit-box shadow follows the selected accent colour", async ({ page }) => {
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

  // The active shadow now derives from --color-accent via color-mix, which
  // Chromium serialises in the srgb colour space (e.g.
  // "color(srgb 0.870588 0.121569 0.27451 / 0.3)") rather than as rgb(). Parse
  // the channels back to 0–255 and assert they match Berry (222, 31, 70), and
  // crucially NOT the old hardcoded Lime (10, 133, 10).
  const srgb = shadow.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  expect(srgb, `expected an srgb color-mix shadow, got: ${shadow}`).not.toBeNull();
  const [r, g, b] = srgb!.slice(1, 4).map((c) => Math.round(parseFloat(c) * 255));

  // Berry, not the hardcoded Lime.
  expect({ r, g, b }).toEqual({ r: 222, g: 31, b: 70 });
  expect({ r, g, b }).not.toEqual({ r: 10, g: 133, b: 10 });
});
