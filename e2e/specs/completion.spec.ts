import { test, expect } from "../fixtures.ts";
import { CompletionPage } from "../pages/completion.page.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { seedHistory, seedLastVisit } from "../helpers/storage.ts";
import { freezeDate } from "../helpers/clock.ts";

// Frozen "today" so seeded history and the countdown are deterministic.
const NOW = "2026-06-08T12:00:00Z";
const TODAY = "2026-06-08";

// Three consecutive days ending today: played=3, avg=(2+4+3)/3=3.0, streak=3.
const HISTORY = [
  { date: "2026-06-08", tries: 2 },
  { date: "2026-06-07", tries: 4 },
  { date: "2026-06-06", tries: 3 },
];

async function gotoCompletion(page: import("@playwright/test").Page) {
  await freezeDate(page, NOW);
  await seedHistory(page, HISTORY);
  await seedLastVisit(page, TODAY);
  await page.goto("/solved");
  await expectActiveScreen(page, "completion");
}

test.describe("completion screen", () => {
  test("stats render from seeded history", async ({ page }) => {
    await gotoCompletion(page);
    const stat = (label: string) =>
      page.locator("[data-completion-stats] > div").filter({ hasText: label }).locator("span.font-mono");

    await expect(stat("Played")).toHaveText("3");
    await expect(stat("Avg tries")).toHaveText("3.0");
    await expect(page.locator("[data-completion-stats] > div")).toHaveCount(4);
  });

  test("countdown shows the time until the next puzzle, derived from the clock", async ({ page }) => {
    // Rendered once from the frozen clock (not a live tick). NOW = 12:00 UTC, next
    // local midnight is 24:00, so ~12h remain. Assert the format and that it derives
    // from the clock (11h/12h band) rather than a hardcoded value — exact minutes
    // drift by sub-second clock skew, so don't pin them.
    await gotoCompletion(page);
    const completion = new CompletionPage(page);

    await expect(completion.countdown).toBeVisible();
    await expect(completion.countdown).toHaveText(/^Next puzzle in (11|12)h \d{1,2}m$/);
  });

  test("completion links and feedback button are present", async ({ page }) => {
    await gotoCompletion(page);
    const completion = new CompletionPage(page);

    await expect(completion.links).toBeVisible();
    await expect(completion.links.locator("a, button")).not.toHaveCount(0);
    await expect(completion.feedbackBtn).toBeVisible();
  });
});
