# Phase 5: Celebration + Completion — Research

**Researched:** 2026-04-12
**Domain:** Canvas animation timing, DOM side-effect sequencing, localStorage stats computation, screen transitions
**Confidence:** HIGH

## Summary

Phase 5 has an unusual advantage: everything it needs already exists and works. The octopus animation (`celebrateOcto`), bubbles canvas (`launchBubbles`), screen transitions (`showScreen`), and history storage (`loadHistory`) are all in place. The work is compression and wiring, not new construction.

The main technical challenge is making `celebrateOcto` skippable and callback-driven. Right now it returns `void` and manages its own lifecycle entirely — no hook for when it ends, no way to cut it short. Changing this signature is the most complex single task in the phase.

A secondary complexity is streak computation. `loadHistory()` returns `{date, tries}[]` sorted newest-first. Walking it to compute both current streak and max streak requires careful date arithmetic — specifically handling the edge case where today's game is included (which it always is, since the completion screen only shows after a correct answer).

The UI-SPEC (05-UI-SPEC.md) is already approved and provides exact timing numbers, layout specs, copy, and colour assignments. The planner should treat it as locked design contract rather than something to derive.

**Primary recommendation:** Treat this as three distinct sub-tasks — (1) modify `celebrateOcto` to be callback-driven and skippable, (2) build the completion screen markup and stat/countdown rendering, (3) wire the correct-answer handler to orchestrate celebration → completion.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Shorten `celebrateOcto()` from ~5.5s to ~3s total. Same visual (octo flies, bubbles rise) but compressed timing.
- **D-02:** After celebration ends, octo returns to header slot, then standard cross-fade transition to completion screen.
- **D-03:** Celebration is skippable — tap anywhere during animation cuts it short. Octo snaps back to header, cross-fade to completion.
- **D-04:** `launchBubbles()` duration should match the shortened celebration (~3s).
- **D-05:** Four stats in a 2×2 grid: games played, avg tries, current streak, max streak. No "win %" stat.
- **D-06:** Streaks computed from existing `loadHistory()` data by walking consecutive dates. No new localStorage fields.
- **D-07:** No "last 5 games" dots — just the four stat boxes.
- **D-08:** Centred vertical stack: heading → stats grid (2×2) → next-puzzle countdown → feedback button.
- **D-09:** Heading shows puzzle number and tries: "Puzzle #142 solved!" / "You got it in 2 tries".
- **D-10:** Next puzzle countdown timer (hours/minutes until midnight reset). Pulled from ENH-01 into this phase.
- **D-11:** Game header (logo, puzzle number, menu) stays visible on completion screen. Octopus in header slot after celebration.
- **D-12:** Feedback button opens the Phase 4 modal via existing `[data-fb-header-btn]` trigger.
- **D-13:** When `prefers-reduced-motion` is active, skip celebration entirely — cross-fade directly from game screen to completion.
- **D-14:** Cross-fade transitions are kept under reduced motion (opacity transitions aren't "motion").

### Claude's Discretion
- Exact timing breakdown within the ~3s celebration (lead-in, fly, return durations)
- Stats grid visual styling (font sizes, spacing, labels)
- Countdown timer format (e.g., "Next puzzle in 4h 23m" vs "04:23:15")
- Heading copy and tone
- Feedback button styling (accent fill, outline, text-only)
- How the "skip" tap listener is registered and cleaned up
- Bubble count and speed adjustments for shorter animation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CEL-01 | Octopus swims up from bottom with bubbles on correct answer (~3s) | UI-SPEC timing contract: lead-in 200ms + fly 2000ms + return 400ms = 2600ms total. `TOTAL_MS` in bubbles.ts changes to 3200ms. |
| CEL-02 | Celebration animation completes, then completion screen appears | `celebrateOcto()` needs `onComplete: () => void` callback parameter. Caller passes `() => showScreen('completion')`. Both natural-end and skip paths call it. |
| CEL-03 | Celebration respects prefers-reduced-motion | Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` in correct-answer handler before calling celebration. If true, skip to `showScreen('completion')` directly. `launchBubbles()` already self-guards. |
| CMP-01 | Completion screen shows basic stats: games played, avg tries, current streak, max streak | Walk `loadHistory()` array for streak computation. Render into `[data-screen="completion"]` shell in index.html. |
| CMP-02 | Completion screen shows feedback prompt (button opens feedback modal) | Button fires click on `[data-fb-header-btn]` — already wired by Phase 4. |
| CMP-03 | Stats read from existing localStorage game history | `loadHistory()` in storage.ts returns `HistoryEntry[]`. No new storage fields needed. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | All source | Already in project |
| Tailwind CSS v4 | 4.2.2 | Completion screen styling | Phase 1 decision — project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web Animations API | Native | None needed — CSS keyframes already in place | — |
| `window.matchMedia` | Native | Reduced motion check | In correct-answer handler, before `celebrateOcto()` |
| `requestAnimationFrame` | Native | Already used inside `celebrateOcto` and `launchBubbles` | Timing control within animation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `animation-duration` change (style.css) | Web Animations API `effect.updateTiming()` | CSS is simpler — single constant change |
| Callback parameter on `celebrateOcto` | Returning a Promise | Callback matches existing `springBounce` / `revealOcto` pattern in the file — more consistent |

**Installation:** No new packages. This phase is pure TypeScript + existing project tools.

---

## Architecture Patterns

### Files Changed in This Phase
```
src/
├── octo.ts          # celebrateOcto() — add callback param, skip support, compress timing
├── bubbles.ts       # TOTAL_MS + randomDuration() — compress to ~3s
├── style.css        # .celebrating animation-duration: 2s; LEAD_IN_MS constant ref
├── app.ts           # correct-answer handler — orchestrate reduced-motion check, celebration, completion
└── index.html       # [data-screen="completion"] — add completion content markup
```

New file (optional, discretion):
```
src/
└── completion.ts    # renderCompletion() — render stats, heading, countdown into completion screen
                     # Follows module pattern: module-scoped DOM cache, one exported init function
```

### Pattern 1: Callback-driven animation

`celebrateOcto` currently runs fire-and-forget. The pattern for other animations in `octo.ts` (e.g., `springBounce`, `revealOcto`) uses a callback parameter:

```typescript
// Source: src/octo.ts — existing springBounce pattern
function springBounce(cb?: () => void) {
  // ... animation loop ...
  else { octoWrapEl!.style.transform = ''; if (cb) cb(); }
}
```

`celebrateOcto` should follow the same pattern:

```typescript
export function celebrateOcto(onComplete?: () => void): void {
  // ... animation runs ...
  // At natural end (inside the final setTimeout):
  octoAnimating = false;
  cleanup();
  if (onComplete) onComplete();
}
```

### Pattern 2: Skip tap listener with cleanup function

```typescript
// Source: 05-UI-SPEC.md skip contract
const cleanup = () => {
  document.body.removeEventListener('click', onSkip);
  document.body.removeEventListener('touchstart', onSkip);
};

const onSkip = () => {
  cleanup();
  // cancel in-flight timeouts (stored in refs)
  // snap octo back to header instantly
  octoAnimating = false;
  if (onComplete) onComplete();
};

document.body.addEventListener('click', onSkip, { once: true });
document.body.addEventListener('touchstart', onSkip, { once: true });
```

**Key:** `{ once: true }` means the listener self-removes after first fire. The `cleanup` function is still needed for the natural-end path to remove the unused listener.

### Pattern 3: Timeout cancellation for skip support

The current `celebrateOcto` uses two raw `setTimeout` calls — the return-animation trigger and the cleanup. These must be stored in refs so the skip path can cancel them:

```typescript
// Source: current src/octo.ts celebrateOcto structure
let returnTimer: ReturnType<typeof setTimeout>;
let cleanupTimer: ReturnType<typeof setTimeout>;

// Replace:
setTimeout(() => { /* return anim */ }, 2200);

// With:
returnTimer = setTimeout(() => { /* return anim */ }, 2200);

// In skip handler:
clearTimeout(returnTimer);
clearTimeout(cleanupTimer);
```

### Pattern 4: Reduced motion gate in correct-answer handler

```typescript
// Source: 05-UI-SPEC.md D-13, D-14
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  showScreen('completion');
} else {
  launchBubbles();
  celebrateOcto(() => showScreen('completion'));
}
```

`launchBubbles()` already self-guards with its own `matchMedia` check, so calling it is safe either way. But skipping it under reduced motion is cleaner (no redundant check).

### Pattern 5: Streak computation from history

`loadHistory()` returns entries sorted newest-first. The current game is always at `history[0]` (just recorded before `renderCompletion` is called):

```typescript
// Source: 05-UI-SPEC.md stats contract + src/storage.ts loadHistory signature
function computeStats(history: HistoryEntry[]): { played: number; avgTries: string; streak: number; bestStreak: number } {
  const played = history.length;
  const avgTries = played > 0
    ? (history.reduce((s, h) => s + h.tries, 0) / played).toFixed(1)
    : '0';

  // Streaks: walk consecutive calendar days, newest-first
  let streak = 0;
  let bestStreak = 0;
  let currentRun = 0;
  let prevDate: Date | null = null;

  for (const entry of history) {
    const d = new Date(entry.date + 'T00:00:00'); // local midnight
    if (!prevDate) {
      currentRun = 1;
    } else {
      const dayDiff = Math.round((prevDate.getTime() - d.getTime()) / 86400000);
      if (dayDiff === 1) {
        currentRun++;
      } else {
        currentRun = 1;
      }
    }
    if (currentRun > bestStreak) bestStreak = currentRun;
    prevDate = d;
  }
  streak = currentRun; // run at position 0 = current streak (ends today)

  // Edge case: if streak loop never ran (empty history), streak = 0
  return { played, avgTries, streak, bestStreak };
}
```

**Important:** `recordGame()` is called before `renderCompletion()`. So `history[0]` is today's entry. The streak count from position 0 is the current streak including today.

### Pattern 6: Countdown computation

```typescript
// Source: 05-UI-SPEC.md countdown contract
function formatCountdown(): string | null {
  if (gameState.isRandom) return null; // hide for random puzzles
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // next local midnight
  const msUntil = midnight.getTime() - now.getTime();
  const hours = Math.floor(msUntil / 3600000);
  const minutes = Math.floor((msUntil % 3600000) / 60000);
  if (hours > 0) return `Next puzzle in ${hours}h ${minutes}m`;
  return `Next puzzle in ${minutes}m`;
}
```

Static display — computed once at render time. No live tick (per D-10 and UI-SPEC).

### Pattern 7: DOM cache pattern for completion screen

```typescript
// Source: existing project pattern from src/app.ts
const completionDom = {
  heading: document.querySelector('[data-completion-heading]') as HTMLElement | null,
  subheading: document.querySelector('[data-completion-subheading]') as HTMLElement | null,
  stats: document.querySelector('[data-completion-stats]') as HTMLElement | null,
  countdown: document.querySelector('[data-completion-countdown]') as HTMLElement | null,
};
```

Elements get `data-*` attributes in `index.html`. DOM cache initialised at module load — no repeated `querySelector` calls per render.

### Anti-Patterns to Avoid
- **Polling for animation end:** Don't use `setInterval` to check if animation completed. Use the existing callback/setTimeout structure.
- **New state shape in localStorage:** D-06 explicitly forbids new fields. Compute streaks from existing `{date, tries}[]` on every render.
- **Timers without refs:** Any `setTimeout` inside `celebrateOcto` that must be cancellable needs a ref. Bare `setTimeout(fn, ms)` calls block skip support.
- **`animation: none` in reduced motion for cross-fade:** The opacity cross-fade on screen transitions is explicitly kept under reduced motion (D-14). Don't add the completion screen to any `prefers-reduced-motion` animation-none rules.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screen cross-fade | Custom opacity transition | `showScreen('completion')` in screens.ts | Already built with View Transition API + fallback |
| Feedback modal trigger | New modal open logic | `document.querySelector('[data-fb-header-btn]')?.click()` | Phase 4 wired this — any other approach creates two modal paths |
| Canvas cleanup after bubbles | Manual remove timer | Already handled — `launchBubbles` removes canvas at `elapsed > TOTAL_MS` | Adding a second removal path causes double-remove errors |

**Key insight:** Every mechanism this phase needs already exists. The phase is about compression (timing), extension (callback + skip), and wiring (correct-answer handler → completion screen).

---

## Common Pitfalls

### Pitfall 1: `celebrateOcto` timeout offset arithmetic

**What goes wrong:** The return-animation `setTimeout` is `5100 + 350` ms (fly duration + lead-in). Changing the fly duration to 2000ms and lead-in to 200ms means the new offset is `2000 + 200 = 2200`. Forgetting to update both the CSS animation duration AND the JavaScript timeout means they desync — the JS cleanup fires while the CSS animation is still running (or has already ended).

**Why it happens:** The timeout offset is hardcoded in `octo.ts` as a literal `5100 + 350`, not derived from named constants. The CSS animation duration is separately defined in `style.css`.

**How to avoid:** Change three values in sync:
1. `LEAD_IN_MS` constant in `octo.ts`: `350 → 200`
2. `animation: octo-fly 5s` in `style.css`: `5s → 2s`
3. `setTimeout(fn, 5100 + 350)` in `octo.ts`: `5100 + 350 → 2000 + 200`

**Warning signs:** Octo snaps to header before animation visually ends, or animation continues after octo is supposed to have returned.

### Pitfall 2: `octoAnimating` flag blocks skip

**What goes wrong:** The skip handler calls `onComplete()` and sets `octoAnimating = false`. But if the return transition `setTimeout` fires later (wasn't cancelled), it resets `position` and clears `octoAnimating` again — potentially interrupting the completion screen or a subsequent animation.

**Why it happens:** Multiple setTimeout closures in `celebrateOcto` all reference `octoAnimating` and manipulate `octoWrapEl`. If only some are cancelled, the others still run.

**How to avoid:** Store ALL timeouts in module-scoped refs. Cancel all of them in the skip path. After skip, `octoWrapEl` styles must be fully reset inline (no reliance on the return-animation transition).

### Pitfall 3: Date parsing in streak computation

**What goes wrong:** `new Date('2026-04-12')` parses as UTC midnight, not local midnight. On timezones west of UTC, this can mean the date reads as April 11 locally — causing streak miscount.

**Why it happens:** ISO date strings without a time component are treated as UTC by the JS spec.

**How to avoid:** Append `T00:00:00` (no timezone suffix) to force local timezone parsing: `new Date(entry.date + 'T00:00:00')`. This matches how the puzzle uses dates in `app.ts` (the date is always the local date when the game was played).

### Pitfall 4: Feedback button doubles modal open

**What goes wrong:** Adding a new click listener on the feedback button directly calls `openModal()` or similar. Phase 4 already attached a listener to `[data-fb-header-btn]`. Two listeners = modal opens twice (or with animation glitches).

**Why it happens:** Easier to wire directly than to understand Phase 4's delegation.

**How to avoid:** The feedback button's action is just: `document.querySelector('[data-fb-header-btn]')?.click()`. This delegates to the existing Phase 4 listener. No second modal-open call.

### Pitfall 5: `octoAnimating` still true when completion screen renders

**What goes wrong:** The completion screen renders while `octoAnimating` is still `true` (set during celebration). This blocks the idle bob animation and the octo click handler. The octo appears frozen in the header on the completion screen.

**Why it happens:** `octoAnimating = false` is set inside the final cleanup `setTimeout` in `celebrateOcto`. The `onComplete` callback fires just before this — so if the callback triggers `showScreen`, `octoAnimating` is still `true` when the completion screen appears.

**How to avoid:** Set `octoAnimating = false` BEFORE calling `onComplete()` in both the natural-end and skip paths.

---

## Code Examples

### Existing `celebrateOcto` cleanup section (lines 302–319 in octo.ts)

```typescript
// Source: src/octo.ts lines 295–319 — the natural-end cleanup block
requestAnimationFrame(() => {
  if (!octoWrapEl) return;
  octoWrapEl.style.transition = 'left 0.6s ease-in-out, top 0.6s ease-in-out, transform 0.6s ease-in-out';
  octoWrapEl.style.left = returnLeft + 'px';
  octoWrapEl.style.top = returnTop + 'px';
  octoWrapEl.style.transform = '';

  setTimeout(() => {
    if (!octoWrapEl) return;
    octoWrapEl.style.position = '';
    octoWrapEl.style.left = '';
    octoWrapEl.style.top = '';
    octoWrapEl.style.margin = '';
    octoWrapEl.style.transition = '';
    octoWrapEl.style.opacity = '1';

    const digitsEl = document.querySelector('[data-digits]') as HTMLElement | null;
    if (digitsEl) digitsEl.classList.add('digit-correct');

    document.body.style.overflow = '';
    exprMode = 'round';
    octoAnimating = false;
    // onComplete() call goes here, AFTER octoAnimating = false
  }, 650);  // <-- change to 400ms per UI-SPEC
});
```

### Existing correct-answer handler (app.ts lines 647–669)

```typescript
// Source: src/app.ts lines 647–669
if (result.correct) {
  gameState.solved = true;
  gameState.answer = guess;
  track("puzzle_complete", tries);
  launchBubbles();
  renderFeedback("correct", guess);
  closeKeypad();
  // ... digit box styling ...
  dom.submitWrap?.classList.add("hidden");
  celebrateOcto();  // <-- needs callback + reduced-motion gate
  if (gameState.isRandom) {
    dom.again?.classList.remove("hidden");
  } else {
    if (saveScore && gameState.date) {
      recordGame(gameState.date, tries, guess);
      renderStats();  // <-- this is the old game-screen stats, not completion screen
    }
    showNextPuzzle();  // <-- this will be replaced/supplemented by showScreen('completion')
  }
}
```

### `launchBubbles` timing constants (bubbles.ts)

```typescript
// Source: src/bubbles.ts lines 7, 47–49
const TOTAL_MS = 6500;  // change to 3200

