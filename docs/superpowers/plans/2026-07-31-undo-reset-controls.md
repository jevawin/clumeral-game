# Undo / Reset Controls Implementation Plan

**Goal:** Give players a one-press Undo and a one-click Reset above the digit boxes, so a mis-tapped elimination costs one press instead of manual re-entry.

**Architecture:** A new pure module `src/history.ts` owns an undo stack of cloned board snapshots. `app.ts` pushes a snapshot before every board mutation and pops one on Undo. Keeping the stack in its own module is what makes it unit-testable — `app.ts` is UI-only per [CONVENTIONS.md](../../CONVENTIONS.md), and the snapshot logic is the only part with real edge cases.

**Tech Stack:** Vite 8, TypeScript, Tailwind v4, Vitest, Playwright.

**Issue:** [#251](https://github.com/jevawin/clumeral-game/issues/251)
**Branch:** `issue/251` (off `staging`)

---

## Settled in discussion (2026-07-31)

Dave (concept) and Jamie (dev lead) answered every open question on the issue. Recording
the outcome here because the issue's Open Questions section is now stale.

**Behaviour**

- Undo steps back **one board change per press** — not one box interaction.
- Reset restores **all three** boxes to their starting sets. Hundreds `1–9`, tens/units `0–9`.
- **No Redo** in v1.
- Reset is **one click, no confirmation**. Safety comes from Undo, not a prompt.
- Undo after a Reset restores the **whole** pre-reset board in a single press.
- Both controls are **hidden once the puzzle is solved** — a solve can never be unwound back into play.
- Undo history **resets on reload**. The board still restores from `dlng_active` as it does today; only the history is dropped. No storage schema change, no migration.

**Presentation**

- Icon + visible text label: `[icon] Undo` and `[icon] Reset`. Icon-only was considered and
  rejected — the hover tooltip that would explain it doesn't exist on touch, and this is a
  phone-first game.
- Icons from Lucide (`undo-2`, `rotate-ccw`), added as symbols to `public/sprites.svg`.
  No npm dependency: the project has no Lucide package and builds its own sprite sheet.
- Positioned between the clue list and the digit boxes.
- Styled from the same classes as the keypad buttons, including the tap-offset active state,
  so they read as the same family of interactive elements.
- Always visible during play, faded and disabled when not applicable.
- After a Reset, a 14px foreground-colour "Undo reset" message sits **next to** the Undo
  button, outside it. It clears when Undo is pressed, or on the player's next elimination.

**An earlier two-tap confirm design was dropped.** It specced "Tap again to reset" with a 5s
countdown replacing the icon. Jamie cut it in favour of one-click plus the Undo affordance:
simpler to build, and it removes a `prefers-reduced-motion` case entirely rather than
handling one. Noted so the countdown isn't re-proposed as a missing feature.

## Enabled-state rules

The two controls do **not** share a condition, which matters for the post-reset state:

- **Undo** — enabled when the history stack is non-empty.
- **Reset** — enabled when the board differs from its starting state.

Immediately after a Reset the board *is* the starting state, so Reset disables itself while
Undo stays live. That falls out of the rules above rather than needing a special case.

## Tasks

- [ ] **1. `src/history.ts` + unit tests.** Pure module, tests first. Snapshot clone/restore,
      push, undo, canUndo, clear, isStartingState, depth cap. No DOM.
- [ ] **2. Sprite icons.** Add Lucide `undo-2` and `rotate-ccw` symbols to `public/sprites.svg`,
      matching the existing symbols' stroke conventions.
- [ ] **3. Markup.** Controls row in `index.html` between the clue list and `[data-digits]`.
      Real `<button type="button">`s with `data-undo` / `data-reset`, aria-labels, and the
      message element `[data-undo-msg]`.
- [ ] **4. Wire `app.ts`.** Push a snapshot in `toggleDigit`, implement Undo and Reset,
      enable/disable rendering, hide on solve, clear history on new puzzle and on restore.
- [ ] **5. e2e spec.** `e2e/specs/undo-reset.spec.ts` — the acceptance criteria as browser tests.
- [ ] **6. Review gates.** DA review (authorised by Jamie), then self-review, then PR.

## QA scope

Agreed up front with Jamie:

- **Unit (vitest):** the history stack, including the can't-empty-a-box guard holding across
  undo and reset.
- **e2e (Playwright):** a new spec under `e2e/specs/`. No CI change needed — `ci-smoke.yml`
  auto-discovers everything in `e2e/specs/**` and runs it on chromium for every PR into
  `staging`; `ci-matrix.yml` adds the other four engines on PRs into `main`.
- Playwright is **not** run locally on this machine. CI runs it.

Separately filed while scoping this: [#282](https://github.com/jevawin/clumeral-game/issues/282)
— the vitest suite isn't gated in CI at all. Out of scope here.

## Watch out for

- **The last-candidate guard.** `toggleDigit` refuses to remove a box's last remaining digit.
  Snapshots sidestep this: every stored state is one the game already allowed, so restoring one
  can't produce an empty box. The guard must not be re-run on restore.
- **Blocked toggles must not push.** `toggleDigit` returns early when the guard fires. Pushing
  a snapshot before that check would leave a no-op entry on the stack, and Undo would appear
  to do nothing for one press.
- **Solved boards.** `showSolved` overwrites `possibles` with the answer digits. History must be
  cleared there, not just hidden, so nothing survives to unwind.
- **Persistence.** `saveActive` fires on every mutation. Undo and Reset change the board, so
  they must save too, or a reload resurrects the pre-undo state.

## Accepted trade-off: a reset is unrecoverable after a reload

Raised by the DA review, left as designed — flagging it so it's a decision on the record
rather than an oversight.

Reset persists the emptied board to `dlng_active` immediately, while the pre-reset board
lives only in the in-memory stack. So the sequence "mis-tap Reset → iOS discards the tab →
reopen" loses the eliminations for good. The Undo safety net that justifies having no
confirmation step lasts only as long as the page does.

Fixing it properly means persisting the pre-reset board, which is exactly the storage schema
bump the discussion ruled out. Both available fixes (a `preReset` field in `dlng_active`, or
not saving until the next real mutation) are larger than this ticket. If the loss shows up in
feedback, that's the change to make.
