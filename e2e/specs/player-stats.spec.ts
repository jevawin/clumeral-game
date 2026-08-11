import { test, expect } from "../fixtures.ts";
import { CompletionPage } from "../pages/completion.page.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { seedHistory, seedPrefs, seedLastVisit } from "../helpers/storage.ts";
import { freezeDate, advanceBy } from "../helpers/clock.ts";
import { solvePuzzle, readAnswer, setBoxes } from "../helpers/solve.ts";

// The clock is frozen at the REAL now, not at a fixed past date.
//
// It has to be frozen at all so the five-second countdown can be advanced rather
// than waited out. It has to be *now* because /api/dev/answer serves today's
// daily answer: freeze to a date in the past and the client asks for that day's
// puzzle while the helper hands back today's, so every "solve" is really a wrong
// guess and the screen never moves. That is what failed here first time round.
const NOW = new Date();
const day = (back: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const TODAY = day(0);

// Four consecutive past days ending yesterday. Solving today makes it five
// countable games, well past the third-game reveal gate.
const PAST = [
  { date: day(1), tries: 1, answer: 111, seconds: 48 },
  { date: day(2), tries: 3, answer: 222, seconds: 300 },
  { date: day(3), tries: 2, answer: 333, seconds: 260 },
  { date: day(4), tries: 4, answer: 444, seconds: 400 },
];

// How long today's solve is made to take. The clock is frozen, so without this
// every solve counts zero seconds — the timer only banks a gap when the next
// interaction lands. 90s is under the two-minute idle cut-off, so it counts, and
// it is longer than the seeded 48s so the fastest first-go win stays the seeded
// one.
const TODAY_SECONDS = 90;

async function readHistory(page: import("@playwright/test").Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("dlng_history") ?? "null"));
}

// Wait out a screen transition on a frozen clock.
//
// showScreen fades the outgoing screen for 200ms on a setTimeout, and
// page.clock.install() pauses timers — so on a frozen clock that timer never
// fires on its own and the incoming screen never appears. A cold `page.goto`
// paints immediately and needs none of this; every transition made INSIDE the
// app does.
//
// The wait on the outgoing screen matters: the fade sets aria-hidden on it
// synchronously, so this proves the transition has actually started and the
// timer exists before we run the clock forward. Advancing before the solve's
// fetch has resolved would do nothing at all.
async function settleScreen(
  page: import("@playwright/test").Page,
  from: "welcome" | "game" | "completion",
  to: "welcome" | "game" | "completion",
) {
  await expect(page.locator(`[data-screen="${from}"]`)).toHaveAttribute("aria-hidden", "true");
  await advanceBy(page, 400);
  await expectActiveScreen(page, to);
}

