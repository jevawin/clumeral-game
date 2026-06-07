import type { Page, Locator } from "@playwright/test";

// Feedback modal (<dialog>). Thin page object.
export class FeedbackPage {
  readonly modal: Locator;
  readonly cats: Locator;
  readonly msg: Locator;
  readonly send: Locator;
  readonly close: Locator;

  constructor(public readonly page: Page) {
    this.modal = page.locator("[data-fb-modal]");
    this.cats = page.locator("[data-fb-cats]");
    this.msg = page.locator("[data-fb-msg]");
    this.send = page.locator("[data-fb-send]");
    this.close = page.locator("[data-fb-modal-close]");
  }

  cat(name: "bug" | "suggestion" | "praise"): Locator {
    return this.page.locator(`[data-cat="${name}"]`);
  }
}
