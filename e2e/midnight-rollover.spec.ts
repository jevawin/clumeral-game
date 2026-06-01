import { test, expect, type Page } from "@playwright/test";

// Regression suite — friend's bug report on new-design (quick task 260601-auy).
//
// ROOT CAUSE A (bugs 1-3): the worker keyed the daily puzzle on UTC while the
// client keys completion + streak on LOCAL date. For a UK user in BST (UTC+1),
// between 00:00 and 01:00 local the two diverged — yesterday's puzzle served,
// the solve recorded under a date todayEntry() never looks up. Fix: the client
// sends its local date to /api/puzzle and the worker serves that date (bounded
// by the existing +1-day isFuturePuzzleDate tolerance), so puzzle, recordGame,
// and todayEntry all key on the same local day.
//
// ROOT CAUSE B (bug 4): the worker-rendered /archive page shipped the old
// <a href="/" class="brand"> markup — a full nav to / that resolves to the
// welcome (how-to) screen. Fix: it's now a no-nav bounce button like the SPA.

// 2026-05-31 23:30:00Z === 2026-06-01 00:30 BST (UTC+1): browser-local "today"
// is 2026-06-01 while UTC "today" is still 2026-05-31 — the divergence window.
const MIDNIGHT_WINDOW = new Date("2026-05-31T23:30:00Z");
const LOCAL_TODAY = "2026-06-01";

async function seedSolvedToday(page: Page) {
  await page.clock.install({ time: MIDNIGHT_WINDOW });
  await page.addInitScript((today) => {
    // A finished solve recorded — as the fixed client does — under the LOCAL date.
    localStorage.setItem(
      "dlng_history",
      JSON.stringify([{ date: today, tries: 2, answer: 123 }]),
    );
    localStorage.setItem("dlng_uid", "regr-uid");
    localStorage.setItem("dlng_last_visit_date", today);
  }, LOCAL_TODAY);
}

test.describe("worker: /api/puzzle honours an in-range client ?date=", () => {
  test("serves the requested past date verbatim", async ({ request }) => {
    // A past date is always in range — no coupling to the host's wall clock.
    const res = await request.get("/api/puzzle?date=2026-03-10");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.date).toBe("2026-03-10");
    expect(Array.isArray(body.clues)).toBeTruthy();
  });

  test("falls back to UTC today for a future date (guard rejects today+2)", async ({ request }) => {
    const res = await request.get("/api/puzzle?date=2030-01-01");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.date).not.toBe("2030-01-01");
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("falls back to UTC today for a malformed date", async ({ request }) => {
    const res = await request.get("/api/puzzle?date=not-a-date");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

test.describe("client keys the puzzle day on the browser-local date", () => {
  test.use({ timezoneId: "Europe/London", locale: "en-GB" });

  test("loadPuzzle requests /api/puzzle with the local date", async ({ page }) => {
    await page.clock.install({ time: MIDNIGHT_WINDOW });
    const req = page.waitForRequest((r) => r.url().includes("/api/puzzle?date="));
    await page.goto("/play");
    const url = new URL((await req).url());
    expect(url.searchParams.get("date")).toBe(LOCAL_TODAY);
  });

  test("a puzzle solved under the local date is recognised — /play redirects to the solved view, not a fresh board", async ({ page }) => {
    await seedSolvedToday(page);

    await page.goto("/play");

    // todayEntry() now matches the seeded solve (both keyed on local today), so
    // the resolver treats today as solved and sends /play → /solved. Pre-fix it
    // found nothing and rendered a fresh, playable board for an already-solved
    // puzzle.
    await expect(page.locator('[data-screen="completion"]')).not.toHaveAttribute("aria-hidden", "true");
    await expect(page.locator('[data-screen="game"]')).toHaveAttribute("aria-hidden", "true");
  });

  test("the Stats link reaches the completion/stats screen, not the how-to screen", async ({ page }) => {
    await seedSolvedToday(page);
    await page.goto("/solved");

    // todayEntry() now matches (solve keyed on local today), so /solved resolves
    // to the completion screen — the stats are shown, not the welcome/how-to.
    await expect(page.locator('[data-screen="completion"]')).not.toHaveAttribute("aria-hidden", "true");
    await expect(page.locator('[data-screen="welcome"]')).toHaveAttribute("aria-hidden", "true");
  });
});

test.describe("archive brand bounces in place", () => {
  test("clicking 'Clumeral' on /archive does NOT navigate to the how-to screen", async ({ page }) => {
    await page.goto("/archive");

    const brand = page.locator("button.brand");
    await expect(brand).toBeVisible(); // it's a button now, not a link
    expect(await page.locator('a.brand[href="/"]').count()).toBe(0);

    await brand.click();
    // Give any (incorrect) navigation a chance to happen, then assert we stayed.
    await page.waitForTimeout(300);
    expect(new URL(page.url()).pathname).toBe("/archive");
  });
});
