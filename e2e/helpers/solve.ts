import { expect, type Page } from "@playwright/test";

// Read the real 3-digit answer from the local preview Worker. `/api/dev/answer`
// 404s on clumeral.com, so this only works against the local build — if it ever
// runs against prod it fails loudly, which is correct (the suite must not run there).
//
// Without a token it returns today's (UTC) daily answer; with an archive replay
// token it returns that puzzle's answer.
export async function readAnswer(page: Page, token?: string): Promise<number[]> {
  const url = token
    ? `/api/dev/answer?token=${encodeURIComponent(token)}`
    : "/api/dev/answer";
  const res = await page.request.get(url);
  expect(res.ok(), "/api/dev/answer must be reachable on the local preview").toBeTruthy();
  const { answer } = (await res.json()) as { answer: number };
  return String(answer).padStart(3, "0").split("").map(Number);
}

// Reduce each digit box to a single target digit by eliminating the others through
// the real keypad — the genuine box → eliminate → resolve flow, not a shortcut.
//
// Box 0 starts {1..9} (no leading zero; the 0 key is disabled). Boxes 1-2 start
// {0..9}. We click every non-target candidate exactly once; we never click the
// target, so the "cannot eliminate the last digit" guard never trips.
export async function setBoxes(page: Page, digits: number[]): Promise<void> {
  for (let box = 0; box < 3; box++) {
    await page.locator(`[data-digit="${box}"]`).click();
    await expect(page.locator("[data-keypad] [data-key]").first()).toBeVisible();
    for (let d = 0; d <= 9; d++) {
      if (d === digits[box]) continue;
      if (box === 0 && d === 0) continue; // key disabled — no leading zero
      await page.locator(`[data-key="${d}"]`).click();
    }
  }
}

// Solve the puzzle end-to-end and submit. Returns the answer digits for assertions.
export async function solvePuzzle(
  page: Page,
  opts: { token?: string } = {},
): Promise<number[]> {
  const answer = await readAnswer(page, opts.token);
  await setBoxes(page, answer);
  await page.locator("[data-submit]").click();
  return answer;
}

// Resolve all boxes to a deliberately wrong number and submit. Flips the units
// digit so the guess stays a valid 3-digit number but is incorrect.
export async function submitWrongGuess(
  page: Page,
  opts: { token?: string } = {},
): Promise<number[]> {
  const answer = await readAnswer(page, opts.token);
  const wrong = [...answer];
  wrong[2] = (answer[2] + 1) % 10;
  await setBoxes(page, wrong);
  await page.locator("[data-submit]").click();
  return wrong;
}
