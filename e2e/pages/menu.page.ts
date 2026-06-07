import type { Page, Locator } from "@playwright/test";

// Header burger menu + its items. Thin page object.
export class MenuPage {
  readonly menuBtn: Locator;
  readonly menu: Locator;
  readonly fbBtn: Locator;
  readonly htpBtn: Locator;
  readonly themeToggle: Locator;
  readonly swatches: Locator;

  constructor(public readonly page: Page) {
    this.menuBtn = page.locator("[data-menu-btn]");
    this.menu = page.locator("[data-menu]");
    this.fbBtn = page.locator("[data-menu] [data-fb-btn]");
    this.htpBtn = page.locator("[data-menu] [data-htp-btn]");
    this.themeToggle = page.locator("[data-theme-toggle]");
    this.swatches = page.locator("[data-swatches]");
  }

  async open(): Promise<void> {
    await this.menuBtn.click();
  }

  swatch(name: string): Locator {
    return this.page.locator(`[data-swatches] [data-colour="${name}"]`);
  }
}
