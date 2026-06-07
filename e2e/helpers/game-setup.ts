import { expect, type Page } from "@playwright/test";
import { seedHistory } from "./storage.ts";
import { expectActiveScreen } from "./screens.ts";

// Land on a playable game board at /play.
//
// RTE-03 redirects: a fresh visitor (no history) bounces to /welcome, and a player
// who already solved today bounces to /solved. So we seed one PAST history entry —
// hasData=true, todayEntry=null → /play renders the game. Past (not today) history
// also keeps the first-play walkthrough off, so solve specs stay deterministic
// (no 5s header animation racing the keypad).
export async function gotoPlayableGame(page: Page): Promise<void> {
  await seedHistory(page, [{ date: "2026-01-01", tries: 3, answer: 123 }]);
  await page.goto("/play");
  await expectActiveScreen(page, "game");
  await expect(page.locator("[data-clue-list]")).toBeVisible();
}