function randomDuration(): number {
  return 4100 + Math.random() * 900;  // change to: 2000 + Math.random() * 600
}
```

### CSS animation duration (style.css)

```css
/* Source: src/style.css lines 186–189 */
&.celebrating {
  z-index: 9999;
  animation: octo-fly 5s cubic-bezier(0.4, 0, 0.6, 1) forwards;
  /* change 5s → 2s */
}
```

---

## Timing Reference (from UI-SPEC)

| Phase | Old value | New value | Where changed |
|-------|-----------|-----------|---------------|
| `LEAD_IN_MS` (JS constant) | 350ms | 200ms | `src/octo.ts` |
| Lead-in transition string | `350ms` | `200ms` | `src/octo.ts` (inline transition style) |
| `octo-fly` CSS animation | `5s` | `2s` | `src/style.css` `.celebrating` |
| Return-trigger timeout | `5100 + 350` | `2000 + 200` | `src/octo.ts` |
| Return transition | `0.6s` | `0.4s` | `src/octo.ts` (return transition string) |
| Final cleanup timeout | `650ms` | `400ms` | `src/octo.ts` (inner setTimeout) |
| `TOTAL_MS` (bubbles) | `6500` | `3200` | `src/bubbles.ts` |
| `randomDuration` range | `4100–5000ms` | `2000–2600ms` | `src/bubbles.ts` |

Confidence: HIGH — exact values from approved UI-SPEC.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `celebrateOcto()` returns void, no callback | Add `onComplete?: () => void` | This phase | Allows game flow to react to animation end |
| Bubbles run for 6.5s | Bubbles run for 3.2s | This phase | Match shortened celebration |
| Correct answer shows same-screen stats | Cross-fades to completion screen | This phase | Core screen flow change |
| `renderStats()` in game screen | `renderCompletion()` targets completion screen | This phase | Different metrics (streak replaces last-5) |

---

## Open Questions

1. **`showNextPuzzle()` interaction**
   - What we know: `showNextPuzzle()` is called after a correct non-random answer in the current handler. It renders a "Puzzle N is available tomorrow" message and a countdown into `[data-stats]` in the game screen.
   - What's unclear: Does `showNextPuzzle()` still need to run? The completion screen replaces its function. But if `[data-stats]` and `[data-next-number]` in the game screen are still rendered and visible when the user returns (e.g., after closing completion screen), the handler might need `showNextPuzzle()` for that case too.
   - Recommendation: Read `showNextPuzzle()` implementation before writing the correct-answer handler changes. Determine whether completion screen fully replaces it or whether they run together.

2. **Random puzzle correct-answer path**
   - What we know: The random path currently shows `dom.again` (a "Play another random puzzle" link). Decision D-10 says countdown is hidden for random puzzles.
   - What's unclear: Does the completion screen show for random puzzles at all? The UI-SPEC says countdown is hidden for random, but doesn't say the completion screen is skipped entirely.
   - Recommendation: Clarify with the user or treat the completion screen as universal (always shown), just without countdown for random puzzles. The `dom.again` link could move into the completion screen.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend code changes with no external dependencies beyond the existing Vite + TypeScript toolchain.

---

## Validation Architecture

nyquist_validation is `true` in config.json, but this project has no test framework installed. No test scripts exist in `package.json`. No test files exist in `src/` (only a wrangler internal test in `node_modules`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | None available |
| Full suite command | None available |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CEL-01 | Octo celebration runs ~3s | manual-only | — | — |
| CEL-02 | Completion screen appears after celebration | manual-only | — | — |
| CEL-03 | Reduced motion skips animation | manual-only | — | — |
| CMP-01 | Stats show played, avg, streak, best streak | manual-only | — | — |
| CMP-02 | Feedback button opens modal | manual-only | — | — |
| CMP-03 | Stats sourced from localStorage history | manual-only | — | — |

All requirements are DOM/animation/interaction based. No pure-function logic exists that could be unit tested without a DOM environment.

**Exception:** Streak computation (`computeStats`) is a pure function. It could be unit tested without a DOM. However, no test framework is installed, and installing one (vitest, jest) is out of scope for this phase.

### Sampling Rate
- **Per task commit:** Manual browser check — does the changed behaviour work?
- **Per wave merge:** Full manual walkthrough — correct answer → celebration → completion screen → stats visible → feedback button opens modal.
- **Phase gate:** Manual verification per `/gsd:verify-work` checklist before PR.

### Wave 0 Gaps
No test framework to install within phase scope. If unit tests for `computeStats` are desired, that would require:
- [ ] `npm install -D vitest` — adds test runner
- [ ] `vitest.config.ts` — config file
- [ ] `tests/stats.test.ts` — streak computation tests

*(Recommend flagging to user as optional follow-up rather than blocking this phase.)*

---

## Sources

### Primary (HIGH confidence)
- `src/octo.ts` — full `celebrateOcto()` implementation, timing constants, module state
- `src/bubbles.ts` — `TOTAL_MS`, `randomDuration()`, full canvas animation
- `src/screens.ts` — `showScreen()` API, screen state machine
- `src/app.ts` lines 317–336, 645–684 — `renderStats()` and correct-answer handler
- `src/storage.ts` — `loadHistory()` return type and behaviour
- `src/style.css` — `.celebrating`, `octo-fly` keyframe, `octo-colours` keyframe, reduced-motion media query
- `index.html` line 352 — completion screen shell markup
- `.planning/phases/05-celebration-completion/05-UI-SPEC.md` — approved timing values, layout contract, copy
- `.planning/phases/05-celebration-completion/05-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- MDN Web Docs (training data) — `matchMedia`, `{ once: true }` event listener option, `new Date()` UTC vs local parsing

### Tertiary (LOW confidence — none in this phase)
n/a

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything verified from actual source files
- Architecture patterns: HIGH — based on existing patterns in the codebase, not assumptions
- Pitfalls: HIGH — derived from reading the actual code, not generic knowledge
- Timing values: HIGH — taken from approved UI-SPEC

**Research date:** 2026-04-12
**Valid until:** Indefinite (all findings from local source files, not external services)
