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
Settled: Jamie 2026-08-01 ("11 hint only, everything else good") · Ack: pending (Dave)

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
Settled: Jamie 2026-08-01 (accepted all recommendations — 20 keep Ctrl/Cmd+X, 21 two-trigger
detection, 22 no confirm) · Ack: pending (Dave)

12. Bindings (from Jamie, item 5): **Ctrl+Z or Cmd+Z = Undo**, **Ctrl+X or Cmd+X = Reset**.
    Either modifier is accepted on either platform — matching on `e.ctrlKey || e.metaKey` rather
    than sniffing the OS, so a Mac user with a PC keyboard and vice versa both work.
    (assumed — Jamie chose the keys)
13. The other modifiers must be absent. `Ctrl/Cmd+Shift+Z` (the redo idiom) and any Alt
    combination do nothing at all, rather than falling through to undo. (assumed — silently
    undoing when someone asked to redo is worse than ignoring them; see item 6)
14. Both shortcuts call the existing `undoLast()` / `resetBoard()` unchanged. Same history entry,
    same "Undo reset" relabel, same sessionStorage write, same live-region announcement as a
    click. There is no separate keyboard code path. (assumed — item 9)
15. When a shortcut acts, it calls `preventDefault()` so the browser's own undo / cut does not
    also fire. (assumed)
16. Hard exclusions — the handler returns immediately when:
    - focus is in a text field (the feedback `textarea`, any `input`). Cmd+X must still cut text
      the player is typing into feedback, and Cmd+Z must still undo their typing.
    - a modal or overlay is open: feedback, how to play, the menu, or the walkthrough.
    (assumed — a shortcut that eats Cut inside a textarea is a bug, not a feature)
17. Game screen only. On a solved board both are inert already — `undoLast()` and `resetBoard()`
    return early on `gameState.solved`, and the controls are hidden — so no extra guard is needed
    beyond not binding on other screens. (assumed — parity with the buttons)
18. Auto-repeat is allowed: holding Ctrl/Cmd+Z steps back repeatedly until the stack is empty,
    the same as native undo. (assumed)
19. Pressing a shortcut when the action is unavailable (empty history, or a board already at its
    starting state) does nothing and changes nothing on screen. What a screen reader hears in
    that moment is decided in §9.
20. Ctrl/Cmd+X is the system Cut. Worth a conscious yes: is Reset still the right thing to hang
    off it?
    My rec: keep X. Why: it pairs with Z in the same hand, it is what Jamie asked for, and the
    only real collision is inside a text field, which item 16 already excludes — there is nothing
    cuttable on the board itself. Alternative if we would rather not touch a system key at all:
    Ctrl/Cmd+Backspace ("delete it all"), which is unbound outside text fields.
21. How do we decide a keyboard is present, for the hint in §7?
    My rec: two triggers, either one shows the hint. (a) `matchMedia('(hover: hover) and
    (pointer: fine)')` matches — a real pointer means a laptop or desktop, which effectively
    always means a keyboard; (b) any `keydown` has been seen this session — which catches an
    iPad with a Magic Keyboard, where the pointer test fails. Why: pure touch users never see it,
    desktop users see it without having to press anything first, and hybrid users get it the
    moment they use the keyboard.
22. Does a keyboard-triggered Reset need a confirm step, given it wipes the board in one press?
    My rec: no. Why: it is fully recoverable with one Ctrl/Cmd+Z, the Undo control relabels
    itself to "Undo reset", and the live region already says "Board reset. Undo reset available."
    A confirm dialog would also break the speed goal from item 4.

