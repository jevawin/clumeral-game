import type { Page, Locator } from "@playwright/test";

// SSR /archive list page + the in-app dated replay banner. Thin page object.
export class ArchivePage {
  readonly rows: Locator;
  readonly heading: Locator;
  // Replay banner lives on the game screen once a dated puzzle is opened.
  readonly replayRow: Locator;
  readonly replayBanner: Locator;
  readonly backBtn: Locator;

  constructor(public readonly page: Page) {
    this.rows = page.locator("tr.row");
    this.heading = page.locator("h1");
    this.replayRow = page.locator("[data-archive-row]");
    this.replayBanner = page.locator("[data-archive-banner]");
    this.backBtn = page.locator("[data-archive-back]");
  }

  async open(): Promise<void> {
    await this.page.goto("/archive");
  }

  // The replay link in a row ("Play" button or the number cell anchor).
  rowLink(date: string): Locator {
    return this.page.locator(`tr.row[data-date="${date}"] a[href="/archive/${date}"]`).first();
  }

  // Read the date of the newest row (the archive sorts date-descending, so row 0
  // is today).
  async newestDate(): Promise<string> {
    return (await this.rows.first().getAttribute("data-date")) ?? "";
  }
}
