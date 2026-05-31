# First-Play Octopus Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a player's first game, the octopus "talks" through the `/play` header — typing a scripted 4-step walkthrough in place of the "Clumeral" wordmark — to teach the core mechanic in context.

**Architecture:** A standalone `src/walkthrough.ts` module owns a small step-machine (current index, active flag, timers) and a brand-text typewriter. It listens for `screens:enter` (trigger), `game:box-opened` and `game:digit-eliminated` (gated-step advance). `app.ts` adds two one-line `CustomEvent` dispatches in `openBox` and `toggleDigit`, plus `import './walkthrough.ts'` at the bottom (side-effect init, like `octo.ts`). The step machine's pure advance logic is unit-testable in isolation.

**Tech Stack:** TypeScript (ES2022), Vite + Cloudflare Workers, Vitest (jsdom) for units, Playwright (vite preview / production build) for e2e.

**Spec:** [docs/superpowers/specs/2026-05-31-octopus-walkthrough-design.md](../specs/2026-05-31-octopus-walkthrough-design.md)

**Merge target:** `new-design` (NOT `staging`/`main`).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `index.html:153` | Brand text node — typewriter target | Add `data-brand-text` attr to the `<span>Clumeral</span>` for a clean hook |
| `index.html` (header) | aria-live announcer | Add a visually-hidden `<span data-walkthrough-live aria-live="polite">` inside the header |
| `src/walkthrough.ts` | Step machine + typewriter + event wiring | **Create** |
| `src/app.ts` | Game event dispatches + module init | Modify `openBox`, `toggleDigit`; add import |
| `tests/walkthrough.spec.ts` | Unit tests for step-machine advance logic | **Create** |
| `e2e/octopus-walkthrough.spec.ts` | E2E against production build | **Create** |

### Module shape for `src/walkthrough.ts`

Export a pure, testable core plus an init that wires DOM/events:

```ts
export type StepKind = 'timed' | 'gated' | 'end';
export type GateEvent = 'game:box-opened' | 'game:digit-eliminated';

export interface Step {
  kind: StepKind;
  text: string;
  gate?: GateEvent; // present iff kind === 'gated'
}

export const STEPS: Step[]; // the hardcoded 5-entry array (0..4)

// Pure helper — does the given event advance the machine at this index?
export function gateMatches(step: Step, event: GateEvent): boolean;

// Timing helpers (pure)
export function holdMsFor(text: string): number;
export const TYPE_MS = 45;
export const DELETE_MS = 25;

export function initWalkthrough(): void; // side-effect: wire listeners
```

`STEPS`:

```ts
export const STEPS: Step[] = [
  { kind: 'timed', text: "Looks like it's your first time here…" },
  { kind: 'timed', text: "The goal: work out the 3-digit number." },
  { kind: 'gated', text: "Tap one of those big digit boxes to open it…", gate: 'game:box-opened' },
  { kind: 'gated', text: "Now disable digits it can't be, using the clues.", gate: 'game:digit-eliminated' },
  { kind: 'end',   text: "" },
];
```

`holdMsFor`:

```ts
export function holdMsFor(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const ms = Math.round((words / 200) * 60_000) + 1000; // 200 wpm + 1s buffer
  return Math.max(ms, 2000); // 2s floor
}
```

---

## Task 1: Add DOM hooks (brand text attr + aria-live region)

**Files:**
- Modify: `index.html:153` (brand `<span>`) and the header block (`index.html:146-159`)

- [ ] **Step 1: Add `data-brand-text` to the wordmark span**

Change:
```html
<span class="text-xl font-bold text-text font-[Comfortaa]">Clumeral</span>
```
to:
```html
<span data-brand-text class="text-xl font-bold text-text font-[Comfortaa]">Clumeral</span>
```

- [ ] **Step 2: Add a visually-hidden aria-live region inside the header**

