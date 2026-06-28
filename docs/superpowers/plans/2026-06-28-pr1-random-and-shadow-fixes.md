# PR 1 — /random and shadow fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two user-facing post-redesign bugs — `/random` throws "Something went wrong" on a correct answer, and digit-box shadows ignore the selected accent colour — and re-add the only `/random` entry link, each guarded by a Playwright regression test.

**Architecture:** Three small, independent changes. (1) `/random` boots without `initRouter`, so the solve path's `replaceRoute('/solved')` calls `ctx()` which throws `router not initialized`; show the completion screen directly for random instead of routing. (2) Add a "Play another random puzzle" link to the random completion screen — the sole `/random` entry point. (3) Replace hardcoded shadow colours with theme tokens (`color-mix` off `--color-text` / `--color-accent`) so shadows follow the active accent and dark mode.

**Tech Stack:** TypeScript, Vite, Tailwind CSS v4 (`@theme` tokens), Cloudflare Workers, Playwright e2e (`@playwright/test`). Local run: `npm run e2e:serve` (build + preview on :4173, seeds local D1). Tests: `npm run test:e2e`.

---

## Background (verified during planning)

- Root cause of the submit crash: [src/router.ts:67-68](../../../src/router.ts#L67) — `ctx()` does `if (!deps) throw new Error('router not initialized')`. The `/random` boot path [src/app.ts:972-975](../../../src/app.ts#L972) calls `showScreen('game'); loadPuzzle();` and never calls `initRouter`, so `deps` stays null. A correct guess runs `handleGuess` → `replaceRoute('/solved')` → `navigate` → `ctx()` → throws → caught at [src/app.ts:741](../../../src/app.ts#L741) → `renderFeedback("error")`. Reproduced locally: correct answer on `/random` shows "Something went wrong — please try again." with completion heading already set to "Puzzle solved!".
- Shadow bug: the active digit-box shadow [src/app.ts:351](../../../src/app.ts#L351) hardcodes `rgba(10,133,10,0.3)` = Lime `#0A850A`. Accent is applied as `--color-accent` ([src/colours.ts:32](../../../src/colours.ts#L32)); the four accents are Lime/Berry/Blue/Violet. On Berry/Blue/Violet the active shadow stays green. The SSR stats page ([src/worker/stats.ts](../../../src/worker/stats.ts)) uses a separate `light-dark()` palette and adapts correctly — **out of scope**.
- Screen state machine toggles `aria-hidden` per `<section data-screen>` ([src/screens.ts:90](../../../src/screens.ts#L90)); `showScreen` is already imported in app.ts. e2e helper `expectActiveScreen` asserts on `aria-hidden`.

## File structure

- Modify `src/app.ts` — solve branch: route to completion screen for random without `replaceRoute`.
- Modify `src/completion.ts` — render the "Play another random puzzle" link when `isRandom`.
- Modify `src/tailwind.css` — add `--shadow-*` theme tokens; fix octo drop-shadow.
- Modify `index.html`, `src/app.ts`, `src/welcome.ts` — swap hardcoded shadow classes for the tokens.
- Create `e2e/specs/random.spec.ts` — random solve + entry-link regressions.
- Create `e2e/specs/shadow-theme.spec.ts` — active-box shadow follows accent.

Out of scope (moved to PR 4): removing the orphaned `data-next`/`data-again` markup and the dead old-completion code path in app.ts (lines 472-474, 501, 525, 552, 636 + dom cache 69-71). It is entangled with live code and is cleanup, not a bug fix.

---

### Task 1: Fix /random correct-answer crash

**Files:**
- Modify: `src/app.ts:710-720` (the `else` branch in `handleGuess`)
- Test: `e2e/specs/random.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `e2e/specs/random.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { solvePuzzle } from "../helpers/solve";
import { expectActiveScreen } from "../helpers/screens";

test.describe("/random", () => {
  test("solving a random puzzle lands on completion without error", async ({ page }) => {
    const tokenResp = page.waitForResponse((r) => r.url().includes("/api/puzzle/random"));
    await page.goto("/random");
    const token = (await (await tokenResp).json()).token as string;

    await solvePuzzle(page, { token });

    // The feedback line must NOT show the generic error.
    const feedback = page.locator("[data-feedback]");
    await expect(feedback).not.toHaveText(/something went wrong/i);
    // Completion screen is shown, heading reflects a solved random puzzle.
    await expectActiveScreen(page, "completion");
    await expect(page.locator("[data-completion-heading]")).toHaveText(/solved/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- e2e/specs/random.spec.ts --project=chromium`
Expected: FAIL — feedback shows "Something went wrong" and/or no completion screen is active (the `replaceRoute('/solved')` throw).

- [ ] **Step 3: Apply the fix**

In `src/app.ts`, replace the `else` branch at lines 710-720:

```ts
      } else {
        // Today's solve: paint the completion screen and replace history (no /play
        // entry to back into; back from /solved goes to /welcome, which itself
        // redirects to /solved post-solve so the back lands on the same screen
        // — effectively making /solved the post-solve home).
        renderCompletion(gameState.puzzleNum ?? 0, tries, !!gameState.isRandom);
        // Fire sync — never inside celebrateOcto's callback. If celebration is
        // interrupted (page hidden, rAF paused) the user could otherwise be
        // stranded on /play with the puzzle solved (#solve-stranding).
        replaceRoute('/solved');
      }
```

with:

```ts
      } else if (gameState.isRandom) {
        // /random boots without initRouter (app.ts boot shows the game screen
        // directly), so the router has no deps and replaceRoute('/solved') would
        // throw `router not initialized`. Random has no /solved URL anyway — show
        // the completion screen directly.
        renderCompletion(gameState.puzzleNum ?? 0, tries, true);
        showScreen('completion');
      } else {
        // Today's solve: paint the completion screen and replace history (no /play
        // entry to back into; back from /solved goes to /welcome, which itself
        // redirects to /solved post-solve so the back lands on the same screen
        // — effectively making /solved the post-solve home).
        renderCompletion(gameState.puzzleNum ?? 0, tries, false);
        // Fire sync — never inside celebrateOcto's callback. If celebration is
        // interrupted (page hidden, rAF paused) the user could otherwise be
        // stranded on /play with the puzzle solved (#solve-stranding).
        replaceRoute('/solved');
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:e2e -- e2e/specs/random.spec.ts --project=chromium`
Expected: PASS — no error feedback, completion screen active, heading "Puzzle solved!".

- [ ] **Step 5: Commit**

```bash
git add src/app.ts e2e/specs/random.spec.ts
git commit -m "fix: /random correct answer no longer throws 'something went wrong'

The /random boot path skips initRouter, so the solve flow's replaceRoute('/solved')
hit ctx()'s 'router not initialized' guard and surfaced the generic error. Show the
completion screen directly for random solves instead of routing.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add the "Play another random puzzle" entry link

**Files:**
- Modify: `src/completion.ts` (inside the `if (dom.links)` block, ~lines 175-208)
- Test: `e2e/specs/random.spec.ts` (add a case)

- [ ] **Step 1: Write the failing test**

Append to the `test.describe("/random", ...)` block in `e2e/specs/random.spec.ts`:

```ts
  test("random completion offers the only /random entry link", async ({ page }) => {
    const tokenResp = page.waitForResponse((r) => r.url().includes("/api/puzzle/random"));
    await page.goto("/random");
    const token = (await (await tokenResp).json()).token as string;
    await solvePuzzle(page, { token });

    const again = page.locator('[data-completion-links] [data-completion-random-again]');
    await expect(again).toBeVisible();
    await expect(again).toHaveAttribute("href", "/random");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- e2e/specs/random.spec.ts --project=chromium`
Expected: FAIL — `[data-completion-random-again]` does not exist.

- [ ] **Step 3: Apply the fix**

In `src/completion.ts`, inside `if (dom.links) { ... }`, after `dom.links.replaceChildren();` and the Show-puzzle block, before the Archive link, add:

```ts
    // Random is a testing page; its only entry link lives here — replay another
    // random puzzle. A plain anchor does a full navigation to /random, which
    // re-runs the cold-boot path (the SPA router is never initialised on /random).
    if (isRandom) {
      const again = document.createElement('a');
      again.href = '/random';
      again.className = 'btn btn-hollow flex-1';
      again.dataset.completionRandomAgain = '';
      again.innerHTML = '<svg aria-hidden="true"><use href="/sprites.svg#icon-puzzle"/></svg>Play another random puzzle';
      dom.links.appendChild(again);
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:e2e -- e2e/specs/random.spec.ts --project=chromium`
Expected: PASS — both random cases green.

- [ ] **Step 5: Commit**

```bash
git add src/completion.ts e2e/specs/random.spec.ts
git commit -m "fix: re-add 'Play another random puzzle' entry link on random completion

The redesign rebuilt the completion screen and dropped the only link to /random.
Render it for random solves; it is intentionally the sole entry point (testing page).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Make shadows follow the theme tokens

**Files:**
- Modify: `src/tailwind.css` (add tokens to `@theme` block ~lines 35-41; fix octo drop-shadow line 122)
- Modify: `index.html` (digit boxes lines 241-243)
- Modify: `src/app.ts` (active/inactive box shadows lines 351, 356-357; keypad button line 384)
- Modify: `src/welcome.ts` (demo boxes lines 64, 95)
- Test: `e2e/specs/shadow-theme.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `e2e/specs/shadow-theme.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Force light mode so the Berry *light* value (#de1f46 = rgb(222,31,70)) applies.
test.use({ colorScheme: "light" });

test("active digit-box shadow follows the selected accent colour", async ({ page }) => {
  // /random loads the game screen with live digit boxes.
  await page.goto("/random");
  await expect(page.locator('[data-digit="0"]')).toBeVisible();

  // Pick the Berry accent via the menu.
  await page.locator("[data-menu-btn]").click();
  await page.locator('[data-swatches] [data-colour="Berry"]').click();
  await page.locator("[data-menu-btn]").click(); // close menu

  // Activate box 0 — this applies the active-state shadow.
  await page.locator('[data-digit="0"]').click();

  const shadow = await page
    .locator('[data-digit="0"]')
    .evaluate((el) => getComputedStyle(el).boxShadow);

  // Berry, not the hardcoded Lime (rgb(10,133,10)).
  expect(shadow).toMatch(/222,\s*31,\s*70/);
  expect(shadow).not.toMatch(/10,\s*133,\s*10/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- e2e/specs/shadow-theme.spec.ts --project=chromium`
Expected: FAIL — computed shadow is `rgb(10, 133, 10)` (Lime), not Berry.

- [ ] **Step 3: Add the shadow tokens**

In `src/tailwind.css`, inside the `@theme { ... }` block (after `--color-border:` at line 40), add:

```css
  /* Offset shadows derive from theme tokens so they follow dark mode and the
     selected accent. --color-text / --color-accent are live custom properties
     (accent is set per-swatch in colours.ts), so color-mix re-resolves on theme
     and accent changes — no dark: variant needed. */
  --shadow-box:        3px 3px 0 color-mix(in srgb, var(--color-text) 12%, transparent);
  --shadow-box-active: 3px 3px 0 color-mix(in srgb, var(--color-accent) 30%, transparent);
  --shadow-key:        2px 2px 0 color-mix(in srgb, var(--color-text) 12%, transparent);
```

- [ ] **Step 4: Fix the octo drop-shadow**

In `src/tailwind.css` line 122, replace:

```css
    filter: drop-shadow(0.125rem 0.1875rem 0 rgba(38, 38, 36, 0.25));
```

with:

```css
    filter: drop-shadow(0.125rem 0.1875rem 0 color-mix(in srgb, var(--color-text) 25%, transparent));
```

- [ ] **Step 5: Swap the digit-box shadows in index.html**

In `index.html`, on each of the three digit-box `<div>`s (lines 241, 242, 243), replace the class fragment:

```
shadow-[3px_3px_0_rgba(38,38,36,0.12)] dark:shadow-[3px_3px_0_#494946]
```

with:

```
shadow-box
```

- [ ] **Step 6: Swap the box shadows in app.ts**

In `src/app.ts`, replace the active-state line 351:

```ts
  el.classList.toggle("shadow-[3px_3px_0_rgba(10,133,10,0.3)]", i === activeBox);
```

with:

```ts
  el.classList.toggle("shadow-box-active", i === activeBox);
```

Then replace the inactive-state lines 356-357:

```ts
  el.classList.toggle("shadow-[3px_3px_0_rgba(38,38,36,0.12)]", i !== activeBox);
  el.classList.toggle("dark:shadow-[3px_3px_0_#494946]", i !== activeBox);
```

with a single toggle:

```ts
  el.classList.toggle("shadow-box", i !== activeBox);
```

Then update the keypad-button class at line 384 — replace:

```ts
        : 'bg-surface text-text border-border shadow-[2px_2px_0_rgba(38,38,36,0.12)] dark:shadow-[2px_2px_0_#494946]'
```

with:

```ts
        : 'bg-surface text-text border-border shadow-key'
```

- [ ] **Step 7: Swap the welcome demo shadows**

In `src/welcome.ts`, on both demo box `<div>`s (lines 64 and 95), replace the class fragment:

```
shadow-[3px_3px_0_rgba(38,38,36,0.12)] dark:shadow-[3px_3px_0_#494946]
```

with:

```
shadow-box
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test:e2e -- e2e/specs/shadow-theme.spec.ts --project=chromium`
Expected: PASS — computed shadow matches Berry `rgb(222, 31, 70)`.

- [ ] **Step 9: Manually verify dark mode + all accents**

Run: `npm run e2e:serve` (if not already running), then drive a quick visual check:

```bash
node -e '
import("@playwright/test").then(async ({ chromium }) => {
  const b = await chromium.launch();
  for (const scheme of ["light","dark"]) {
    const p = await b.newPage({ colorScheme: scheme });
    await p.goto("http://localhost:4173/random");
    await p.locator("[data-digit=\"0\"]").click();
    await p.screenshot({ path: `/tmp/shadow-${scheme}.png`, fullPage: true });
    await p.close();
  }
  await b.close();
});'
```

Read `/tmp/shadow-light.png` and `/tmp/shadow-dark.png`. Confirm: the active box shadow is the accent colour, inactive box/keypad/octo shadows are visible (not invisible) in dark mode. Delete the screenshots when done: `rm -f /tmp/shadow-*.png`.

- [ ] **Step 10: Commit**

```bash
git add src/tailwind.css index.html src/app.ts src/welcome.ts e2e/specs/shadow-theme.spec.ts
git commit -m "fix: shadows follow theme tokens (accent + dark mode)

Active digit-box shadow hardcoded Lime green, so it ignored Berry/Blue/Violet
accents. Replace hardcoded offset shadows with --shadow-* tokens that color-mix
off --color-text / --color-accent, so they track the accent and dark mode. Octo
drop-shadow now derives from --color-text too (was invisible in dark mode).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full verification + open PR

**Files:** none (verification only)

- [ ] **Step 1: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all specs pass (the two new specs plus the existing suite — confirm no regression).

- [ ] **Step 3: Self-review the diff**

Run: `git diff origin/staging...HEAD --stat` and read the full diff. Confirm: only the four source files + two new specs changed; no stray `_tmp_*` files; no hardcoded `rgba(10,133,10` / `#494946` / `rgba(38,38,36` offset-shadow values remain in the swapped files (`grep -rn "rgba(10,133,10\|#494946" src/ index.html` returns nothing).

- [ ] **Step 4: Push and open the PR**

Per [docs/GIT-WORKFLOW.md](../../GIT-WORKFLOW.md): the branch is off `staging`; push and open a PR into `staging`. Do NOT merge — the user merges. Run the DA review (fresh-context subagent) → self-review gates first, per CLAUDE.md, since this touches multiple files and changes puzzle-completion logic + CSS/theming.

```bash
git push -u origin dev/post-redesign-stabilisation
gh pr create --base staging --title "Fix /random solve crash + entry link + theme-aware shadows" --body "<summary + test evidence>"
```

---

## Self-review (planning)

- **Spec coverage:** PR 1 items from the spec — /random submit fix (Task 1), /random entry link (Task 2), shadow token fix (Task 3), a regression test per bug (Tasks 1-3), light+dark verification (Task 3 Step 9). Dead-markup removal is explicitly deferred to PR 4 (documented above + spec note). Covered.
- **Placeholder scan:** PR body summary in Task 4 Step 4 is the only `<...>` — it's a human-written PR description, filled at PR time, not a code placeholder. All code/test steps are concrete.
- **Type/name consistency:** `data-completion-random-again` used consistently in Task 2 fix and test. `shadow-box` / `shadow-box-active` / `shadow-key` token names match between tailwind.css definitions (Task 3 Step 3) and the swaps (Steps 5-7) and the test expectation (Berry rgb). `showScreen` already imported (verified). `solvePuzzle` / `expectActiveScreen` / `readAnswer` signatures match the existing helpers.
