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
