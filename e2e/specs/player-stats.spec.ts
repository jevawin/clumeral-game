import { test, expect } from "../fixtures.ts";
import { CompletionPage } from "../pages/completion.page.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { seedHistory, seedPrefs, seedLastVisit } from "../helpers/storage.ts";
import { solvePuzzle, readAnswer, setBoxes } from "../helpers/solve.ts";

// No page.clock here, deliberately.
//
// Two reasons, both learned the hard way. /api/dev/answer serves TODAY's daily
// answer, so freezing "today" to a fixed past date makes the client ask for that
// day's puzzle while the helper hands back today's — every "solve" is really a
// wrong guess and the screen never moves. And the fake clock fights Playwright:
// screen transitions run on a setTimeout and clicks wait on animation frames, so
// jumping the clock around left clicks hanging.
//
// So: real time, and history seeded relative to the real today. The cost is that
// this file waits out the five-second submit hold for real. That is the only
// destructive thing in the build, and the pause is the only thing standing
// between a mis-tap and a deletion, so it is worth five seconds.
const NOW = new Date();
const day = (back: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const TODAY = day(0);

// Four consecutive past days ending yesterday. Solving today makes it five
// countable games, well past the third-game reveal gate. Yesterday and the day
// before differ in goes, so the first-go streak has something to break on.
const PAST = [
  { date: day(1), tries: 1, answer: 111, seconds: 48 },
  { date: day(2), tries: 3, answer: 222, seconds: 300 },
  { date: day(3), tries: 2, answer: 333, seconds: 260 },
  { date: day(4), tries: 4, answer: 444, seconds: 400 },
];

async function readHistory(page: import("@playwright/test").Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("dlng_history") ?? "null"));
}

async function startToday(
  page: import("@playwright/test").Page,
  history: typeof PAST,
  prefs: { saveScore?: boolean } = {},
) {
  await seedHistory(page, history);
  await seedPrefs(page, prefs);
  await seedLastVisit(page, TODAY);
  await page.goto("/play");
  await expectActiveScreen(page, "game");
  await expect(page.locator("[data-clue-list]")).toBeVisible();
}

test.describe("player stats — the panel after a solve", () => {
  test("shows all three blocks with the figures from history plus this game", async ({ page }) => {
    await startToday(page, PAST);
    await solvePuzzle(page);
    await expectActiveScreen(page, "completion");

    const completion = new CompletionPage(page);
    await expect(completion.thisGame).toBeVisible();
    await expect(completion.streaks).toBeVisible();
    await expect(completion.allTime).toBeVisible();

    // Five countable games ending today, so the play streak is live. Today is
    // solved first go, and so was yesterday; the day before took three, which is
    // where the first-go streak breaks.
    await expect(completion.stat("Play streak")).toHaveText("5");
    await expect(completion.stat("First-go streak")).toHaveText("2");
    await expect(completion.stat("Plays")).toHaveText("5");
    await expect(completion.stat("First-go wins")).toHaveText("2 (40%)");
    // (1 + 3 + 2 + 4 + 1) / 5
    await expect(completion.stat("Average goes")).toHaveText("2.2");
    // How long today's solve took is real wall time, so these assert the SHAPE.
    // The arithmetic behind them is pinned exactly in tests/player-stats.spec.ts;
    // what this proves is that real numbers reach the real panel at all.
    await expect(completion.stat("Average time")).toHaveText(/^\d+m \d\ds$/);
    await expect(completion.stat("Fastest first-go win")).toHaveText(/^\d+m \d\ds$/);

    // The explanatory lines are the whole point of the build.
    await expect(completion.panel).toContainText("Days in a row you have finished the puzzle.");
    await expect(completion.panel).toContainText("Days in a row you got it on your first guess.");
    await expect(completion.panel).toContainText("Miss a day and the streak starts again.");
    await expect(completion.panel).toContainText("Your quickest win on a first guess.");

    // Six chart rows, counts as text beside the bars.
    await expect(completion.goesRows).toHaveCount(6);
    await expect(completion.panel).toContainText("How many goes you take");

    // The hero, and the one announcement — goes, time, play streak, nothing else,
    // with the time spelled out for speech rather than read as "colon".
    await expect(completion.thisGame).toContainText(/Solved in 1 go, \d+m \d\ds/);
    await expect(completion.live).toHaveText(/^Solved in 1\. .*seconds?\. Play streak 5\.$/);
  });

  test("a brand-new player sees This game only, and why", async ({ page }) => {
    // No history at all. /play would bounce a stranger to /welcome, so start
    // there and press Play — the real first-timer's route.
    await seedLastVisit(page, TODAY);
    await page.goto("/welcome");
    await page.locator("[data-play-btn]").click();
    await expectActiveScreen(page, "game");
    await expect(page.locator("[data-clue-list]")).toBeVisible();

    await solvePuzzle(page);
    await expectActiveScreen(page, "completion");

    const completion = new CompletionPage(page);
    await expect(completion.thisGame).toBeVisible();
    await expect(completion.streaks).toHaveCount(0);
    await expect(completion.allTime).toHaveCount(0);
    await expect(completion.panel).toContainText(
      "Your streaks and all-time stats start from your third game.",
    );
  });
});

