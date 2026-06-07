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
