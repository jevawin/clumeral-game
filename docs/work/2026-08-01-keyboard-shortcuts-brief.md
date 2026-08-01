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
Settled: Jamie 2026-08-01 · Ack: pending (Dave)

Short form: WITHDRAWN. The original proposal dropped §5 and §7; Jamie's answer to 4 asks for a
visible UI element when a keyboard is detected, which puts §7 (how it looks) and possibly §5
(remembering a dismissal) back in scope. Running the full brief minus §4 (no puzzle maths).

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
   **Answered — Jamie: "4 both."** Both goals count: speed for fluent keyboard players AND
   accessibility for people who cannot comfortably use a pointer. §9 is therefore a first-class
   goal here, not only a veto.
5. Jamie, same message: "We should have some form ui element when keyboard is detected if poss
   like ctrl/cmd + z (x for reset)." Recorded as three directions, carried into the sections
   that own them:
   - the bindings are Ctrl/Cmd+Z for Undo and Ctrl/Cmd+X for Reset → §3
   - there is a visible hint in the UI showing them → §7
   - the hint appears only once a keyboard is detected, not on touch → §3/§7

## 2. Out of scope
Settled: pending · Ack: pending

6. No redo. Ctrl/Cmd+Shift+Z stays unbound and does nothing. (assumed — there is no redo in the
   product; the history stack is undo-only)
7. No new shortcuts for anything else — submit, digit entry, box navigation, theme, menu,
   feedback. The existing digit / Tab / arrow / Enter / Escape bindings are untouched.
   (assumed — Jamie asked for undo and reset)
8. Shortcuts are not user-remappable or configurable, and there is no settings surface for them.
   (assumed — no settings screen exists to hang it off)
9. No change to what Undo and Reset actually do: same history stack, same 100-entry cap, same
   sessionStorage persistence, same solved-board rules. The shortcut is a second trigger for the
   existing `undoLast()` / `resetBoard()`. (assumed — behaviour parity is the whole point)
10. No touch/mobile change. Nothing new appears on a device with no keyboard. (assumed)
11. Should the shortcuts also be documented in How to Play, or does the on-screen hint carry it
    alone?
    My rec: hint only, no How to Play change. Why: How to Play is read once, before the player
    has a board in front of them, and it is the screen we keep trying to keep short; a hint next
    to the buttons is in the right place at the right moment. Cheap to add later if the hint
    proves too quiet.

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
