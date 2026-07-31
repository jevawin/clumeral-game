# #251 Undo / Reset — pick-up note

Written 2026-07-31 for a fresh session. Issue: https://github.com/jevawin/clumeral-game/issues/251

**Status:** _Now_ on the board. Nothing built, no branch, no plan. Discuss stage.

## Be honest about what was actually discussed

This note exists because Jamie asked for the #251 discussion to be captured. **There was very little of it, and none of it from Dave.** Recording that plainly is more useful than padding it out:

- **Jamie (2026-07-31):** picked #251 as the next task over #78/#196/#227/#189 — "let's do 251 first because it would be SO helpful". That is the whole of the recorded rationale.
- **Dave:** has said **nothing** about #251. His input in that session was entirely about #270 (difficulty rating). Do not assume his view on any of the open questions below.

The rest of the case for #251 predates that session and lives on the board and the issue, not in conversation:

- Board Trigger field: "Strongest user demand (feedback D1 row 9, production). Unblocks #78 and #196."
- Feedback D1 **row 9 is production**; row 12 is a preview-host test row — don't count it as a second data point.

## Decided

- #251 goes before #78 and #196. Both of those touch digit-box interaction, so doing them first means building the tap handling twice.
- Board order settled: #251 in _Now_; the old "lead item but sitting fourth in Next" contradiction is resolved.

## Open questions — for Dave, as concept lead

These are all in the issue's own Open Questions section and are still unanswered. They're product decisions, not dev ones:

1. **Undo granularity** — one elimination per press (the issue recommends this), or undo the whole last box interaction?
2. **Reset scope** — clear all eliminations across all three boxes, or only the current box?
3. **Redo** — in v1, or Undo + Reset only?
4. **Reset confirmation** — prompt before it, or make it instantly undo-able instead? (Instantly-undo-able is usually kinder than a confirm dialog.)
5. **Presentation** — text links or small icon buttons above the boxes?

Ask Dave 1–5. Route anything about implementation or QA scope to Jamie.

## What the code says (verified, not assumed)

- State is `possibles` in `src/app.ts` — an array of three `Set`s. `toggleDigit()` mutates a set, `renderBox()` re-renders.
- Undo/Reset need a **history stack of cloned snapshots** — the sets are mutated in place, so pushing a reference would capture nothing.
- **Existing guard:** `toggleDigit` refuses to remove a box's last remaining candidate. Undo and Reset both have to stay consistent with that, including when stepping back *across* a blocked action.
- Starting sets: hundreds `1–9` (no leading zero), tens and units `0–9`.
- Purely client-side board state. **No API or puzzle-generation impact** — nothing here goes near the worker or KV.

## Watch out for

- **Finished puzzles.** The issue flags it and it isn't decided: a solved puzzle must not be undoable back into a playable state. Worth settling before building, not after.
- **Accessibility.** #251 carries the `accessibility` label. Controls must be real `<button>`s, keyboard-operable, with `aria-label`s and a genuine disabled state when there's nothing to undo. See docs/CONVENTIONS.md.
- **Mid-game restore.** `dlng_active` persists in-progress state to localStorage. Decide whether the undo history persists with it or resets on reload — the issue doesn't mention this and it will come up.

## Process reminders

- Review gates apply: DA review (fresh-context subagent, needs Jamie's authorisation) then self-review, before any PR.
- Agree the QA level **up front** during discuss/plan. This one is client-side UI with an accessibility label, so it likely warrants more than the unit-only pass #257 got.
- Branch `issue/251` off `staging`. Never push to `main` or `staging`.
