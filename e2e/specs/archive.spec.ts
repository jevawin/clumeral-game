import { test, expect } from "../fixtures.ts";
import { ArchivePage } from "../pages/archive.page.ts";
import { solvePuzzle } from "../helpers/solve.ts";
import { expectActiveScreen } from "../helpers/screens.ts";

// A valid past, in-range date that the Worker will serve a puzzle for.
const PAST_DATE = "2026-03-10";

test.describe("archive", () => {
  test("SSR list loads with rows ordered newest-first", async ({ page }) => {
    const archive = new ArchivePage(page);
    await archive.open();
    await expect(archive.heading).toContainText("Every Clumeral");

    const count = await archive.rows.count();
    expect(count).toBeGreaterThan(0);

    const dates = await archive.rows.evaluateAll((rows) =>
      rows.map((r) => r.getAttribute("data-date") ?? ""),
    );
    expect(dates).toEqual([...dates].sort().reverse()); // date-descending
  });

  test("deep-link to a dated puzzle shows the game with a replay banner", async ({ page }) => {
    const archive = new ArchivePage(page);
    await page.goto(`/archive/${PAST_DATE}`);

    await expectActiveScreen(page, "game");
    await expect(archive.replayRow).toBeVisible();
    await expect(archive.replayBanner).not.toHaveText("");
    await expect(archive.backBtn).toBeVisible();
  });

  test("the replay back button returns to /archive", async ({ page }) => {
    const archive = new ArchivePage(page);
    await page.goto(`/archive/${PAST_DATE}`);
    await expect(archive.backBtn).toBeVisible();

    await archive.backBtn.click();
    expect(new URL(page.url()).pathname).toBe("/archive");
    await expect(archive.heading).toContainText("Every Clumeral");
  });

  test("clicking the newest archive row opens its puzzle", async ({ page }) => {
    const archive = new ArchivePage(page);
    await archive.open();
    const date = await archive.newestDate();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await archive.rowLink(date).click();
    await expect(page).toHaveURL(new RegExp(`/archive/${date}$`));
    await expectActiveScreen(page, "game");
  });

  test("solving today's replay reaches completion", async ({ page }) => {
    // Today's archive replay loads /api/puzzle?date=<today>, whose answer matches
    // /api/dev/answer (today, UTC) — so the solve helper can drive it to completion.
    const { date } = (await (await page.request.get("/api/puzzle")).json()) as { date: string };
    await page.goto(`/archive/${date}`);
    await expectActiveScreen(page, "game");

    await solvePuzzle(page);
    await expectActiveScreen(page, "completion");
  });
});
