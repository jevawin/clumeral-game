import type { Page } from "@playwright/test";

// Time control via Playwright's page.clock. Must be installed BEFORE the first
// navigation for rollover/countdown tests — the app reads "now" at boot.

// Freeze "now" to a fixed instant. Accepts an ISO string or Date.
export async function freezeDate(page: Page, iso: string | Date): Promise<void> {
  await page.clock.install({ time: new Date(iso) });
}

// Advance the frozen clock by a number of milliseconds (ticks timers, countdowns).
export async function advanceBy(page: Page, ms: number): Promise<void> {
  await page.clock.runFor(ms);
}

// Jump forward to a later instant without running every intermediate timer —
// useful for "next day" rollover where you don't want to fire a day of timers.
export async function jumpTo(page: Page, iso: string | Date): Promise<void> {
  await page.clock.setFixedTime(new Date(iso));
}
