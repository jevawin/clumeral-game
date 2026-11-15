import { test, expect } from "../fixtures.ts";
import type { Page } from "@playwright/test";
import { CompletionPage } from "../pages/completion.page.ts";
import { expectActiveScreen, waitForScreenSettled } from "../helpers/screens.ts";
import { seedHistory, seedLastVisit, seedPrefs, type HistoryEntry } from "../helpers/storage.ts";
import { freezeDate } from "../helpers/clock.ts";
import { solveRandom } from "../helpers/random.ts";
import { rows, stubField } from "../helpers/time-field.ts";

// The results page as cards (results page redesign brief, item 77): card order,
// the ledger, the goes strip's layout and keyboard reach, and the other modes.

// The leaderboard field is stubbed so its card always draws, and page.route is
// unreliable on WebKit with an active service worker (e2e/fixtures.ts).
test.use({ serviceWorkers: "block" });

const NOW = "2026-06-08T12:00:00Z";
const TODAY = "2026-06-08";

function dayBack(back: number, from = TODAY): string {
  const d = new Date(from + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

// 40 consecutive days ending today, a time on every row, one day of 9 goes ten
// days back, and today 3 goes in 148s.
const GOES = [1, 2, 1, 1, 3, 2, 1, 4, 1, 2];
const FULL: HistoryEntry[] = Array.from({ length: 40 }, (_, back) => {
  if (back === 0) return { date: TODAY, tries: 3, answer: 123, seconds: 148 };
  return {
    date: dayBack(back),
    tries: back === 10 ? 9 : GOES[back % GOES.length],
    answer: 100 + back,
    seconds: 60 + ((back * 37) % 200),
  };
});

// Twenty strangers: the leaderboard always draws.
const FIELD = rows([41, 49, 56, 63, 69, 69, 69, 81, 88, 96, 104, 104, 127, 163, 182, 206, 245, 311, 892, 120]);

async function openFull(page: Page, history: HistoryEntry[] = FULL): Promise<CompletionPage> {
  await freezeDate(page, NOW);
  await seedHistory(page, history);
  await seedPrefs(page, { saveScore: true });
  await seedLastVisit(page, TODAY);
  await stubField(page, FIELD);
  await page.goto("/solved");
  await waitForScreenSettled(page, "completion");
  return new CompletionPage(page);
}

/** The ledger's figures, worked out here from the same history. */
function expectedLedger(history: HistoryEntry[]) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const ones = sorted.filter((h) => h.tries === 1).length;
  let run = 0;
  let best = 0;
  for (const h of sorted) {
    run = h.tries === 1 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const fastest = Math.min(...sorted.map((h) => h.seconds!));
  return {
    solvedInOne: `${Math.round((ones / sorted.length) * 100)}%`,
    bestOneGoRun: String(best),
    fastest: `${Math.floor(fastest / 60)}m ${String(fastest % 60).padStart(2, "0")}s`,
    plays: String(sorted.length),
  };
}

type Box = { x: number; y: number; width: number; height: number };
async function box(page: Page, selector: string, index: number | "last" = 0): Promise<Box> {
  const loc = page.locator(selector);
  const b = await (index === "last" ? loc.last() : loc.nth(index)).boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

test.describe("results page — full mode", () => {
  test("cards come in order: Today, leaderboard, Streaks, All time", async ({ page }) => {
    const completion = await openFull(page);
    await expect(completion.leaderboard.locator(".time-chart__line")).toBeVisible();
    expect(await completion.cardOrder()).toEqual(["today", "daily-leaderboard", "streak", "all-time"]);
  });

  test("the ledger matches the history", async ({ page }) => {
    const completion = await openFull(page);
    const want = expectedLedger(FULL);
    await expect(completion.ledger("Solved in one")).toHaveText(want.solvedInOne);
    await expect(completion.ledger("Best one-go run")).toHaveText(want.bestOneGoRun);
    await expect(completion.ledger("Fastest solve")).toHaveText(want.fastest);
    await expect(completion.ledger("Puzzles solved")).toHaveText(want.plays);
  });

  test("the strip opens at today", async ({ page }) => {
    const completion = await openFull(page);
    await expect(completion.stripDays).toHaveCount(40);
    const scroller = await box(page, "[data-strip-scroller]");
    const last = await box(page, "[data-strip-day]", "last");
    const first = await box(page, "[data-strip-day]", 0);
    expect(last.x + last.width).toBeLessThanOrEqual(scroller.x + scroller.width + 0.5);
    expect(last.x).toBeGreaterThanOrEqual(scroller.x);
    // 40 columns at 22px are wider than the card, so the oldest is off to the left.
    expect(first.x + first.width).toBeLessThan(scroller.x);
  });

  test("a day past the cap is a broken column with its true figure", async ({ page }) => {
    await openFull(page);
    const broken = page.locator('[data-strip-day][data-goes="9"]');
    await expect(broken).toHaveCount(1);
    await expect(broken).toHaveAttribute("data-broken", "");
    await expect(broken.locator(".goes-strip__count")).toHaveText("9");
  });

  test("the strip never scrolls vertically", async ({ page }) => {
    await openFull(page);
    const m = await page.locator("[data-strip-scroller]").evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(m.scrollHeight).toBe(m.clientHeight);
  });

  test("the fade never hides the oldest day", async ({ page }) => {
    await openFull(page);
    const scroller = page.locator("[data-strip-scroller]");
    // Fully left in an rtl box is the most negative scrollLeft.
    await scroller.evaluate((el) => { el.scrollLeft = -el.scrollWidth; });
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeLessThan(0);
    const s = await box(page, "[data-strip-scroller]");
    const first = await box(page, "[data-strip-day]", 0);
    expect(first.x - s.x).toBeGreaterThanOrEqual(39.5);
  });

  for (const worst of [1, 2]) {
    test(`a ${worst}-row strip keeps the Goes label above the meta row`, async ({ page }) => {
      const short = FULL.slice(0, 5).map((h) => ({ ...h, tries: Math.min(h.tries, worst) }));
      await openFull(page, short);
      const label = await box(page, ".goes-strip__y");
      const meta = await box(page, ".goes-strip__meta");
      expect(label.y + label.height).toBeLessThanOrEqual(meta.y + 0.5);
    });
  }

  test("the strip scrolls from the keyboard, with a visible ring", async ({ page }, info) => {
    // webkit-desktop was in the plan's list and is dropped: Tab reaches the strip
    // there, but WebKit does not scroll a focused overflow box with the arrow keys
    // (checked 2026-11-15). The summary and the scrollbar still serve it.
    test.skip(
      !["chromium-desktop", "mobile-chromium"].includes(info.project.name),
      "keyboard scrolling is checked on Chromium desktop and mobile; WebKit does not arrow-scroll a focused box",
    );
    await openFull(page);
    const scroller = page.locator("[data-strip-scroller]");
    let reached = false;
    for (let i = 0; i < 20 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await scroller.evaluate((el) => document.activeElement === el);
    }
    expect(reached, "Tab reaches the strip within 20 presses").toBe(true);
    const before = await scroller.evaluate((el) => Math.abs(el.scrollLeft));
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
    await expect.poll(() => scroller.evaluate((el) => Math.abs(el.scrollLeft))).toBeGreaterThan(before);
    const ring = await page.locator(".goes-strip__frame").evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(ring).toBe("solid");
  });

  test("a thin scrollbar on a fine pointer, none on touch (brief 52)", async ({ page }, info) => {
    test.skip(
      !["chromium-desktop", "mobile-chromium"].includes(info.project.name),
      "scrollbar-width is read on Chromium desktop (fine pointer) and mobile (touch)",
    );
    await openFull(page);
    const width = await page.locator("[data-strip-scroller]").evaluate((el) => getComputedStyle(el).scrollbarWidth);
    expect(width).toBe(info.project.name === "chromium-desktop" ? "thin" : "none");
  });
});

test.describe("results page — other modes", () => {
  test("a random solve shows Today only, with the random note", async ({ page }) => {
    await solveRandom(page);
    await expectActiveScreen(page, "completion");
    const completion = new CompletionPage(page);
    expect(await completion.cardOrder()).toEqual(["today"]);
    await expect(completion.today).toContainText("Random puzzles don't count towards your stats.");
  });

  test("a second game shows Today with the new-player note, and no Streaks", async ({ page }) => {
    const completion = await openFull(page, FULL.slice(0, 2));
    await expect(completion.today).toContainText("Your streaks and all-time stats start from your third game.");
    await expect(completion.streak).toHaveCount(0);
    await expect(completion.strip).toHaveCount(0);
  });

  // An archive solve never reaches /solved; the archive panel is pre-rendered
  // into the hidden completion screen when an already-solved past date opens
  // (src/app.ts). So the screen is hidden here, and nothing is asserted visible.
  test("an archive replay pre-renders Today only", async ({ page }) => {
    const today = new Date().toLocaleDateString("en-CA");
    const past = dayBack(5, today);
    await seedHistory(page, [
      { date: today, tries: 2, answer: 123, seconds: 90 },
      { date: past, tries: 3, answer: 456, seconds: 200, archived: true },
    ]);
    await page.goto(`/archive/${past}`);
    await expectActiveScreen(page, "game");
    const cards = page.locator("[data-completion-panel] > section");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute("data-stat-block", "today");
    await expect(page.locator("[data-strip-scroller]")).toHaveCount(0);
  });
});
