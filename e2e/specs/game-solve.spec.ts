import { test, expect } from "../fixtures.ts";
import { GamePage } from "../pages/game.page.ts";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { solvePuzzle } from "../helpers/solve.ts";
import { expectActiveScreen } from "../helpers/screens.ts";

type HistoryEntry = { date: string; tries: number; answer?: number };

const readHistory = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("dlng_history") || "[]") as HistoryEntry[],
  );

test.describe("game — solving", () => {
  test("solving the daily puzzle reaches completion and records history", async ({ page }) => {
    await gotoPlayableGame(page);
    await solvePuzzle(page);

    await expectActiveScreen(page, "completion");
    await expect(page.locator("[data-completion-heading]")).toBeVisible();

    // Seeded one past entry; solving today appends a second, keyed on today's date.
    const history = await readHistory(page);
    expect(history).toHaveLength(2);
    const fresh = history.filter((e) => e.date !== "2026-01-01");
    expect(fresh).toHaveLength(1);
    expect(fresh[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("eliminating down to one digit locks the box; the last digit cannot be removed", async ({ page }) => {
    await gotoPlayableGame(page);
    const game = new GamePage(page);

    await game.openBox(1);
    // Eliminate every candidate except 7.
    for (const d of [0, 1, 2, 3, 4, 5, 6, 8, 9]) await game.tapKey(d);
    await expect(page.locator('[data-digit="1"] span')).toHaveText("7");

    // The "cannot eliminate the last digit" guard: tapping 7 again is a no-op.
    await game.tapKey(7);
    await expect(page.locator('[data-digit="1"] span')).toHaveText("7");
  });

  test("submit appears only when all three boxes are resolved", async ({ page }) => {
    await gotoPlayableGame(page);
    const game = new GamePage(page);

    await game.openBox(0);
    for (const d of [2, 3, 4, 5, 6, 7, 8, 9]) await game.tapKey(d); // box 0 → 1
    await expect(game.submit).toBeHidden();

    await game.openBox(1);
    for (const d of [0, 1, 3, 4, 5, 6, 7, 8, 9]) await game.tapKey(d); // box 1 → 2
    await expect(game.submit).toBeHidden();

    await game.openBox(2);
    for (const d of [0, 1, 2, 4, 5, 6, 7, 8, 9]) await game.tapKey(d); // box 2 → 3
    await expect(game.submit).toBeVisible();
  });

  test("tapping a clue tag opens its definition tooltip", async ({ page }) => {
    await gotoPlayableGame(page);
    const game = new GamePage(page);

    await expect(game.firstClueTag).toBeVisible(); // clues finished loading
    await game.openFirstClueTip();
    await expect(game.tagTip).toBeVisible();
  });
});
