import { test, expect } from "../fixtures.ts";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { solvePuzzle } from "../helpers/solve.ts";
import { expectActiveScreen, waitForScreenSettled } from "../helpers/screens.ts";
import { seedHistory, seedPrefs, type HistoryEntry } from "../helpers/storage.ts";
import { solveRandom } from "../helpers/random.ts";
import { seriousViolations } from "../helpers/axe.ts";
import type { Page, Route } from "@playwright/test";

// The "Daily leaderboard" card on /solved (time chart brief item 83).
//
// No freezeDate and no page.clock anywhere in this file, as player-stats.spec.ts
// explains: /api/dev/answer serves today's REAL answer, so a frozen other day loads
// the wrong puzzle, and the fake clock leaves clicks hanging during a solve.

// Stubbed fields are served by page.route, which e2e/fixtures.ts records as
// unreliable on WebKit with an active service worker. The service worker sends
// /api/ network-only anyway, so blocking it loses nothing this spec tests.
test.use({ serviceWorkers: "block" });

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

// History relative to the REAL local today, as player-stats.spec.ts does it.
const NOW = new Date();
const day = (back: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Today solved in `seconds`, plus four past days: full mode, so the streak and
 *  all-time blocks sit below the card. */
async function seedSolved(page: Page, seconds: number) {
  const past: HistoryEntry[] = [1, 2, 3, 4].map((b) => ({ date: day(b), tries: 1, answer: 111, seconds: 60 + b }));
  await seedHistory(page, [{ date: day(0), tries: 2, answer: 123, seconds }, ...past]);
}

type Row = { second: number; count: number };
const rows = (times: number[]): Row[] => times.map((second) => ({ second, count: 1 }));

/** Stub the field. Returns a release() when `hold` is set, for the no-shift test. */
async function stubField(page: Page, times: Row[], opts: { hold?: boolean; status?: number } = {}) {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/times/*", async (route: Route) => {
    if (opts.hold) await held;
    if (opts.status) await route.fulfill({ status: opts.status, json: { error: "Times unavailable" } });
    else await route.fulfill({ json: { times } });
  });
  return release;
}

async function openSolved(page: Page) {
  await page.goto("/solved");
  await waitForScreenSettled(page, "completion");
}

const card = (page: Page) => page.locator("[data-time-chart]");
const copyLine = (page: Page) => card(page).locator(".time-chart__line");
const spoken = (page: Page) => card(page).locator(".sr-only");

test.describe("time chart — the card", () => {
  const STATES = [
    {
      n: 1,
      strangers: [],
      copy: "You're the first to solve today",
      said: "1 player solved today. Yours: 41 seconds.",
      median: false,
    },
    {
      n: 3,
      strangers: [30, 90],
      copy: "You're the 2nd fastest",
      said: "3 players solved today. Fastest 30 seconds, median 41 seconds, slowest 1 minute 30 seconds. Yours: 41 seconds.",
      median: true,
    },
    {
      n: 12,
      strangers: [20, 25, 30, 35, 50, 60, 70, 80, 90, 100, 120],
      copy: "You're in the top 42% of solve times",
      said: "12 players solved today. Fastest 20 seconds, median 55 seconds, slowest 2 minutes. Yours: 41 seconds.",
      median: true,
    },
  ];

  for (const st of STATES) {
    test(`draws the card at n = ${st.n}`, async ({ page }) => {
      await seedSolved(page, 41);
      await stubField(page, rows(st.strangers));
      await openSolved(page);

      await expect(copyLine(page)).toHaveText(st.copy);
      await expect(spoken(page)).toHaveText(st.said);
      await expect(card(page).locator("[data-tc-you]")).toHaveText("You41s");
      await expect(card(page).locator("[data-time-chart-track]")).toHaveAttribute("aria-hidden", "true");
      await expect(card(page).locator("[data-tc-ref]", { hasText: "Median" })).toHaveCount(st.median ? 1 : 0);
    });
  }

  // Item 113: the four sentence variants reach the accessibility tree.
  const SPOKEN = [
    { name: "n = 1", strangers: [], said: "1 player solved today. Yours: 41 seconds." },
    { name: "n = 2", strangers: [30], said: "2 players solved today. Fastest 30 seconds, slowest 41 seconds. Yours: 41 seconds." },
    { name: "all identical", strangers: [41, 41], said: "3 players solved today, all in 41 seconds. Yours: 41 seconds." },
    {
      name: "n ≥ 3",
      strangers: [30, 90],
      said: "3 players solved today. Fastest 30 seconds, median 41 seconds, slowest 1 minute 30 seconds. Yours: 41 seconds.",
    },
  ];
  for (const sp of SPOKEN) {
    test(`speaks the ${sp.name} sentence and hides the picture`, async ({ page }) => {
      await seedSolved(page, 41);
      await stubField(page, rows(sp.strangers));
      await openSolved(page);
      await expect(copyLine(page)).toBeVisible();
      const tree = await card(page).ariaSnapshot();
      expect(tree).toContain(sp.said);
      expect(tree).not.toContain("log scale");
      expect(tree).not.toContain("Fastest\n");
    });
  }
});

test.describe("time chart — layout", () => {
  // Item 54: the reserve holds the panel still while the field loads. At default
  // text only: the reserve is a fixed rem height, and item 122's caption adds
  // height at 200% by design.
  for (const width of [375, 320]) {
    test(`does not shift the panel when it arrives at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seedSolved(page, 500);
      // The longest copy line: "You're in the top 99% of solve times".
      const release = await stubField(page, [{ second: 10, count: 99 }, { second: 999, count: 1 }], { hold: true });
      await openSolved(page);
      const streak = page.locator('[data-stat-block="streak"]');
      await expect(card(page)).toHaveAttribute("aria-busy", "true");
      const before = (await streak.boundingBox())!.y;
      release();
      await expect(copyLine(page)).toHaveText("You're in the top 99% of solve times");
      const after = (await streak.boundingBox())!.y;
      expect(Math.abs(after - before)).toBeLessThan(1);
    });
  }

  // Items 52, 96, 108, 122: measured boxes at the real content widths. Fields
  // chosen to crowd the labels: you at each end, you in the middle, and a
  // median pushed against each end.
  const FIELDS = [
    { name: "you fastest", strangers: [60, 70, 900], you: 10 },
    { name: "you slowest", strangers: [10, 12, 15], you: 900 },
    { name: "you in the middle", strangers: [10, 170], you: 41 },
    { name: "median near the start", strangers: [10, 11, 12, 900], you: 11 },
    { name: "median near the end", strangers: [10, 800, 850, 900], you: 850 },
  ];

  async function boxes(page: Page) {
    return page.evaluate(() => {
      const r = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      const track = document.querySelector("[data-time-chart-track]")!;
      const note = document.querySelector("[data-tc-note]")!;
      return {
        track: r(track),
        labels: [...track.querySelectorAll("[data-tc-ref], [data-tc-you]")].map(r),
        note: r(note),
        below: note.classList.contains("time-chart__note--below"),
      };
    });
  }

  type Rect = { left: number; right: number; top: number; bottom: number };
  const overlap = (a: Rect, b: Rect) =>
    a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const inside = (a: Rect, t: Rect) => a.left >= t.left - 0.5 && a.right <= t.right + 0.5;

  async function check(page: Page, fontScale: number) {
    const b = await boxes(page);
    const all = b.below ? b.labels : [...b.labels, b.note];
    for (const box of all) expect(inside(box, b.track), JSON.stringify(box)).toBe(true);
    const every = [...b.labels, b.note];
    for (let k = 0; k < every.length; k++) {
      for (let m = k + 1; m < every.length; m++) expect(overlap(every[k], every[m]), `${k} vs ${m}`).toBe(false);
    }
    if (b.below) expect(b.note.top).toBeGreaterThanOrEqual(b.track.bottom - 0.5);
    return { ...b, fontScale };
  }

  for (const width of [320, 375, 512]) {
    for (const f of FIELDS) {
      test(`labels never collide at ${width}px — ${f.name}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await seedSolved(page, f.you);
        await stubField(page, rows(f.strangers));
        await openSolved(page);
        await expect(copyLine(page)).toBeVisible();
        const b = await check(page, 1);
        // Item 122: nothing changes at normal text size. Item 125: labels stay 14px.
        expect(b.below).toBe(false);
        await expect(card(page)).not.toHaveClass(/time-chart--tight/);
      });
    }
  }

  // 352 gives 288px of content at 200%: each 1rem gutter is 32px there.
  for (const f of FIELDS) {
    test(`labels never collide at 200% text, 288px of content — ${f.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 352, height: 900 });
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.style.fontSize = "200%";
        });
      });
      await seedSolved(page, f.you);
      await stubField(page, rows(f.strangers));
      await openSolved(page);
      await expect(copyLine(page)).toBeVisible();
      const b = await check(page, 2);
      expect(b.track.right - b.track.left).toBeCloseTo(288, 0);
      if (f.name === "you in the middle") expect(b.below).toBe(true);
      // Item 125: three 14px labels need ~306px here, so they step down to 12px.
      await expect(card(page)).toHaveClass(/time-chart--tight/);
    });
  }
});

test.describe("time chart — when it is absent", () => {
  // Item 23: a failure collapses the slot and nothing else moves.
  test("a failed fetch collapses the slot and leaves the panel intact", async ({ page, consoleGuard }) => {
    // The browser logs the 500 as "Failed to load resource" with no URL in the
    // text, so the guard is scoped by the message's source URL, in this test
    // only. Checked on mobile-webkit as well as Chromium: both report the failed
    // resource's own URL as location().url.
    consoleGuard.allowUrl(/\/api\/times\//);
    await seedSolved(page, 41);
    await stubField(page, [], { status: 500 });
    await openSolved(page);
    await expect(card(page)).toBeHidden();
    await expect(card(page)).toBeEmpty();
    await expect(page.locator('[data-stat-block="this-game"]')).toBeVisible();
    await expect(page.locator('[data-stat-block="streak"]')).toBeVisible();
    await expect(page.locator('[data-stat-block="all-time"]')).toBeVisible();
  });

  test("is absent after a random solve", async ({ page }) => {
    await solveRandom(page);
    await expectActiveScreen(page, "completion");
    await expect(card(page)).toHaveCount(0);
  });

  test("is absent on an archive replay", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => r.url().includes("/api/times/") && requests.push(r.url()));
    await seedHistory(page, [{ date: day(5), tries: 2, answer: 123, seconds: 90, archived: true }]);
    await page.goto(`/archive/${day(5)}`);
    await expectActiveScreen(page, "game");
    await expect(page.locator("[data-time-chart]")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("is absent for a marker, and fetches nothing", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => r.url().includes("/api/times/") && requests.push(r.url()));
    await seedHistory(page, [{ date: day(0), tries: 0, marker: true }]);
    await seedPrefs(page, { saveScore: false });
    await openSolved(page);
    await expect(page.locator("[data-completion-heading]")).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    expect(requests).toEqual([]);
  });
});

// Item 70: the existing configuration and exception list, unchanged — imported
// from the one copy in e2e/helpers/axe.ts.
for (const scheme of ["light", "dark"] as const) {
  test.describe(`time chart — axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("has no serious or critical violations with the card drawn", async ({ page }) => {
      test.slow();
      await seedSolved(page, 41);
      await stubField(page, rows([20, 25, 30, 35, 50, 60, 70, 80, 90, 100, 120]));
      await openSolved(page);
      await expect(copyLine(page)).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
}
