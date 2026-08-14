import type { Page, Locator } from "@playwright/test";

// Completion screen (/solved). Thin page object: locators + actions only.
export class CompletionPage {
  readonly screen: Locator;
  readonly heading: Locator;
  readonly subheading: Locator;
  /** The container the three blocks are written into. */
  readonly panel: Locator;
  readonly thisGame: Locator;
  /** Where you are now. */
  readonly streak: Locator;
  /** What you have ever done. */
  readonly records: Locator;
  /** Absent since the averages moved back into All time. Kept so the tests that
   *  assert it has count 0 still say something. */
  readonly average: Locator;
  readonly allTime: Locator;
  /** Every figure column, across Streak and Records. */
  readonly cols: Locator;
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
    this.streak = page.locator('[data-stat-block="streak"]');
    this.records = page.locator('[data-stat-block="records"]');
    this.average = page.locator('[data-stat-block="average"]');
    this.allTime = page.locator('[data-stat-block="all-time"]');
    this.cols = page.locator(".stat-col");
    this.goesRows = page.locator("[data-goes-row]");
    this.live = page.locator("[data-completion-live]");
    this.countdown = page.locator("[data-completion-countdown]");
    this.feedbackBtn = page.locator("[data-completion-feedback]");
    this.links = page.locator("[data-completion-links]");
  }

  async open(): Promise<void> {
    await this.page.goto("/solved");
  }

  /**
   * The value shown for a labelled stat, anywhere on the panel.
   *
   * Two shapes: the all-time rows, whose `dt` is the whole label, and the figure
   * columns, whose `dt` holds a short visible word plus the full one in a
   * visually hidden span. Matching either means the label passed here is always
   * the words a screen reader hears — "Current play streak", not "Current".
   */
  stat(label: string): Locator {
    return this.panel
      .locator(".stat-row, .stat-col")
      .filter({ has: this.page.locator("dt, .sr-only", { hasText: new RegExp(`^${label}$`) }) })
      .locator("dd")
      .first();
  }
}
