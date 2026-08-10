import { test, expect } from "../fixtures.ts";
import { CompletionPage } from "../pages/completion.page.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { seedHistory, seedPrefs, seedLastVisit } from "../helpers/storage.ts";
import { freezeDate, advanceBy } from "../helpers/clock.ts";
import { solvePuzzle, readAnswer, setBoxes } from "../helpers/solve.ts";

// Frozen "today", so seeded history and the streak walk are deterministic.
const NOW = "2026-06-08T12:00:00Z";
const TODAY = "2026-06-08";

// Four past days ending yesterday. Solving today makes it five countable games,
// which is well past the third-game reveal gate.
const PAST = [
  { date: "2026-06-07", tries: 1, answer: 111, seconds: 48 },
  { date: "2026-06-06", tries: 3, answer: 222, seconds: 300 },
  { date: "2026-06-05", tries: 2, answer: 333, seconds: 260 },
  { date: "2026-06-04", tries: 4, answer: 444, seconds: 400 },
];

async function readHistory(page: import("@playwright/test").Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("dlng_history") ?? "null"));
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
    await solvePuzzle(page);
    await expectActiveScreen(page, "completion");

    const completion = new CompletionPage(page);
    await expect(completion.thisGame).toBeVisible();
    await expect(completion.streaks).toBeVisible();
    await expect(completion.allTime).toBeVisible();

    // Five countable games ending today, so both streaks are live.
    await expect(completion.stat("Play streak")).toHaveText("5");
    await expect(completion.stat("Plays")).toHaveText("5");
    // One first-go win among five. The number of goes today is whatever the
    // solve took, so the percentage is not pinned here — the unit tests own the
    // arithmetic; this proves the real numbers reach the real panel.
    await expect(completion.stat("First-go wins")).toHaveText(/^\d+ \(\d+%\)$/);
    await expect(completion.stat("Average goes")).toHaveText(/^\d+\.\d$/);
    await expect(completion.stat("Fastest first-go win")).toHaveText("0:48");

    // The explanatory lines are the whole point of the build.
    await expect(completion.panel).toContainText("Days in a row you have finished the puzzle.");
    await expect(completion.panel).toContainText("Miss a day and the streak starts again.");
    await expect(completion.panel).toContainText("Your quickest win on a first guess.");

    // Six chart rows, counts as text beside the bars.
    await expect(completion.goesRows).toHaveCount(6);
    await expect(completion.panel).toContainText("How many goes you take");

    // The hero says how this game went, and the panel announces once.
    await expect(completion.thisGame).toContainText(/^Solved in \d+ · \d+:\d\d$/);
    await expect(completion.live).toContainText(/^Solved in \d+\. .+\. Play streak 5\.$/);
  });

  test("a brand-new player sees This game only, and why", async ({ page }) => {
    // No history at all. /play would normally bounce a stranger to /welcome, so
    // start there and press Play, which is the real first-timer's route.
    await freezeDate(page, NOW);
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
  test("warns, holds submit for five seconds, and deletes only on submit", async ({ page }) => {
    await startToday(page, PAST);

    // Resolve the board WITHOUT submitting: the save row is only shown while the
    // submit row is, and a wrong guess hides both again.
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
    await expect(countdown).toHaveText("Submit enabled in 5");
    await expect(submit).toHaveAttribute("aria-disabled", "true");

    // The checkbox keeps its own label throughout (P-02) — it never becomes the
    // warning, which would leave the control not saying what it does.
    await expect(label).toHaveText("Save my scores on this device");

    // Nothing is deleted while the countdown runs, and pressing submit does
    // nothing at all.
    await submit.click();
    await expectActiveScreen(page, "game");
    expect(await readHistory(page)).toHaveLength(PAST.length);

    // The clock is under our control, so the five seconds cost no wall time.
    await advanceBy(page, 5_000);
    await expect(submit).not.toHaveAttribute("aria-disabled", "true");
    await expect(countdown).toHaveText("");
    // The warning stays while the box is unticked — submitting can be long after
    // the countdown ends, and it is the warning that has to be on screen then.
    await expect(warning).toHaveText("Your existing stats will be deleted when you submit.");
    expect(await readHistory(page)).toHaveLength(PAST.length);

    await submit.click();
    await expectActiveScreen(page, "completion");

    // The seeded results are gone and a marker remains for the day just solved.
    expect(await readHistory(page)).toEqual([{ date: TODAY, tries: 0, marker: true }]);

    // And that marker is what keeps today unreplayable: hasPlayerData needs
    // history or a mid-game board, and solving cleared the board. Without it the
    // router would send this player to /welcome and hand them today again.
    await page.reload();
    await expect(page).toHaveURL(/\/solved$/);
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
    expect(history.some((h) => h.date === "2026-06-04")).toBe(true);
  });
});