Insert immediately before the closing `</header>` (after the menu button, `index.html` ≈ line 158):
```html
<span data-walkthrough-live aria-live="polite" class="sr-only"></span>
```
If `sr-only` is not defined in this Tailwind v4 setup, use an inline clip instead:
```html
<span data-walkthrough-live aria-live="polite" class="absolute w-px h-px overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap border-0 -m-px p-0"></span>
```

Verify which to use:
Run: `grep -rn "sr-only" src/tailwind.css index.html`
If it returns a definition or existing usage, use `sr-only`; else use the inline clip classes.

- [ ] **Step 3: Verify build still compiles**

Run: `npm run build`
Expected: build succeeds, `dist/` produced, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(214): add brand-text + aria-live hooks for walkthrough"
```

---

## Task 2: Step-machine core + unit tests (TDD)

**Files:**
- Create: `src/walkthrough.ts` (core constants/types/pure helpers only in this task)
- Test: `tests/walkthrough.spec.ts`

- [ ] **Step 1: Write the failing unit test**

Create `tests/walkthrough.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { STEPS, gateMatches, holdMsFor, TYPE_MS, DELETE_MS } from '../src/walkthrough.ts';

describe('walkthrough step machine', () => {
  it('has the 4-step flow plus an end step', () => {
    expect(STEPS).toHaveLength(5);
    expect(STEPS[0].kind).toBe('timed');
    expect(STEPS[1].kind).toBe('timed');
    expect(STEPS[2].kind).toBe('gated');
    expect(STEPS[3].kind).toBe('gated');
    expect(STEPS[4].kind).toBe('end');
  });

  it('gated steps carry the matching game event', () => {
    expect(STEPS[2].gate).toBe('game:box-opened');
    expect(STEPS[3].gate).toBe('game:digit-eliminated');
  });

  it('gateMatches advances only on the step’s own event', () => {
    expect(gateMatches(STEPS[2], 'game:box-opened')).toBe(true);
    expect(gateMatches(STEPS[2], 'game:digit-eliminated')).toBe(false);
    expect(gateMatches(STEPS[3], 'game:digit-eliminated')).toBe(true);
    expect(gateMatches(STEPS[3], 'game:box-opened')).toBe(false);
  });

  it('gateMatches is false for non-gated steps', () => {
    expect(gateMatches(STEPS[0], 'game:box-opened')).toBe(false);
    expect(gateMatches(STEPS[4], 'game:digit-eliminated')).toBe(false);
  });

  it('holdMsFor: 200 wpm + 1s buffer, 2s floor', () => {
    expect(holdMsFor('one two three four five six seven')).toBe(Math.max(Math.round((7 / 200) * 60_000) + 1000, 2000));
    expect(holdMsFor('hi')).toBe(2000); // floor
    expect(holdMsFor('   ')).toBe(2000); // no words → floor
  });

  it('type is slower than delete', () => {
    expect(TYPE_MS).toBe(45);
    expect(DELETE_MS).toBe(25);
    expect(DELETE_MS).toBeLessThan(TYPE_MS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/walkthrough.spec.ts`
Expected: FAIL — cannot resolve `../src/walkthrough.ts`.

- [ ] **Step 3: Write the minimal core**

Create `src/walkthrough.ts`:
```ts
// Clumeral — walkthrough.ts
// First-play octopus walkthrough: the mascot "talks" through the /play header,
// typing a scripted tutorial in place of the "Clumeral" wordmark.
// Frontend-only. No worker/API changes. Triggered on a player's first game
// (suppressed once `dlng_history` exists). See
// docs/superpowers/specs/2026-05-31-octopus-walkthrough-design.md.

export type StepKind = 'timed' | 'gated' | 'end';
export type GateEvent = 'game:box-opened' | 'game:digit-eliminated';

export interface Step {
  kind: StepKind;
  text: string;
  gate?: GateEvent;
}

export const STEPS: Step[] = [
  { kind: 'timed', text: "Looks like it's your first time here…" },
  { kind: 'timed', text: "The goal: work out the 3-digit number." },
  { kind: 'gated', text: "Tap one of those big digit boxes to open it…", gate: 'game:box-opened' },
  { kind: 'gated', text: "Now disable digits it can't be, using the clues.", gate: 'game:digit-eliminated' },
  { kind: 'end',   text: "" },
];

export const TYPE_MS = 45;
export const DELETE_MS = 25;

// True iff `event` is the gate this step is waiting on.
export function gateMatches(step: Step, event: GateEvent): boolean {
  return step.kind === 'gated' && step.gate === event;
}

// Reading-time hold: 200 wpm + 1s buffer, 2s floor.
export function holdMsFor(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const ms = Math.round((words / 200) * 60_000) + 1000;
  return Math.max(ms, 2000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/walkthrough.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/walkthrough.ts tests/walkthrough.spec.ts
git commit -m "feat(214): walkthrough step-machine core + unit tests"
```

---

## Task 3: Typewriter + runtime wiring (the `initWalkthrough` side-effect)

**Files:**
- Modify: `src/walkthrough.ts` (append runtime code under the pure core)

This task adds the DOM-driven runtime. It is exercised by the e2e suite (Task 5), not unit tests — it depends on real timers, `requestAnimationFrame`, and layout. Keep all pure logic in the exports from Task 2 so the unit tests stay valid.

- [ ] **Step 1: Append the runtime to `src/walkthrough.ts`**

Add below the pure core:
```ts
// ─── Runtime (DOM + timers) ──────────────────────────────────────────────────

const REDUCED_MOTION = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

let active = false;
let stepIndex = 0;
let waitingGate: GateEvent | null = null;
const timers: ReturnType<typeof setTimeout>[] = [];

function later(fn: () => void, ms: number): void {
  timers.push(setTimeout(fn, ms));
}

function clearTimers(): void {
  for (const t of timers) clearTimeout(t);
  timers.length = 0;
}

function brandTextEl(): HTMLElement | null {
  return document.querySelector('[data-brand-text]');
}

function liveEl(): HTMLElement | null {
  return document.querySelector('[data-walkthrough-live]');
}

function announce(text: string): void {
  const el = liveEl();
  if (el) el.textContent = text;
}

function setBrand(text: string): void {
  const el = brandTextEl();
  if (el) el.textContent = text;
}

// Fade the wordmark out (≈250ms), empty it, then run `onDone`.
function fadeOutWordmark(onDone: () => void): void {
  const el = brandTextEl();
  if (!el) { onDone(); return; }
  if (REDUCED_MOTION()) { el.textContent = ''; onDone(); return; }
  el.style.transition = 'opacity 0.25s ease-out';
  el.style.opacity = '0';
  later(() => {
    el.textContent = '';
    el.style.opacity = '1'; // text is empty, so safe to restore opacity now
    onDone();
  }, 260);
}

// Type `text` in char-by-char, then `onDone`. Reduced-motion sets it instantly.
function typeIn(text: string, onDone: () => void): void {
  if (REDUCED_MOTION()) { setBrand(text); onDone(); return; }
  let i = 0;
  const tick = () => {
    i++;
    setBrand(text.slice(0, i));
    if (i < text.length) later(tick, TYPE_MS);
    else onDone();
  };
  setBrand('');
  later(tick, TYPE_MS);
}

// Delete the current brand text char-by-char, then `onDone`.
function deleteOut(onDone: () => void): void {
  const el = brandTextEl();
  const text = el?.textContent ?? '';
  if (REDUCED_MOTION()) { setBrand(''); onDone(); return; }
  let i = text.length;
  const tick = () => {
    i--;
    setBrand(text.slice(0, Math.max(i, 0)));
    if (i > 0) later(tick, DELETE_MS);
    else onDone();
  };
  later(tick, DELETE_MS);
}

// Restore the wordmark and tear down. Idempotent.
function finish(): void {
  if (!active) return;
  active = false;
  waitingGate = null;
  clearTimers();
  const el = brandTextEl();
  if (el) { el.style.transition = ''; el.style.opacity = '1'; }
  setBrand('Clumeral');
}

function runStep(index: number): void {
  if (!active) return;
  stepIndex = index;
  const step = STEPS[index];
  if (!step || step.kind === 'end') { finish(); return; }

  announce(step.text);
  typeIn(step.text, () => {
    if (step.kind === 'timed') {
      later(() => deleteOut(() => runStep(index + 1)), holdMsFor(step.text));
    } else {
      // gated: hold indefinitely until the matching game event arrives
      waitingGate = step.gate ?? null;
    }
  });
}

function onGameEvent(event: GateEvent): void {
  if (!active || waitingGate !== event) return;
  const step = STEPS[stepIndex];
  if (!gateMatches(step, event)) return;
  waitingGate = null;
  deleteOut(() => runStep(stepIndex + 1));
}

function start(): void {
  if (active) return;
  active = true;
  stepIndex = 0;
  waitingGate = null;
  fadeOutWordmark(() => runStep(0));
}

export function initWalkthrough(): void {
  const isNewUser = !localStorage.getItem('dlng_history');

  document.addEventListener('screens:enter', (e) => {
    const screen = (e as CustomEvent).detail?.screen;
    if (screen !== 'game') {
      // Leaving /play mid-sequence reverts the wordmark.
      if (active) finish();
      return;
    }
    if (isNewUser && !active) start();
  });

  document.addEventListener('game:box-opened', () => onGameEvent('game:box-opened'));
  document.addEventListener('game:digit-eliminated', () => onGameEvent('game:digit-eliminated'));
}

initWalkthrough();
```

- [ ] **Step 2: Verify it type-checks and builds**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Verify unit tests still pass (pure core unchanged)**

Run: `npx vitest run tests/walkthrough.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/walkthrough.ts
git commit -m "feat(214): walkthrough typewriter + screen/event runtime"
```

---

## Task 4: Wire game-event dispatches + module init in `app.ts`

**Files:**
- Modify: `src/app.ts` — `openBox` (≈ line 421), `toggleDigit` (≈ line 399), and module imports/init

- [ ] **Step 1: Dispatch `game:box-opened` from `openBox`**

In `openBox(i)` (currently ends with `openKeypad();`), add a dispatch after the keypad opens:
```ts
function openBox(i: number): void {
  activeBox = i;
  // Save active-box selection — daily only (D-06, D-08). Lets restore re-open the right box.
  if (!gameState.isRandom) saveActive(buildActiveState());
  renderAllBoxes();
  buildKeypad();
  openKeypad();
  // First-play walkthrough hook (issue #214). No-op once dlng_history exists.
  document.dispatchEvent(new CustomEvent("game:box-opened"));
}
```

- [ ] **Step 2: Dispatch `game:digit-eliminated` from `toggleDigit` (only on elimination)**

The walkthrough's gated step 3 advances when a digit is *removed* (eliminated), not re-added. Dispatch only in the `s.delete(digit)` branch:
```ts
function toggleDigit(digit: number): void {
  if (activeBox === null) return;
  renderFeedback(null);
  const s = possibles[activeBox];
  if (s.has(digit)) {
    if (s.size === 1) return; // guard: cannot eliminate last digit
    s.delete(digit);
    // First-play walkthrough hook (issue #214). Fires only on elimination. No-op once dlng_history exists.
    document.dispatchEvent(new CustomEvent("game:digit-eliminated"));
  } else {
    s.add(digit);
  }
  // Save mid-game state after every digit mutation — daily only (D-06, D-08).
  if (!gameState.isRandom) saveActive(buildActiveState());
  renderBox(activeBox);
  buildKeypad();
  checkSubmit();
}
```

- [ ] **Step 3: Import the walkthrough module for side-effect init**

`walkthrough.ts` self-initialises via its trailing `initWalkthrough()` call (matching `octo.ts`). Add the import near the other imports at the top of `app.ts` (after the `./octo.ts` import, line 10):
```ts
import './walkthrough.ts';
```

- [ ] **Step 4: Verify build + units**

Run: `npm run build && npx vitest run`
Expected: build succeeds; all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts
git commit -m "feat(214): dispatch game:box-opened + game:digit-eliminated, init walkthrough"
```

---

## Task 5: E2E against the production build

**Files:**
- Create: `e2e/octopus-walkthrough.spec.ts`

Notes for the engineer:
- The suite runs against `vite preview` (production build) — see `playwright.config.ts`. Never disable animations globally.
- A "new user" = no `dlng_history` in localStorage. Set/clear it via `page.addInitScript` before `goto`.
- Reach `/play` directly with `page.goto('/play')`. For a new user the router may redirect to `/welcome` (RTE-03 deep-link rule keys off `dlng_history`). The reliable path: go to `/welcome`, click the start control, land on `/play`. Confirm the start control selector first (`grep -n "data-" src/welcome.ts index.html`). If a direct `/play` load shows the walkthrough in practice, prefer it; otherwise drive through `/welcome`.
- Digit box selector: `[data-digit="0"]`. Keypad digit key: `[data-key="1"]` (avoid the disabled hundreds-place `0`). Brand text: `[data-brand-text]`. Live region: `[data-walkthrough-live]`.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/octopus-walkthrough.spec.ts`:
```ts
import { test, expect, type Page } from "@playwright/test";

// E2E for issue #214 — first-play octopus walkthrough.
// Runs against the PRODUCTION build (vite preview); see playwright.config.ts.

// Navigate a fresh (new-user) session to /play. dlng_history absent → walkthrough runs.
async function gotoPlayAsNewUser(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.removeItem("dlng_history"));
  await page.goto("/welcome");
  // Start control on /welcome navigates to /play (welcome.ts:146).
  await page.locator("[data-start], [data-play], [data-htp-start]").first().click().catch(() => {});
  // Fallback: if still not on the game screen, hit /play directly.
  if (!(await page.locator('[data-digit="0"]').isVisible().catch(() => false))) {
    await page.goto("/play");
  }
  await expect(page.locator('[data-digit="0"]')).toBeVisible();
}

const brand = (p: Page) => p.locator("[data-brand-text]");
const live = (p: Page) => p.locator("[data-walkthrough-live]");

test("walkthrough types into the header on a first visit", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  // The wordmark leaves "Clumeral" and types a tutorial sentence.
  await expect(brand(page)).not.toHaveText("Clumeral", { timeout: 10_000 });
  await expect(brand(page)).toContainText("first time", { timeout: 10_000 });
});

test("aria-live announces the full sentence per step", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  await expect(live(page)).toContainText("first time", { timeout: 10_000 });
});

test("gated step 2 advances only after a digit box is opened", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  // Wait for the box-tap prompt (step 2).
  await expect(brand(page)).toContainText("digit boxes", { timeout: 20_000 });
  // It should hold on this prompt until we open a box.
  await page.waitForTimeout(1500);
  await expect(brand(page)).toContainText("digit boxes");
  // Open a box → advances to step 3.
  await page.locator('[data-digit="0"]').click();
  await expect(brand(page)).toContainText("disable digits", { timeout: 10_000 });
});

test("gated step 3 advances after a digit is eliminated, then restores the wordmark", async ({ page }) => {
  await gotoPlayAsNewUser(page);
  await expect(brand(page)).toContainText("digit boxes", { timeout: 20_000 });
  await page.locator('[data-digit="0"]').click();
  await expect(brand(page)).toContainText("disable digits", { timeout: 10_000 });
  // Hold until a digit is eliminated.
  await page.waitForTimeout(1500);
  await expect(brand(page)).toContainText("disable digits");
  // Eliminate a digit (key "1" — non-disabled in the hundreds box).
  await page.locator('[data-key="1"]').click();
  // Sequence ends → wordmark restored.
  await expect(brand(page)).toHaveText("Clumeral", { timeout: 10_000 });
});

test("returning player sees no walkthrough — wordmark from the start", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("dlng_history", JSON.stringify([{ n: 1, t: 3 }])));
  await page.goto("/play");
  // Either /play renders or redirects; in all cases the brand stays "Clumeral".
  await page.waitForTimeout(2000);
  await expect(brand(page)).toHaveText("Clumeral");
});

test("prefers-reduced-motion: text appears instantly and still advances", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.removeItem("dlng_history"));
  await page.goto("/welcome");
  await page.locator("[data-start], [data-play], [data-htp-start]").first().click().catch(() => {});
  if (!(await page.locator('[data-digit="0"]').isVisible().catch(() => false))) {
    await page.goto("/play");
  }
  await expect(page.locator('[data-digit="0"]')).toBeVisible();
  // Full sentence present immediately (no partial single char).
  await expect(brand(page)).toContainText("first time", { timeout: 5_000 });
});
```

- [ ] **Step 2: Run the e2e suite (builds + serves production)**

Run: `npx playwright test e2e/octopus-walkthrough.spec.ts`
Expected: all tests pass. If selectors are wrong, fix per the real DOM (the welcome start control and box/key attrs), re-run. Adjust copy assertions if the final copy was reworded during build.

- [ ] **Step 3: Run the full e2e suite to confirm no regression**

Run: `npx playwright test`
Expected: existing `octo-celebration` tests still pass alongside the new ones.

- [ ] **Step 4: Commit**

```bash
git add e2e/octopus-walkthrough.spec.ts
git commit -m "test(214): e2e walkthrough against production build"
```

---

## Task 6: Review gates + PR

- [ ] **Step 1: Full verification pass**

Run: `npm run build && npx vitest run && npx playwright test`
Expected: build clean, all units pass, all e2e pass. Capture output as evidence.

- [ ] **Step 2: DA review (fresh-context subagent)** — per [docs/DA-REVIEW.md](../../DA-REVIEW.md). Touches >1 file and changes `/play` behaviour, so required.

- [ ] **Step 3: Self-review** — per [docs/SELF-REVIEW.md](../../SELF-REVIEW.md).

- [ ] **Step 4: Push branch and open PR into `new-design`**

```bash
git push -u origin issue/214
gh pr create --base new-design --title "First-play octopus walkthrough (#214)" --body "..."
```
PR body must note the AC divergence (no skip in v1; suppression by first solve) per the spec, and ask the user to update the issue's AC checklist on close. Do NOT merge — the user merges.

---

## Self-Review (against spec)

**Spec coverage:**
- Trigger first-game-only via `dlng_history` → Task 3 `initWalkthrough` + Task 5 returning-player test. ✓
- No skip control → nothing added; sequence ends by gated completion. ✓
- Wordmark revert at sequence end / on leaving `/play` → `finish()` on `end` step and on non-game `screens:enter`. ✓
- 4-step flow (timed/timed/gated/gated) → `STEPS` (Task 2). ✓
- Hardcoded array, no config file → `STEPS` in-module. ✓
- Typewriter type/hold/delete; logo fades out first (no untype) → `fadeOutWordmark` + `typeIn`/`deleteOut` (Task 3). ✓
- Type 45ms, delete 25ms, hold formula + 2s floor → `TYPE_MS`/`DELETE_MS`/`holdMsFor` (Task 2, unit-tested). ✓
- `prefers-reduced-motion` instant + still advances → `REDUCED_MOTION` branches + Task 5 test. ✓
- aria-live full sentence per step, never per-char → `announce()` in `runStep` only; typewriter writes brand text node, not the live region. ✓
- Two one-line `app.ts` dispatches in `openBox`/`toggleDigit` → Task 4. ✓
- Standalone module imported from `app.ts` like `octo.ts` → Task 3 trailing init + Task 4 import. ✓
- E2E against production build covering all listed cases → Task 5. ✓
- Unit test on step machine → Task 2. ✓
- PR into `new-design`, AC divergence noted → Task 6. ✓

**Placeholder scan:** PR `--body "..."` in Task 6 is filled at PR time (DA/self-review output feeds it); all code steps contain full code. No TBDs.

**Type consistency:** `GateEvent`, `Step`, `STEPS`, `gateMatches`, `holdMsFor`, `TYPE_MS`, `DELETE_MS`, `initWalkthrough` used consistently across Tasks 2–4 and tests.