async function startToday(
  page: import("@playwright/test").Page,
  history: Parameters<typeof seedHistory>[1],
  prefs: { saveScore?: boolean } = {},
) {
  await freezeDate(page, NOW);
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

    // Solve by hand so the clock can be moved between resolving the board and
    // submitting — that gap is what the timer counts.
    const answer = await readAnswer(page);
    await setBoxes(page, answer);
    await advanceBy(page, TODAY_SECONDS * 1000);
    await page.locator("[data-submit]").click();
    await settleScreen(page, "game", "completion");

    const completion = new CompletionPage(page);
    await expect(completion.thisGame).toBeVisible();
    await expect(completion.streaks).toBeVisible();
    await expect(completion.allTime).toBeVisible();

    // Five countable games ending today, so the play streak is live. Today is a
    // first-go win, so that streak is 1: yesterday was a first go too, but the
    // day before took three.
    await expect(completion.stat("Play streak")).toHaveText("5");
    await expect(completion.stat("First-go streak")).toHaveText("2");
    await expect(completion.stat("Plays")).toHaveText("5");
    await expect(completion.stat("First-go wins")).toHaveText("2 (40%)");
    // (1 + 3 + 2 + 4 + 1) / 5
    await expect(completion.stat("Average goes")).toHaveText("2.2");
    // (48 + 300 + 260 + 400 + 90) / 5 = 219.6s. This is the assertion that
    // proves the timer's number reaches the panel.
    await expect(completion.stat("Average time")).toHaveText("3:40");
    // The seeded 48s beats today's 90s.
    await expect(completion.stat("Fastest first-go win")).toHaveText("0:48");

    // The explanatory lines are the whole point of the build.
    await expect(completion.panel).toContainText("Days in a row you have finished the puzzle.");
    await expect(completion.panel).toContainText("Miss a day and the streak starts again.");
    await expect(completion.panel).toContainText("Your quickest win on a first guess.");

    // Six chart rows, counts as text beside the bars.
    await expect(completion.goesRows).toHaveCount(6);
    await expect(completion.panel).toContainText("How many goes you take");

    // The hero says how this game went, and the panel announces once — spelled
    // out for speech, not read as "one colon thirty".
    await expect(completion.thisGame).toContainText("Solved in 1 · 1:30");
    await expect(completion.live).toHaveText("Solved in 1. 1 minute 30 seconds. Play streak 5.");
  });

  test("a brand-new player sees This game only, and why", async ({ page }) => {
    // No history at all. /play would normally bounce a stranger to /welcome, so
    // start there and press Play, which is the real first-timer's route.
    await freezeDate(page, NOW);
    await seedLastVisit(page, TODAY);
    await page.goto("/welcome");
    await page.locator("[data-play-btn]").click();
    await settleScreen(page, "welcome", "game");
    await expect(page.locator("[data-clue-list]")).toBeVisible();

    await solvePuzzle(page);
    await settleScreen(page, "game", "completion");

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
    await settleScreen(page, "game", "completion");

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
  // These two resolve the board by hand AND drive the checkbox, so they do far
  // more work than a plain solve.
  test.slow();

  // seedHistory writes on EVERY navigation, which would put the seeded rows back
  // after the deletion and hide the very thing the reload is checking. This
  // writes only when there is nothing there, so the marker survives a reload.
  async function seedHistoryOnce(
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
    await freezeDate(page, NOW);
    await seedHistoryOnce(page, PAST);
    await seedLastVisit(page, TODAY);
    await page.goto("/play");
    await expectActiveScreen(page, "game");
    await expect(page.locator("[data-clue-list]")).toBeVisible();

    // Resolve the board WITHOUT submitting: the save row is only shown while the
    // submit row is.
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

    // Press submit IMMEDIATELY, before anything else. The hold is five seconds of
    // real time, so any assertion in between is a race — and this is the
    // assertion that matters most: during the hold, pressing submit must do
    // nothing at all. aria-disabled leaves the button clickable by design, so the
    // handler is what has to refuse.
    await submit.click();
    expect(await readHistory(page)).toHaveLength(PAST.length);
    await expectActiveScreen(page, "game");

    // Now the state it should be showing while it holds.
    await expect(page.locator("[data-save-check]")).not.toBeChecked();
    await expect(warning).toHaveText("Your existing stats will be deleted when you submit.");
    await expect(countdown).toContainText(/^Submit enabled in [1-5]$/);
    await expect(submit).toHaveAttribute("aria-disabled", "true");
    // The checkbox keeps its own label throughout (P-02) — it never becomes the
    // warning, which would leave the control not saying what it does.
    await expect(label).toHaveText("Save my scores on this device");

    // Let the hold expire. advanceBy nudges the frozen clock; the assertion below
    // is what actually waits, so a running clock reaches the same place.
    await advanceBy(page, 5_000);
    await expect(submit).not.toHaveAttribute("aria-disabled", "true");
    await expect(countdown).toHaveText("");
    // The warning stays while the box is unticked — submitting can be long after
    // the countdown ends, and it is the warning that has to be on screen then.
    await expect(warning).toHaveText("Your existing stats will be deleted when you submit.");
    expect(await readHistory(page)).toHaveLength(PAST.length);

    await submit.click();
    await settleScreen(page, "game", "completion");

    // The seeded results are gone and a marker remains for the day just solved.
    expect(await readHistory(page)).toEqual([{ date: TODAY, tries: 0, marker: true }]);

    // And that marker is what keeps today unreplayable: hasPlayerData needs
    // history or a mid-game board, and solving cleared the board. Without it the
    // router would send this player to /welcome and hand them today again.
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
    await settleScreen(page, "game", "completion");

    const history = (await readHistory(page)) as { date: string }[];
    expect(history).toHaveLength(PAST.length + 1);
    expect(history.some((h) => h.date === day(4))).toBe(true);
  });
});