test.describe("player stats — score saving switched off", () => {
  test("shows This game only, says nothing about saving, and stores a marker", async ({ page }) => {
    await startToday(page, PAST, { saveScore: false });
    await solvePuzzle(page);
    await expectActiveScreen(page, "completion");

    const completion = new CompletionPage(page);
    await expect(completion.thisGame).toBeVisible();
    await expect(completion.streaks).toHaveCount(0);
    await expect(completion.allTime).toHaveCount(0);
    // P-01: the panel says nothing at all about score saving, in any mode. The
    // setting lives on the play screen, where the consent happens.
    await expect(completion.panel).not.toContainText(/saving/i);
    await expect(completion.panel.locator('input[type="checkbox"]')).toHaveCount(0);

    // A day-only marker: the date and nothing else.
    expect(await readHistory(page)).toEqual([{ date: TODAY, tries: 0, marker: true }]);
  });
});

test.describe("player stats — the delete flow", () => {
  // These resolve the board by hand and drive the checkbox, and one of them
  // waits out the five-second hold for real.
  test.slow();

  // seedHistory rewrites history on EVERY navigation, which would put the seeded
  // rows straight back after the deletion and hide the very thing the reload is
  // checking. This writes only when there is nothing there, so the marker
  // survives a reload.
  async function seedOnce(
    page: import("@playwright/test").Page,
    entries: typeof PAST,
  ): Promise<void> {
    await page.addInitScript((data) => {
      if (localStorage.getItem("dlng_history") === null) {
        localStorage.setItem("dlng_history", JSON.stringify(data));
      }
      if (localStorage.getItem("dlng_prefs") === null) {
        localStorage.setItem("dlng_prefs", JSON.stringify({ saveScore: true }));
      }
    }, entries);
  }

  test("warns, holds submit for five seconds, and deletes only on submit", async ({ page }) => {
    await seedOnce(page, PAST);
    await seedLastVisit(page, TODAY);
    await page.goto("/play");
    await expectActiveScreen(page, "game");
    await expect(page.locator("[data-clue-list]")).toBeVisible();

    // Resolve the board WITHOUT submitting: the save row only shows while the
    // submit row does.
    const answer = await readAnswer(page);
    await setBoxes(page, answer);

    const warning = page.locator("[data-save-warning]");
    const countdown = page.locator("[data-save-countdown]");
    const submit = page.locator("[data-submit]");
    const label = page.locator('label[for="cw-ck"]');

    await expect(label).toBeVisible();
    await expect(warning).toHaveText("");

    // The input is visually hidden behind its label's tick icons, so the label is
    // what a player actually presses.
    await label.click();
    await expect(page.locator("[data-save-check]")).not.toBeChecked();
    await expect(warning).toHaveText("Your existing stats will be deleted when you submit.");
    await expect(submit).toHaveAttribute("aria-disabled", "true");
    await expect(countdown).toHaveText(/^Submit enabled in [1-5]$/);
    // The checkbox keeps its own label throughout (P-02) — it never becomes the
    // warning, which would leave the control not saying what it does.
    await expect(label).toHaveText("Save my scores on this device");

    // Wait the hold out for real. That it clears at all is what proves the
    // countdown is a hold rather than a permanent lock.
    await expect(submit).not.toHaveAttribute("aria-disabled", "true", { timeout: 15_000 });
    await expect(countdown).toHaveText("");
    // The warning stays while the box is unticked — submitting can be long after
    // the countdown ends, and it is the warning that has to be on screen then.
    await expect(warning).toHaveText("Your existing stats will be deleted when you submit.");
    // Still nothing deleted. Deletion happens on the solve — not on the untick,
    // and not when the countdown ends.
    expect(await readHistory(page)).toHaveLength(PAST.length);

    await submit.click();
    await expectActiveScreen(page, "completion");

    // The seeded results are gone and a marker remains for the day just solved.
    expect(await readHistory(page)).toEqual([{ date: TODAY, tries: 0, marker: true }]);

    // That marker is what keeps today unreplayable: hasPlayerData needs history
    // or a mid-game board, and solving cleared the board. Without it the router
    // would send this player to /welcome and hand them today's puzzle again.
    await page.reload();
    await expect(page).toHaveURL(/\/solved$/);
    expect(await readHistory(page)).toEqual([{ date: TODAY, tries: 0, marker: true }]);
    await page.goto("/play");
    await expect(page).toHaveURL(/\/solved$/);
  });

  test("re-ticking before submitting keeps everything", async ({ page }) => {
    await startToday(page, PAST);
    const answer = await readAnswer(page);
    await setBoxes(page, answer);

    const label = page.locator('label[for="cw-ck"]');
    const warning = page.locator("[data-save-warning]");

    await label.click();
    await expect(warning).not.toHaveText("");
    await label.click();
    await expect(warning).toHaveText("");
    // Re-ticking releases submit immediately — the countdown does not hold a
    // player hostage for a change they have already undone.
    await expect(page.locator("[data-submit]")).not.toHaveAttribute("aria-disabled", "true");

    await page.locator("[data-submit]").click();
    await expectActiveScreen(page, "completion");

    const history = (await readHistory(page)) as { date: string }[];
    expect(history).toHaveLength(PAST.length + 1);
    expect(history.some((h) => h.date === day(4))).toBe(true);
  });
});
