import { expect, type Page } from "@playwright/test";

type ScreenName = "welcome" | "game" | "completion";

// The three-screen state machine toggles aria-hidden on each <section data-screen>.
// The active screen has aria-hidden absent/false; inactive screens are "true".
export async function expectActiveScreen(page: Page, name: ScreenName): Promise<void> {
  const others: ScreenName[] = (["welcome", "game", "completion"] as ScreenName[]).filter(
    (s) => s !== name,
  );
  await expect(page.locator(`[data-screen="${name}"]`)).not.toHaveAttribute(
    "aria-hidden",
    "true",
  );
  for (const other of others) {
    await expect(page.locator(`[data-screen="${other}"]`)).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  }
}

// Wait for a screen to finish its fade-in (opacity → 1). The screens cross-fade
// over ~250ms; run this before injecting axe so analysis doesn't race the
// transition (which under parallel load can destroy the eval context).
export async function waitForScreenSettled(page: Page, name: ScreenName): Promise<void> {
  const loc = page.locator(`[data-screen="${name}"]`);
  await expect(loc).not.toHaveAttribute("aria-hidden", "true");
  await expect
    .poll(async () => loc.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10_000 })
    .toBe("1");
}
