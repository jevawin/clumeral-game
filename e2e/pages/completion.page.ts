import type { Page, Locator } from "@playwright/test";

// Completion screen (/solved). Thin page object: locators + actions only.
export class CompletionPage {
  readonly screen: Locator;
  readonly heading: Locator;
  readonly subheading: Locator;
  /** The container the three blocks are written into. */
  readonly panel: Locator;
  readonly thisGame: Locator;
  readonly streaks: Locator;
  readonly allTime: Locator;
  readonly goesRows: Locator;
  /** The one polite announcement of the result. */
  readonly live: Locator;
  readonly countdown: Locator;
  readonly feedbackBtn: Locator;
  readonly links: Locator;

  constructor(public readonly page: Page) {
    this.screen = page.locator('[data-screen="completion"]');
    this.heading = page.locator("[data-completion-heading]");
    this.subheading = page.locator("[data-completion-subheading]");
    this.panel = page.locator("[data-completion-panel]");
    this.thisGame = page.locator('[data-stat-block="this-game"]');
    this.streaks = page.locator('[data-stat-block="streaks"]');
    this.allTime = page.locator('[data-stat-block="all-time"]');
    this.goesRows = page.locator("[data-goes-row]");
    this.live = page.locator("[data-completion-live]");
    this.countdown = page.locator("[data-completion-countdown]");
    this.feedbackBtn = page.locator("[data-completion-feedback]");
    this.links = page.locator("[data-completion-links]");
  }

  async open(): Promise<void> {
    await this.page.goto("/solved");
  }

  /** The value shown for a labelled stat, anywhere on the panel. */
  stat(label: string): Locator {
    return this.panel
      .locator(".stat-row, .stat-streak")
      .filter({ has: this.page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
      .locator("dd")
      .first();
  }
}
