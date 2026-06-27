import type { Page, Locator } from "@playwright/test";

// Welcome screen. Thin page object: locators + actions, no assertions.
export class WelcomePage {
  readonly screen: Locator;
  readonly playBtn: Locator;

  constructor(public readonly page: Page) {
    this.screen = page.locator('[data-screen="welcome"]');
    this.playBtn = page.locator("[data-play-btn]");
  }

  async open(): Promise<void> {
    await this.page.goto("/welcome");
  }

  async openRoot(): Promise<void> {
    await this.page.goto("/");
  }

  async play(): Promise<void> {
    await this.playBtn.click();
  }
}
