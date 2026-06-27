import type { Page } from "@playwright/test";

// localStorage seeders for "returning user" scenarios. Each writes via
// addInitScript so the state is present before the app boots, on every navigation
// in the context. Shapes mirror src/storage.ts, src/theme.ts, src/colours.ts.

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  tries: number;
  answer?: number;
}

// Seed solve history (drives completion stats, streaks, "already played today").
export async function seedHistory(page: Page, entries: HistoryEntry[]): Promise<void> {
  await page.addInitScript((data) => {
    localStorage.setItem("dlng_history", JSON.stringify(data));
  }, entries);
}

// Seed preferences. Default app pref is { saveScore: true }.
export async function seedPrefs(page: Page, prefs: { saveScore?: boolean } = {}): Promise<void> {
  await page.addInitScript((data) => {
    localStorage.setItem("dlng_prefs", JSON.stringify({ saveScore: true, ...data }));
  }, prefs);
}

// Seed the analytics/beacon user id.
export async function seedUid(page: Page, uid = "e2e-uid"): Promise<void> {
  await page.addInitScript((id) => {
    localStorage.setItem("dlng_uid", id);
  }, uid);
}

// Seed theme ("dark" | "light") and/or accent colour name.
export async function seedTheme(
  page: Page,
  opts: { theme?: "dark" | "light"; colour?: string } = {},
): Promise<void> {
  await page.addInitScript((o) => {
    if (o.theme) localStorage.setItem("dlng_theme", o.theme);
    if (o.colour) localStorage.setItem("dlng_colour", o.colour);
  }, opts);
}

// Mark the player as having visited today (suppresses the stale-day rollover).
export async function seedLastVisit(page: Page, date: string): Promise<void> {
  await page.addInitScript((d) => {
    localStorage.setItem("dlng_last_visit_date", d);
  }, date);
}
