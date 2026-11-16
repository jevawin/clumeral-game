import type { Page, Locator } from "@playwright/test";

// Completion screen (/solved). Thin page object: locators + actions only.
// The panel is cards since the results redesign: Today, the Daily leaderboard,
// Streaks and All time (results brief 14).
export class CompletionPage {
  readonly screen: Locator;
  /** "Puzzle #N solved" — the screen's one h2, inside the Today card. */
  readonly heading: Locator;
  /** The container the cards are written into. */
  readonly panel: Locator;
  /** Every card, in order. */
  readonly cards: Locator;
  readonly today: Locator;
  /** "3 goes, 2m 28s". */
  readonly figures: Locator;
  /** The one line under the figures, full mode only. */
  readonly message: Locator;
  readonly leaderboard: Locator;
  readonly streak: Locator;
  readonly streakLine: Locator;
  readonly allTime: Locator;
  /** The goes strip's scroller: focusable, named by its summary. */
  readonly strip: Locator;
  readonly stripDays: Locator;
  /** The one polite announcement of the result. */
  readonly live: Locator;
  readonly countdown: Locator;
  readonly feedbackBtn: Locator;
  readonly links: Locator;

  constructor(public readonly page: Page) {
    this.screen = page.locator('[data-screen="completion"]');
    this.heading = page.locator("[data-completion-heading]");
    this.panel = page.locator("[data-completion-panel]");
    this.cards = page.locator("[data-completion-panel] > section");
    this.today = page.locator('[data-stat-block="today"]');
    this.figures = page.locator("[data-today-figures]");
    this.message = page.locator("[data-today-message]");
    this.leaderboard = page.locator('[data-stat-block="daily-leaderboard"]');
    this.streak = page.locator('[data-stat-block="streak"]');
    this.streakLine = page.locator("[data-streak-line]");
    this.allTime = page.locator('[data-stat-block="all-time"]');
    this.strip = page.locator("[data-strip-scroller]");
    this.stripDays = page.locator("[data-strip-day]");
    this.live = page.locator("[data-completion-live]");
    this.countdown = page.locator("[data-completion-countdown]");
    this.feedbackBtn = page.locator("[data-completion-feedback]");
    this.links = page.locator("[data-completion-links]");
  }

  async open(): Promise<void> {
    await this.page.goto("/solved");
  }

  /** The value in the All time ledger row whose label is exactly `label`. */
  ledger(label: string): Locator {
    return this.panel
      .locator("[data-ledger-row]")
      .filter({ has: this.page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
      .locator("dd");
  }

  /** The data-stat-block of every card, in order. */
  async cardOrder(): Promise<string[]> {
    return this.cards.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.statBlock ?? ""));
  }
}
