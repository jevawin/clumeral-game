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
Settled: Jamie 2026-08-01 · Ack: Dave 2026-08-01

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
Settled: Jamie 2026-08-01 ("11 hint only, everything else good") · Ack: Dave 2026-08-01

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
detection, 22 no confirm) · Ack: Dave 2026-08-01

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
Settled: Jamie 2026-08-01 (accepted all recommendations) · Ack: Dave 2026-08-01

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
Settled: Jamie 2026-08-01 ("6 approved" — items 32 and 33 both go ahead) · Ack: Dave 2026-08-01

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
Settled: Jamie 2026-08-01 (layout per his sketch; "your recs" on items 64-66) · Ack: Dave
2026-08-01, re-given after the reopening ("I'm happy with all sections", 2026-08-01)
Reopened 2026-08-01 by Jamie — placement moved inside the buttons. Items 48-52 and 62-66 supersede
35, 37, 38, 39 and 41.

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

### §7 reopened 2026-08-01 — hint moves inside the buttons (Jamie)

Jamie: "8 try inside the button new row" with a sketch of Undo / icon / `ctrl + z` stacked, and
"Small text, 14px or even 12px". Numbered his message as §8; it is a placement decision, so it
lands here. Items 48-52 supersede 35, 37, 38 and 39.

48. There are now **two** hints, one inside each button, not one shared label between them. Each
    button gains a second line under its existing icon+label row: `⌘Z` inside Undo, `⌘X` inside
    Reset. `.board-ctrl` becomes a column — the current icon+label row stays exactly as it is and
    the shortcut line sits below it. (My read of the sketch; Jamie's drawing put the label above
    the icon, which would also reorder the existing content — flagged, not assumed.)
49. Size: 0.875rem (14px) rather than 0.75rem (12px).
    My rec: 14px, matching the button's existing label size. Why: see item 53 — the button fades
    to `opacity: 0.4` whenever the control is unavailable, which is a large part of the time, and
    12px at 40% opacity is the hardest thing in the app to read. 12px is defensible if we would
    rather have the size contrast; 14px costs nothing.
50. **Item 38 is dropped.** The muted `text-text/60` treatment does not survive at this size —
    small text must clear 4.5:1 (WCAG 1.4.3), and 60% opacity on the body colour will not. The
    shortcut line uses the full text colour, verified in both themes.
51. **Item 39 is dropped.** The hint is inside the button now, so it inherits the button's
    `aria-disabled` fade automatically. It greys with its control instead of staying constant —
    which is arguably better: the key genuinely does nothing while the control is unavailable.
52. Sizes rise in `rem`, not `px`, so browser zoom and text-only resize both work. The extra line
    makes the controls taller, but only on keyboard devices — touch layout is untouched, so the
    "buttons push the clues down" problem Jamie raised on 2026-07-31 does not get worse on phones.

62. **Layout, per Jamie 2026-08-01 — supersedes item 48's reading of the sketch.** The button
    stays a row: icon on one side, a text column beside it. That column holds the label and, when
    present, the shortcut beneath it, and the group is vertically centred against the icon
    (`align-items: center`). With no shortcut the label is centred alone; with a shortcut the two
    share the space and both shift. The icon is not reordered and the label does not move above
    it.
