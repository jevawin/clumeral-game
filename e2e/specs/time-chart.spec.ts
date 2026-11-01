import { test, expect } from "../fixtures.ts";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { solvePuzzle } from "../helpers/solve.ts";
import { expectActiveScreen } from "../helpers/screens.ts";

// The "Everyone today" card on /solved (time chart brief item 83).
//
// No freezeDate and no page.clock anywhere in this file, as player-stats.spec.ts
// explains: /api/dev/answer serves today's REAL answer, so a frozen other day loads
// the wrong puzzle, and the fake clock leaves clicks hanging during a solve.

const PROJECTS = ["chromium-desktop", "mobile-chromium", "mobile-webkit"];
test.beforeEach(({}, info) => {
  test.skip(!PROJECTS.includes(info.project.name), "time chart runs on chromium-desktop and the two mobile projects");
});

// Whole days from the epoch (2026-03-08 is puzzle 1), keyed on the browser's LOCAL
// date — the client keys the puzzle day on todayKey(), not UTC.
function puzzleNumberFor(localDate: string): number {
  return Math.round((Date.parse(localDate + "T00:00:00Z") - Date.parse("2026-03-08T00:00:00Z")) / 86_400_000) + 1;
}

test.describe("time chart — data path", () => {
  // Brief items 24, 40: puzzle_time carries the number, and no other event changes.
  test("puzzle_time carries the puzzle number", async ({ page }) => {
    await gotoPlayableGame(page);
    const timeReq = page.waitForRequest(
      (r) => r.url().endsWith("/api/event") && r.method() === "POST" && r.postDataJSON()?.event === "puzzle_time",
    );
    const completeReq = page.waitForRequest(
      (r) => r.url().endsWith("/api/event") && r.method() === "POST" && r.postDataJSON()?.event === "puzzle_complete",
    );
    await solvePuzzle(page);
    await expectActiveScreen(page, "completion");

    const localDate = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
    expect((await timeReq).postDataJSON().puzzleNum).toBe(puzzleNumberFor(localDate));
    expect("puzzleNum" in (await completeReq).postDataJSON()).toBe(false);
  });
});
