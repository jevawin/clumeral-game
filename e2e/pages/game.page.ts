import type { Page, Locator } from "@playwright/test";

// Game screen (/play). Thin page object: locators + actions only. Solve logic
// lives in helpers/solve.ts so it can be shared and asserted on in specs.
export class GamePage {
  readonly screen: Locator;
  readonly clueList: Locator;
  readonly keypad: Locator;
  readonly submit: Locator;
  readonly feedback: Locator;
  readonly archiveRow: Locator;
  readonly archiveBanner: Locator;
  readonly archiveBack: Locator;
  readonly firstClueTag: Locator;
  readonly tagTip: Locator;
  readonly boardControls: Locator;
  readonly undo: Locator;
  /** Undo's visible label span — "Undo" / "Undo reset". Assert relabelling on
   *  this, not on `undo`: the button also contains the shortcut hint and its
   *  visually-hidden description, which a whole-text match would pick up. */
  readonly undoLabel: Locator;
  readonly undoKey: Locator;
  readonly reset: Locator;
  readonly resetKey: Locator;
  readonly undoMsg: Locator;

  constructor(public readonly page: Page) {
    this.screen = page.locator('[data-screen="game"]');
    this.clueList = page.locator("[data-clue-list]");
    this.keypad = page.locator("[data-keypad]");
    this.submit = page.locator("[data-submit]");
    this.feedback = page.locator("[data-feedback]");
    this.archiveRow = page.locator("[data-archive-row]");
    this.archiveBanner = page.locator("[data-archive-banner]");
    this.archiveBack = page.locator("[data-archive-back]");
    this.firstClueTag = page.locator("[data-clue-tag]").first();
    this.tagTip = page.locator("[data-tag-tip]");
    this.boardControls = page.locator("[data-board-controls]");
    this.undo = page.locator("[data-undo]");
    this.undoLabel = page.locator("[data-undo-label]");
    this.undoKey = page.locator("[data-undo-key]");
    this.reset = page.locator("[data-reset]");
    this.resetKey = page.locator("[data-reset-key]");
    this.undoMsg = page.locator("[data-undo-msg]");
  }

  /** Digit spans inside a box carry `elim` once eliminated. */
  boxDigit(box: number, digit: number): Locator {
    return this.page.locator(`[data-digit="${box}"] .digit-box__grid span`).nth(digit);
  }

  async open(): Promise<void> {
    await this.page.goto("/play");
  }

  digit(i: number): Locator {
    return this.page.locator(`[data-digit="${i}"]`);
  }

  key(d: number): Locator {
    return this.page.locator(`[data-key="${d}"]`);
  }

  async openBox(i: number): Promise<void> {
    await this.digit(i).click();
  }

  async tapKey(d: number): Promise<void> {
    await this.key(d).click();
  }

  async openFirstClueTip(): Promise<void> {
    await this.firstClueTag.click();
  }
}