63. A 200ms transition on the position shift, plus a fade on the shortcut text as it appears.
    (Jamie's call — "to make it less janky")
64. **Item 41 is dropped.** There IS a transition now, so it must honour
    `prefers-reduced-motion: reduce` — under that setting the hint appears instantly with no
    movement or fade. (assumed — Jamie owns accessibility and this is the standard partner to any
    new motion; it is also cheap)
65. The transition is only ever seen on a hybrid device. On a desktop the pointer test (item 21a)
    matches before first paint, so the hint is simply there; the animated reveal happens when the
    keydown trigger (21b) fires mid-session on a tablet with a keyboard. (assumed)
66. The reveal makes the button taller, which nudges the digit boxes below it down a few pixels.
    Accepted — the 200ms transition is what stops that reading as a glitch. (assumed — item 63)

## 8. Copy & wording
Settled: Jamie 2026-08-01 (accepted all recommendations; item 45 lowercase confirmed as his type
call) · Ack: Dave 2026-08-01

43. The hint names the key AND the action, rather than keys alone:
    - Mac: `⌘Z undo · ⌘X reset`
    - everything else: `Ctrl+Z undo · Ctrl+X reset`
    My rec: as above. Why: keys alone (`⌘Z · ⌘X`) is unreadable — nothing tells you which is
    which, and the buttons at either end are too far apart to imply it. Naming the action costs
    two short words.
44. Separator is a middle dot with spaces (` · `), matching nothing else in the UI but reading as
    a quiet divider at small size. (assumed)
45. The action words are lowercase — `undo`, not `Undo` — even though the buttons are
    capitalised.
    My rec: lowercase. Why: it reads as an aside rather than a third and fourth control competing
    with the two real buttons beside it. Jamie owns type, so this is his call, and matching the
    buttons with `Undo` / `Reset` is the obvious alternative.
46. Screen-reader wording is NOT the visible string. `⌘` is announced inconsistently — VoiceOver
    says "command" but other readers fall back to the Unicode name, "place of interest sign".
    My rec: give the hint element a spelled-out accessible name — "Keyboard shortcuts: Command Z
    to undo, Command X to reset" (or "Control Z … Control X …" off the Mac). Why: the glyph is
    right for sighted players and wrong for spoken output; splitting the two costs one attribute.
    §9 decides whether the hint is exposed to assistive tech at all.
47. Nothing else changes wording. The buttons keep "Undo" / "Undo reset" / "Reset", their
    `aria-label`s keep "Undo last change" / "Undo reset" / "Reset all boxes", and the live region
    keeps "Board reset. Undo reset available." (assumed — item 9)

## 9. Accessibility
Settled: Jamie 2026-08-01 — blocking sign-off given ("your recs"), covering the 14px answer in
53, the aria-describedby fix in 54, and the new announcements in 56 and 57. · Ack: n/a (owned)

Jamie asked directly: "rare size rule break but contrast is good and screen read picks up, okay
for accessibility?" Answer: yes on the size, with three conditions — and one correction, because
the screen reader will NOT pick it up as things stand.

53. Size is fine. WCAG sets no minimum font size; what it sets is contrast (1.4.3, 4.5:1 for text
    under 24px) and resize (1.4.4, up to 200% without loss). 14px or 12px passes both provided
    items 50 and 52 hold — full-strength colour, rem units. The one caveat is the existing
    `.board-ctrl[aria-disabled="true"] { opacity: 0.4 }` fade: an unavailable control drops the
    whole button, shortcut line included, well below 4.5:1. That is permitted — 1.4.3 exempts
    inactive components, and the 14px button label already lives with it — but it is why item 49
    recommends 14px over 12px.
54. **Correction: the shortcut text will not be announced.** Both buttons carry an explicit
    `aria-label` ("Undo last change", "Reset all boxes"), and an `aria-label` replaces the
    element's contents entirely for assistive tech. Adding a visible `⌘Z` inside the button
    changes nothing a screen reader hears.
    My rec: add `aria-describedby` on each button pointing at its shortcut span, and give that
    span visually-hidden spelled-out text — "Keyboard shortcut: Command Z" — alongside the
    visible glyph. Why: description is announced after the name, so the button still leads with
    "Undo last change" and the shortcut follows once, rather than bloating the name that gets
    re-read on every state change. The alternative — folding it into the `aria-label` — makes the
    name longer every single time focus lands.
55. Item 46 stands and now has a home: `⌘` is read inconsistently (VoiceOver says "command",
    others fall back to "place of interest sign"), so the spoken string spells the modifier out
    and the glyph is visual only.
56. A keyboard-triggered **Undo** currently announces nothing. Clicking Undo is self-evident —
    focus is on the button — but a shortcut fired while focus sits on a digit box leaves a
    screen-reader user with no confirmation anything happened.
    My rec: reuse the existing `[data-undo-msg]` live region to say "Undone." on a keyboard undo,
    and "Undo reset." when the entry stepped back over was a reset. Why: silent state change is
    the exact failure §1 item 4 says we must not introduce.
57. Pressing a shortcut when the control is unavailable announces why, rather than doing nothing
    silently: "Nothing to undo." / "Board is already clear."
    My rec: announce. Why: it matches the line Jamie drew on 2026-07-31 — "don't move focus, just
    notify a screen reader it's disabled" — and an unexplained silence is indistinguishable from
    a broken key.
58. Reset via keyboard keeps its existing announcement, "Board reset. Undo reset available." No
    change. (assumed — item 14)
59. A shortcut never moves focus. Wherever the player was, they stay. (assumed — the whole reason
    #251 used `aria-disabled` instead of `disabled`)
60. WCAG 2.1.4 (Character Key Shortcuts) does not apply: both bindings require a modifier. This
    is why bare `U` / `R` were never proposed — a single-character shortcut would have needed a
    remap or disable mechanism, which item 8 rules out. (assumed)
61. The hint is not a live region and never announces itself. It is static description. (assumed)

## 10. Analytics
Settled: Jamie 2026-08-01 (chose option 1 — both routes tracked with a `source` split) ·
Ack: Dave 2026-08-01

Context: Undo and Reset ship with **no analytics at all** today — #251 added none because nobody
asked. So this is not "add a keyboard property to the existing event"; the events do not exist.

67. Add two events, both fired for button presses as well as shortcuts, using the `source`
    parameter `track()` already takes: `undo_used` and `reset_used`, with `source` of `keyboard`
    or `button`.
    My rec: track both routes, not just the keyboard. Why: a keyboard-only count is a number with
    no denominator — we would know 40 shortcut undos happened and have no idea whether that is
    most undos or a rounding error. The split is the entire question this feature raises.
68. Nothing tracks the hint being displayed.
    My rec: no impression event. Why: it would fire on essentially every desktop game load, which
    is a lot of noise to answer a question the `source` split already answers better.
69. Auto-repeat (item 18) does not spam events: when a `keydown` arrives with `e.repeat === true`
    the undo still runs but no event is sent. (assumed — holding the key for a second would
    otherwise post thirty identical rows and wreck the numbers)
70. Presses that do nothing (empty history, already-clear board) send no event. Only real actions
    are counted. (assumed)
71. Anonymity is unchanged: `track()` already sends only the existing anonymous `uid` from
    localStorage plus the `newUser` flag. No new field, nothing identifying, no key-by-key
    logging. (assumed)
72. No worker change — `/api/event` takes arbitrary event names already. (assumed — item 30)

## 11. Done / test plan
Settled: Jamie 2026-08-01 (accepted all recommendations) · Ack: Dave 2026-08-01

Existing coverage to extend rather than duplicate: `tests/undo-stack.spec.ts`,
`tests/storage-undo.spec.ts` (vitest) and `e2e/specs/undo-reset.spec.ts` (Playwright).

73. **QA level: targeted, not the full battering.** New e2e cases go into the existing
    `undo-reset.spec.ts`, plus the a11y spec; the full cross-engine suite runs in CI as usual but
    nothing new is built for it.
    My rec: proportional as above. Why: the change is one keydown branch, one CSS rewrite of
    `.board-ctrl`, and two events — but it touches keyboard handling, layout and accessibility at
    once, so "no tests" is wrong too.
74. Unit (vitest), on the pure `matchShortcut()` from item 34: `Ctrl+Z`/`Cmd+Z` → `undo`,
    `Ctrl+X`/`Cmd+X` → `reset`, `Ctrl+Shift+Z` → null, `Alt+Ctrl+Z` → null, bare `z`/`x` → null,
    `Z` uppercase (caps lock / shift-less matching) handled deliberately either way.
75. E2E, added to `e2e/specs/undo-reset.spec.ts`:
    - eliminate a digit, `Ctrl+Z`, digit is back and the board matches the pre-toggle state
    - eliminate several, `Ctrl+X`, board is clear, Undo reads "Undo reset", `Ctrl+Z` restores the
      whole pre-reset board in one press
    - hold `Ctrl+Z` (auto-repeat) unwinds to empty and then stops, with no error
    - `Ctrl+Z` and `Ctrl+X` on a solved board do nothing
    - `Ctrl+Shift+Z` does nothing
    - the existing keyboard bindings still work: digits toggle, Tab/arrows move between boxes,
      Enter submits a resolved board, Escape closes the keypad (item 28 puts the new branch ahead
      of the digit branch, so this is the regression to watch)
76. E2E for the exclusions in item 16: with the feedback modal open and text typed into the
    textarea, `Cmd+X` cuts the text and the board is untouched; with the menu open, neither key
    changes the board.
77. E2E for the hint: present on a desktop project, absent on a touch project with no keyboard,
    and appearing after a first keypress on a touch project that then sends one.
78. E2E in `a11y.spec.ts`: axe passes on the game screen with the hint shown; the buttons expose
    both their name and their description ("Undo last change" + "Keyboard shortcut: Command Z" /
    "Control Z").
79. Manual, on the branch preview, because automation is poor at these:
    - VoiceOver or NVDA actually reads the description and the new live-region messages (items
      54, 56, 57)
    - contrast of the shortcut line in both light and dark themes
    - `prefers-reduced-motion: reduce` kills the 200ms transition (item 64)
    - the reveal on a real tablet with a keyboard
    My rec: Jamie takes the screen-reader and contrast checks since accessibility is his, and
    both of you eyeball the layout on the preview before the PR is raised.
80. Done means: all of the above green, the CI smoke suite passing cross-engine, `da-build`
    clean, and the brief plus plan committed on the branch. (assumed — house rules)
