import type { Page, Locator } from "@playwright/test";

// Completion screen (/solved). Thin page object: locators + actions only.
export class CompletionPage {
  readonly screen: Locator;
  readonly heading: Locator;
  readonly subheading: Locator;
  readonly stats: Locator;
  readonly countdown: Locator;
  readonly feedbackBtn: Locator;
  readonly links: Locator;

  constructor(public readonly page: Page) {
    this.screen = page.locator('[data-screen="completion"]');
    this.heading = page.locator("[data-completion-heading]");
    this.subheading = page.locator("[data-completion-subheading]");
    this.stats = page.locator("[data-completion-stats]");
    this.countdown = page.locator("[data-completion-countdown]");
    this.feedbackBtn = page.locator("[data-completion-feedback]");
    this.links = page.locator("[data-completion-links]");
  }

  async open(): Promise<void> {
    await this.page.goto("/solved");
  }
}
