# Brief — Keyboard shortcuts for Undo and Reset

Requested by Jamie, 2026-08-01. Branch: `dev/keyboard-shortcuts`.

Numbers are continuous and append-only across the whole brief. Never reuse, never renumber.

Existing ground truth (read before writing anything):
- Undo/Reset shipped in #251. `src/undo-stack.ts` (pure history), `src/app.ts`
  `undoLast()` / `resetBoard()` / `renderBoardControls()` / `setUnavailable()` / `announceReset()`.
- A `document`-level `keydown` listener already exists in `src/app.ts` (~line 1014): digit keys
  toggle the active box, Tab/arrows navigate boxes, Enter submits a resolved board, Escape closes
  the keypad. Any new binding lands inside or alongside that handler.
- Controls use `aria-disabled`, not native `disabled`, so focus is never stolen.

---

## 1. What it is
Settled: pending · Ack: pending

Proposed short form: sections 1, 2, 3, 6, 8, 9, 10, 11 — dropping §4 (no puzzle maths), §5 (no
new stored state; the existing sessionStorage history is untouched) and §7 (no new UI unless §8
adds a discoverability hint). Awaiting Jamie's approval; not self-granted.

1. Problem: Undo and Reset are reachable only by Tab-ing to the two buttons under the board. A
   player working the board from the keyboard (digits, arrows, Enter) has to leave the digit
   boxes, land on a control, press it, then navigate back — repeatedly, since undo is a
   repeated action. (assumed — that is the only route the #251 build shipped)
2. Who it is for: desktop/laptop keyboard players. Touch is unaffected; there is no keyboard.
   (assumed)
3. Why now: the controls shipped recently (#251) and are in daily use, so the friction is live.
   (assumed)
4. Is the goal speed for fluent keyboard players, or accessibility for people who cannot
   comfortably use a pointer?
   My rec: treat it as speed-for-fluency, with accessibility as a hard constraint it must not
   damage. Why: the Tab route already works and is accessible today, so this is an ergonomics
   win, not a gap being closed — but a careless binding (bare letter keys, silent action, keys
   that fire inside the feedback textarea) could easily make things worse for screen-reader
   users. Framing it this way means §9 can veto a binding on accessibility grounds.

## 2. Out of scope
Settled: pending · Ack: pending

## 3. How it works
Settled: pending · Ack: pending

## 4. Maths
Settled: pending · Ack: pending

## 5. State & persistence
Settled: pending · Ack: pending

## 6. How it fits
Settled: pending · Ack: pending

## 7. How it looks
Settled: pending · Ack: pending

## 8. Copy & wording
Settled: pending · Ack: pending

## 9. Accessibility
Settled: pending · Ack: pending

## 10. Analytics
Settled: pending · Ack: pending

## 11. Done / test plan
Settled: pending · Ack: pending
