# First-play octopus walkthrough — design

**Issue:** [#214](https://github.com/jevawin/clumeral-game/issues/214) · **Date:** 2026-05-31
**Branch:** `issue/214` (off `new-design`) · **Merge target:** `new-design` (NOT `staging`/`main`)

## Goal

On a player's first game, the octopus mascot "talks" through the `/play` header — typing a short
scripted walkthrough in place of the "Clumeral" wordmark — to teach the core mechanic in context.
Frontend-only. No worker/API changes.

## Decisions (resolved open questions)

| Question | Decision |
|---|---|
| Trigger | First game only. No idle nudge, no replay-from-menu (deferred past v1). |
| Persistence | Bound to first game. Suppressor is `dlng_history` existing. No new localStorage key. |
| Skip control | **None** in v1. Sequence ends by completing the gated steps or by solving. |
| Wordmark revert | Only at sequence end or on leaving `/play`. No hover/blur revert. |
| Steps | The issue's 4-step flow, as written. |
| Message source | Hardcoded array in the module. No config file (YAGNI). |
| Typewriter | Letters type in, hold, delete (chat-scene effect). Logo fades out first (no untype). |

## Architecture (Approach A — standalone module + event hooks)

New file `src/walkthrough.ts`, imported and initialised from `app.ts` like `octo.ts`.

It owns:
- the step-machine state (current index, active flag, timers)
- listeners for `screens:enter`, `game:box-opened`, `game:digit-eliminated`
- the brand-text typewriter swap and restore

`app.ts` changes are minimal — two one-line `CustomEvent` dispatches following the existing
pattern (`screens:enter`, `analytics:track`):
- in `openBox`/`selectBox` (≈ app.ts:417–435) → `document.dispatchEvent(new CustomEvent("game:box-opened"))`
- in `toggleDigit` after a digit is removed (≈ app.ts:399–415) → `game:digit-eliminated`

No other game logic is touched. The step machine is unit-testable in isolation.

## Step flow

Hardcoded array:

| # | Type | Message | Advances when |
|---|---|---|---|
| 0 | timed | "Looks like it's your first time here…" | hold elapses |
| 1 | timed | "The goal: work out the 3-digit number." | hold elapses |
| 2 | gated | "Tap one of those big digit boxes to open it…" | `game:box-opened` |
| 3 | gated | "Now disable digits it can't be, using the clues." | `game:digit-eliminated` |
| 4 | end | — | restore wordmark, done |

- **Timed** steps: type → hold → delete → next, automatically.
- **Gated** steps: type → hold (no auto-delete, no advance) until the matching game event → then
  delete → next. Auto-progression never runs while waiting on the user.

Copy is final-draft, not locked — adjust during build/testing if it reads better.

## Typewriter mechanics

- "Clumeral" fades out (opacity transition ≈ 250ms). No untype. The brand text node is then empty.
- Each sentence types in char-by-char, holds, deletes char-by-char, then the next types.
- Type speed **45ms/char**, delete speed **25ms/char** (delete snappier).
- Hold (reading time):
  ```
  holdMs = round(words / 200 * 60_000) + 1000   // 200 wpm + 1s buffer
  holdMs = max(holdMs, 2000)                     // 2s floor
  ```
  Timed sentences (7 words each) → ≈ 3.1s hold. Gated sentences ignore the hold (they wait on the event).
- `prefers-reduced-motion`: skip type/delete animation entirely, set full text instantly, still hold
  and advance.

## Header swap + accessibility

- The brand `<span>` ([index.html:153](../../../index.html#L153)) text is the typewriter target.
- An `aria-live="polite"` region announces the **full sentence once** when each step starts — never
  letter-by-letter (that would spam screen readers). Typewriter is visual only.
- Wordmark reverts to "Clumeral" at sequence end and whenever the player leaves `/play`.
- No new interactive controls, so no new keyboard surface to manage. The brand button keeps its
  existing `aria-label="Home"` behaviour.

## Trigger + persistence

- On `screens:enter` for the `game` screen: if new user (`!localStorage.getItem("dlng_history")`)
  → run the walkthrough.
- The first solve writes `dlng_history` via the existing `recordGame()` — so the walkthrough never
  shows again. **No new localStorage key needed.**
- A player who closes/reloads `/play` before solving sees the walkthrough again. Accepted for v1
  (simpler; teaches until they actually play through).

> Note: this intentionally diverges from issue AC "skippable / skipping persists" — v1 has no skip,
> and suppression is by first solve. Update the issue's AC checklist accordingly when closing.

## Testing

Playwright e2e against the **production build** (standing project rule):
- Fresh first visit to `/play` → walkthrough types in the header.
- Gated step 2 advances only after a digit box is opened.
- Gated step 3 advances only after a digit is eliminated.
- After step 3 completes → wordmark shows "Clumeral" again.
- Returning player (`dlng_history` present) → no walkthrough, wordmark from the start.
- `aria-live` region receives the full sentence per step.
- `prefers-reduced-motion` → text appears instantly (no per-char animation), still advances.

Unit test on the step machine (advance logic, timed vs gated) if a JS unit harness exists in the repo.

## Out of scope (deferred past v1)

- Idle re-trigger nudge.
- Ambient/quirky octopus messages outside the tutorial.
- Replay-the-walkthrough from the menu.
- Any skip control.

## Execution notes (for the fresh execute chat)

1. You are on / check out `issue/214` (branched off `new-design`).
2. Follow review gates (DA review → self-review) before PR — this touches >1 file and changes
   `/play` behaviour.
3. PR merges into **`new-design`**, not `staging` or `main`.
4. This must land before the Playwright QA regression suite is finalised (suite asserts `/play`).