## 4. Maths
Settled: n/a — confirmed by Dave 2026-08-01 ("I'm happy", answering Jamie's "this affects nothing
to do with clues or maths or logic") · Ack: n/a

23. n/a. Nothing here touches puzzle generation, clue selection or filtering. The shortcuts are a
    second trigger for two functions that only rearrange the player's own eliminations; the
    answer, the clue set and the daily seed are untouched. Dave owns maths, so this stays open
    until he says the n/a is right.

## 5. State & persistence
Settled: Jamie 2026-08-01 (accepted all recommendations) · Ack: pending (Dave)

24. No new persisted state for the shortcuts themselves. They read and write the same
    sessionStorage undo history that the buttons already use, through the same functions.
    (assumed — item 9)
25. The hint is permanent inline text, not a dismissible notice: no close button, no "seen"
    flag, no storage key. (assumed — a dismissal would mean a localStorage key plus a decision
    about whether it comes back tomorrow; a quiet inline label does not earn that)
26. The hint does not fade out after first use or after N days. It stays for anyone on a
    keyboard device. (assumed — it is a label, not an onboarding step; it costs nothing to leave)
27. The "a keyboard has been seen" flag from item 21 lives in memory for the page session only,
    not in sessionStorage. (assumed — a desktop is covered by the pointer test on every load, so
    only a touch-first device with a keyboard loses the hint on refresh, and it comes straight
    back on the next keypress. The alternative, one sessionStorage key, is available if we would
    rather it survive a refresh on an iPad.)

## 6. How it fits
Settled: pending · Ack: pending

Modules actually touched: `src/app.ts`, `index.html`, `src/screens.ts` (one new export),
`src/walkthrough.ts` (one new export). NOT touched: `src/undo-stack.ts`, `src/storage.ts`,
`src/router.ts`, anything under `src/worker/`.

28. The bindings live in the existing `document` `keydown` listener in `src/app.ts` (~line 1014),
    as a new branch placed **before** the digit branch. (assumed — a modified keypress must be
    matched first so `Ctrl+Z` can never be read as anything else; the digit branch already
    parses `e.key` as a number without checking modifiers)
29. They call the existing `undoLast()` and `resetBoard()` in `app.ts`. No new state, no
    duplicated logic, so `renderBoardControls()`, `applyBoard()`, `persistHistory()` and
    `announceReset()` all run exactly as they do for a click. (assumed — item 14)
30. `src/undo-stack.ts` and `src/storage.ts` are untouched, and there is no worker or API change.
    (assumed — item 9)
31. The hint element is added to `index.html` inside `[data-board-controls]` (that div at line
    253, which already holds Undo, Reset and the `[data-undo-msg]` live region). Exact position
    and styling are §7. Its show/hide is one small function in `app.ts` alongside
    `renderBoardControls()`. Tailwind utilities only, no new colour token — the design budget is
    under 15 and this is a muted text label. (assumed)
32. Screen scoping needs a reliable "is the game screen showing?". `screens.ts` holds
    `currentScreen` as module-private state and exports only `showScreen()`.
    My rec: add an exported `getCurrentScreen(): ScreenId | null` to `screens.ts` and gate on it.
    Why: the alternative is sniffing `display` / `aria-hidden` off the screen element from
    `app.ts`, which is wrong mid-transition (the fade sets `aria-hidden` on the outgoing screen
    before the swap) and duplicates knowledge that module already owns.
33. Overlay guard (item 16) needs the same. Modals set `.open` and the menu toggles `.hidden`,
    both readable from the DOM, but the walkthrough keeps a private `active` flag.
    My rec: export `isWalkthroughActive(): boolean` from `walkthrough.ts` and check the two DOM
    conditions inline. Why: the walkthrough drives the player through real board actions, so an
    undo landing mid-step could desync it; and a flag is exact where a DOM guess is not.
34. To keep something unit-testable out of the DOM glue, the key matching itself is a pure
    function — `matchShortcut(e): 'undo' | 'reset' | null` — living beside the handler or in
    `undo-stack.ts`'s neighbourhood, and unit tested for the modifier rules in items 12 and 13.
    Everything else is event wiring and is covered by e2e in §11. (assumed — matches how
    `undo-stack.ts` was split from `app.ts` in #251)

## 7. How it looks
Settled: pending · Ack: pending

35. Placement: inline in the existing `[data-board-controls]` row, centred between Undo and
    Reset. That row is `flex items-center justify-between` with a button pinned at each end, so
    the middle is already empty space and no new row is added. (assumed — Jamie flagged on
    2026-07-31 that the controls adding a row makes the clues easier to lose; this adds none)
36. Order matches the buttons: the undo key on the left of the pair, the reset key on the right.
    (assumed)
37. Styling: small muted plain text, no `<kbd>` badges or borders.
    My rec: plain text. Why: badges are four extra boxes of chrome sitting between two buttons
    that already have icons and labels, in a design deliberately kept minimal. Alternative if it
    reads too weakly: `<kbd>`-style pills using the existing border token.
38. Colour: an existing muted treatment (the `text-text/60` already used for placeholders), so no
    new colour token and both themes are covered. (assumed — the budget is under 15 tokens)
39. The hint does not grey out or change when Undo or Reset become unavailable. It stays
    constant. (assumed — it describes which keys exist, and text flickering next to the board on
    every digit tap is noise)
40. Mac vs Windows: show only the one that applies — `⌘Z` / `⌘X` on a Mac, `Ctrl+Z` / `Ctrl+X`
    elsewhere, detected once at load and defaulting to Ctrl when detection is unclear.
    My rec: platform-specific, not both. Why: "Ctrl/Cmd+Z" doubles the width of a label squeezed
    between two buttons, and the handler accepts either modifier regardless (item 12) so a wrong
    guess is cosmetic, never broken.
41. It appears without animation or transition — it is either there on load or it is not.
    (assumed)
42. On a solved board it disappears with the controls row, because it sits inside it. (assumed —
    item 17)

## 8. Copy & wording
Settled: pending · Ack: pending

## 9. Accessibility
Settled: pending · Ack: pending

## 10. Analytics
Settled: pending · Ack: pending

## 11. Done / test plan
Settled: pending · Ack: pending
