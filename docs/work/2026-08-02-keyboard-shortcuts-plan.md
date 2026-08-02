# Plan — Keyboard shortcuts for Undo and Reset

From `docs/work/2026-08-01-keyboard-shortcuts-brief.md` (closed 2026-08-01, all 11 sections
settled, da-brief findings 81–105 resolved). Branch: `dev/keyboard-shortcuts`.

This plan settles **how**. It reopens nothing. Brief item numbers are cited as `[n]` against
every task; the traceability table at the end accounts for all 105 items.

---

## Scope note — the authorised constraint break

CLAUDE.md's Clumeral Redesign constraints say *"Backend: No worker/API changes — frontend-only
rebuild"*. **This PR breaks that, deliberately and with Jamie's authorisation** (brief items 101,
102). `src/worker/index.ts` and `src/worker/stats.ts` are both in scope, because `undo_used` and
`reset_used` are rejected by the `VALID_EVENTS` allowlist and `track()` swallows the failure — the
analytics would silently record nothing without it (item 81), and the keyboard/button split would
be invisible on the dashboard without a `source`-aware query (item 82).

`da-build` should read the worker diff as authorised scope, not scope creep.

## Files

**Created**
- `src/shortcuts.ts` — pure key matching + platform label (item 87: it cannot live in `app.ts`,
  which vitest cannot import)
- `tests/shortcuts.spec.ts`
- `tests/stats-dashboard.spec.ts`

**Modified**
- `src/app.ts` — keydown branch, announcements, hint rendering, keyboard detection, two events
- `src/screens.ts` — one new export, `getCurrentScreen()`
- `src/walkthrough.ts` — one new export, `isWalkthroughActive()`
- `src/tailwind.css` — `.board-ctrl` rewritten from a row into icon + text column
- `index.html` — shortcut spans inside both buttons; Reset's label wrapped
- `src/worker/index.ts` — two names in `VALID_EVENTS`
- `src/worker/stats.ts` — `source`-aware query + four dashboard rows
- `e2e/specs/undo-reset.spec.ts`, `e2e/specs/a11y.spec.ts`, `e2e/specs/ssr-pages.spec.ts`
- `docs/URL-ARCHITECTURE.md` — the analytics event list

**Explicitly NOT touched** — `src/undo-stack.ts`, `src/storage.ts`, `src/router.ts`,
`src/modals.ts`. No change to puzzle generation, clue selection or the daily seed [23].

---

## Task 1 — `src/shortcuts.ts`, pure and DOM-free

Implements [12, 13, 34, 40, 87, 95, 103]. Tests first.

`tests/shortcuts.spec.ts` — `matchShortcut()`:

| Input | Expected |
|---|---|
| `{key:'z', ctrlKey:true}` | `'undo'` |
| `{key:'z', metaKey:true}` | `'undo'` |
| `{key:'x', ctrlKey:true}` | `'reset'` |
| `{key:'x', metaKey:true}` | `'reset'` |
| `{key:'Z', ctrlKey:true}` (caps lock) | `'undo'` — deliberate, see below |
| `{key:'z', ctrlKey:true, shiftKey:true}` | `null` (the redo idiom) [13] |
| `{key:'z', ctrlKey:true, altKey:true}` | `null` [13] |
| `{key:'z', metaKey:true, altKey:true}` | `null` |
| `{key:'z'}` bare, `{key:'x'}` bare | `null` [60] |
| `{key:'y', ctrlKey:true}`, `{key:'Enter', ctrlKey:true}` | `null` |

Deliberate call on uppercase [74]: matching is case-insensitive, so **caps lock still works** while
**Shift never does**. `shiftKey` is checked as a flag, independently of the character — so
`Ctrl+Shift+Z` is null even though `e.key` is `'Z'` in both cases.

Then the implementation:

```ts
export type ShortcutAction = 'undo' | 'reset';

// Structural, not KeyboardEvent — keeps the module DOM-free so vitest can import it.
export interface ShortcutKeyEvent {
  key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean;
}

export function matchShortcut(e: ShortcutKeyEvent): ShortcutAction | null
export function modifierLabel(platform: string | undefined): 'Cmd' | 'Ctrl'
```

`matchShortcut` returns `null` unless `(ctrlKey || metaKey) && !shiftKey && !altKey`, then switches
on `e.key.toLowerCase()`: `'z'` → `'undo'`, `'x'` → `'reset'`, else `null`. Either modifier is
accepted on either platform — no OS sniffing in the matcher [12].

`modifierLabel` takes the platform string as an argument rather than reading `navigator`, so it is
pure and testable: returns `'Cmd'` when `/mac|iphone|ipad/i` matches, `'Ctrl'` otherwise — including
for `undefined` and `''`, which is the "default to Ctrl when detection is unclear" rule [40, 95].
Tested with `'MacIntel'`, `'macOS'`, `'iPad'`, `'Win32'`, `'Linux x86_64'`, `''`, `undefined`.

The `altKey` exclusion matters on Windows: AltGr reports `ctrlKey && altKey`, so without it an
AltGr+Z on a European layout would fire Undo.

---

## Task 2 — the two state getters

Implements [32, 33, 88].

`src/screens.ts`:
```ts
export function getCurrentScreen(): ScreenId | null { return currentScreen; }
```
A getter, not the `screens:enter` event — a getter cannot miss an event fired before subscription,
and mid-transition the outgoing screen already carries `aria-hidden="true"` so sniffing the DOM
would be wrong [32]. `tests/router.spec.ts:7` already mocks a `getCurrentScreen` that does not
exist; this makes that mock honest [88]. No test change needed there — it starts passing for the
right reason.

`src/walkthrough.ts`:
```ts
export function isWalkthroughActive(): boolean { return active; }
```
The walkthrough drives the player through real board actions, so an undo landing mid-step could
desync it, and its `active` flag is exact where a DOM guess is not [33].

Test: extend `tests/walkthrough.spec.ts` only if the module's existing import surface allows it
without touching the DOM — it currently imports pure exports only (`STEPS`, `gateMatches`,
`holdMsFor`). `isWalkthroughActive()` is a one-line getter over module state that only
`startWalkthrough()`/`finish()` mutate, and both are DOM-driven; covering it in vitest would mean
building a walkthrough DOM harness for a `return active`. **Covered by e2e instead** — the
walkthrough guard is asserted in Task 8. No unit test.

---

## Task 3 — markup: shortcut lines inside both buttons

Implements [48, 50, 54, 55, 62, 86, 91, 92, 103, 104]. Markup and CSS land together with Task 4;
this task is the DOM shape.

`index.html`, inside `[data-board-controls]`:

```html
<button type="button" data-undo class="key-face board-ctrl" aria-disabled="true"
        aria-label="Undo last change" aria-describedby="undo-shortcut-desc">
  <svg aria-hidden="true"><use href="/sprites.svg#icon-undo"/></svg>
  <span class="board-ctrl__text">
    <span data-undo-label>Undo</span>
    <span data-undo-key class="board-ctrl__key" aria-hidden="true"></span>
  </span>
  <span id="undo-shortcut-desc" class="sr-only"></span>
</button>
```

and the mirror for Reset — `data-reset-key`, `id="reset-shortcut-desc"`, and **Reset's bare text
node wrapped in `<span data-reset-label>Reset</span>`** so it has the same text column Undo does
[86, 62].

Decisions baked in here:

- **Reading order is icon → label → shortcut** [104]. The icon is not reordered and the label does
  not move above it — item 48's reading of the sketch is superseded by [62].
- The visible key spans start **empty** and are filled at runtime, because the string is
  platform-dependent [40, 95]. Nothing renders before Task 4 runs.
- `aria-hidden="true"` on the visible key span, with the spelled-out text in a **separate**
  visually-hidden element that `aria-describedby` targets [92]. Both live inside the button, where
  `aria-label` already suppresses the contents from the accessible name — so neither string can
  leak into browse-mode reading as stray text between the two buttons.
- Description text, not name text [54]: the button still leads with "Undo last change", and
  "Keyboard shortcut: Control Z" follows once, rather than bloating a name that is re-read on
  every `aria-disabled` change.
- The words, never the glyph [103]: visible `Ctrl + Z` / `Cmd + Z`, spoken `Control Z` /
  `Command Z`. No `⌘` anywhere.

---

## Task 4 — CSS: `.board-ctrl` becomes icon + text column

Implements [49, 51, 52, 62, 63, 64, 66, 85, 90]. `src/tailwind.css:609–631`.

`.board-ctrl` keeps `display: inline-flex; align-items: center` — the icon stays on one side and
the new `.board-ctrl__text` column sits beside it, vertically centred against the icon, so with no
shortcut the label is centred alone and with one the pair shares the space [62].

```css
.board-ctrl__text {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  line-height: 1.15;
}
.board-ctrl__key {
  font-size: 0.875rem;   /* 14px [49] */
  font-weight: 500;
  height: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  transition: height 200ms ease, opacity 200ms ease;   /* [63] */
}
:root[data-keyboard="true"] .board-ctrl__key { height: 1.05rem; opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .board-ctrl__key { transition: none; }   /* [64] */
}
```

- **0.875rem, not 0.75rem** [49] — matching the button's existing label size. The
  `[aria-disabled="true"] { opacity: 0.4 }` fade applies a large part of the time, and 12px at 40%
  opacity is the hardest thing in the app to read.
- **Full-strength colour, no `text-text/60`** [50] — small text must clear 4.5:1 (WCAG 1.4.3) and
  60% opacity on the body colour will not. It inherits the button's colour; no new colour token, so
  the under-15 budget is untouched [31, 38-dropped].
- **`height` between two explicit values, not `max-height` or `grid-template-rows`** — the content
  is exactly one line of known size, so an explicit `height` transitions correctly and identically
  in every engine, where `grid-template-rows: 0fr→1fr` has patchier support and `max-height` eases
  against a value that isn't the real height. `white-space: nowrap` guarantees the single line.
- **rem, not px** [52] — browser zoom and text-only resize both work (WCAG 1.4.4).
- The existing `opacity: 0.4` disabled fade is left exactly as it is: the shortcut line is inside
  the button now, so it greys with its control automatically [51, 53]. WCAG 1.4.3 exempts inactive
  components.
- The reveal makes the button taller and nudges the digit boxes down a few pixels; the 200ms
  transition is what stops that reading as a glitch [66]. Touch layout is untouched — the attribute
  never gets set on a pure-touch device [52].

---

## Task 5 — keyboard detection and hint rendering

Implements [21, 27, 40, 65, 95, 103]. `src/app.ts`.

```ts
let keyboardSeen = false;
const MODIFIER = modifierLabel(
  (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
    ?? navigator.platform,
);
const SPOKEN = MODIFIER === 'Cmd' ? 'Command' : 'Control';

function showKeyboardHint(): void {
  if (keyboardSeen) return;
  keyboardSeen = true;
  if (dom.undoKey) dom.undoKey.textContent = `${MODIFIER} + Z`;
  if (dom.resetKey) dom.resetKey.textContent = `${MODIFIER} + X`;
  if (dom.undoDesc) dom.undoDesc.textContent = `Keyboard shortcut: ${SPOKEN} Z`;
  if (dom.resetDesc) dom.resetDesc.textContent = `Keyboard shortcut: ${SPOKEN} X`;
  document.documentElement.setAttribute('data-keyboard', 'true');
}

// (a) a real pointer means a laptop or desktop, which effectively always means a keyboard
if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) showKeyboardHint();
// (b) catches an iPad with a Magic Keyboard, where the pointer test fails
document.addEventListener('keydown', showKeyboardHint, { once: true, capture: true });
```

Four new entries in the `dom` cache: `undoKey`, `resetKey`, `undoDesc`, `resetDesc`.

- Two triggers, either one shows it [21]. Pure-touch users never see it; desktop users see it
  without pressing anything; hybrid users get it the moment they use the keyboard.
- The `{ once: true, capture: true }` listener is **separate** from the game keydown handler on
  purpose: that handler returns early on `gameState.solved`, and a keypress typed into the feedback
  textarea still proves a keyboard exists. Registering it in capture with `once` means it costs one
  keydown for the life of the page.
- `keyboardSeen` is in memory for the page session only, not sessionStorage [27]. A desktop is
  re-covered by the pointer test on every load; only a touch-first device with a keyboard loses the
  hint on refresh, and it comes back on the next keypress.
- Platform detected **once at load** [40], `userAgentData.platform` preferred, `navigator.platform`
  as fallback, Ctrl when neither is conclusive [95]. iPadOS reporting "Macintosh" is harmless — an
  iPad keyboard has a Command key, and the matcher accepts either modifier anyway [12], so a wrong
  guess is only ever cosmetic.
- The transition is only ever seen on a hybrid device: on desktop the pointer test matches before
  first paint [65].
- Not a live region, never announces itself [61] — it is static description reached via
  `aria-describedby`.

---

## Task 6 — `undoLast()` / `resetBoard()` report whether they acted

Implements [14-corrected, 56, 57, 58, 84, 93]. `src/app.ts`. **This is the correction from
da-brief item 84** — the brief's original "not one line of `undoLast()` changes" was wrong.
Behaviour parity [9] stands; the no-change claim does not.

Two problems to fix at once: `undoLast()` returns `void`, so no caller can tell whether it acted
(which [57] and [70] both need), and it calls `announceReset(false)`, which blanks the live region
[56] wants to write "Undone." into.

**Announcement helper**, replacing the direct writes to `dom.undoMsg`:

```ts
let announceTimer: number | undefined;

function announce(message: string): void {
  if (!dom.undoMsg) return;
  clearTimeout(announceTimer);
  dom.undoMsg.textContent = '';          // clear synchronously
  if (!message) return;
  // Two consecutive undos produce identical text, and a polite region whose content
  // does not change is not re-announced. Clearing then rewriting after a beat makes
  // the second undo audible. 100ms is under the polite-region settle time and well
  // above a same-task microtask, which AT would coalesce away.
  announceTimer = window.setTimeout(() => { dom.undoMsg!.textContent = message; }, 100);
}

function announceReset(on: boolean): void {
  announce(on ? 'Board reset. Undo reset available.' : '');
}
```

`announceReset` keeps its signature and its exact string [58, 47], so all six existing call sites
are untouched.

**Return values:**

```ts
// Returns the kind of entry stepped back over, or null if nothing happened.
function undoLast(): EntryKind | null {
  if (gameState.solved) return null;
  const kind = boardHistory.nextKind();      // read BEFORE the pop
  const previous = boardHistory.undo();
  if (previous === null) return null;
  applyBoard(previous);
  return kind ?? 'toggle';
}

// Returns true if the board was actually reset.
function resetBoard(): boolean {
  if (gameState.solved || isStartingBoard(possibles)) return false;
  pushHistory('reset');
  applyBoard(startingBoard());
  announceReset(true);
  return true;
}
```

Note `undoLast()` **no longer announces at all** — the `announceReset(false)` clear moves out to the
callers, so the keyboard path can write its own message instead of having it wiped. The click
handler becomes `if (undoLast()) announceReset(false);`, which reproduces today's behaviour exactly:
a click clears any stale reset message and says nothing new, because focus is already on the button
and the action is self-evident [56].

**Announcement matrix** for the keyboard path (all via `announce()`, all suppressed while
`e.repeat` is true [93]):

| Situation | Spoken |
|---|---|
| Undo stepped back over a toggle | `Undone.` [56] |
| Undo stepped back over a reset | `Undo reset.` [56] |
| Undo with an empty stack | `Nothing to undo.` [57] |
| Reset acted | `Board reset. Undo reset available.` — unchanged [58] |
| Reset on an already-starting board | `Board is already clear.` [57] |
| Any of the above on a solved board | nothing — the handler never reaches the branch [17] |

Silence on a shortcut press is the exact failure item 4 says must not be introduced; an unexplained
silence is indistinguishable from a broken key [57].

---

## Task 7 — the keydown branch

Implements [15, 16, 17, 18, 19, 28, 33, 59, 69, 70, 94, 98]. `src/app.ts`, the existing `document`
keydown listener at ~line 1014.

Placed **immediately after `if (gameState.solved) return;` and before the digit branch** [28]. That
solved guard is what makes [17] free — a shortcut on a solved board never reaches the new branch, so
no extra guard and no announcement. (Item 98 is right that the original justification was wrong —
`parseInt('z')` is `NaN`, so `Ctrl+Z` could never have been read as a digit. First is still where a
reader expects a modifier branch, and it is robust to the digit branch changing.)

```ts
const action = matchShortcut(e);
if (action) {
  if (getCurrentScreen() !== 'game') return;      // [32] game screen only
  if (isTypingTarget(e.target)) return;           // [16] Cmd+X must still cut
  if (isOverlayOpen()) return;                    // [16, 94]
  if (isWalkthroughActive()) return;              // [33]

  e.preventDefault();                             // [15] after the guards, never before
  if (action === 'undo') {
    const kind = undoLast();
    if (!kind) { if (!e.repeat) announce('Nothing to undo.'); return; }   // [19, 57, 70]
    if (!e.repeat) {
      announce(kind === 'reset' ? 'Undo reset.' : 'Undone.');             // [56, 93]
      track('undo_used', undefined, 'keyboard');                          // [67, 69]
    }
  } else {
    if (!resetBoard()) { if (!e.repeat) announce('Board is already clear.'); return; }
    if (!e.repeat) track('reset_used', undefined, 'keyboard');
  }
  return;
}
```

Guard helpers:

```ts
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

function isOverlayOpen(): boolean {
  // The native `open` property, NEVER the `.open` class: modals.ts removes that class
  // before the dialog actually closes on transitionend, so a class check reports
  // "closed" while the dialog is still up with focus inside it [94].
  const fb = document.querySelector('[data-fb-modal]') as HTMLDialogElement | null;
  if (fb?.open) return true;
  const menu = document.querySelector('[data-menu]');
  return !!menu && !menu.classList.contains('hidden');
}
```

Ordering that matters: **`preventDefault()` comes after every guard**, so `Cmd+X` inside the
feedback textarea still cuts and `Cmd+Z` still undoes the player's typing [16]. A shortcut that eats
Cut inside a textarea is a bug, not a feature.

How to Play is **not** in the overlay list: `[data-htp-btn]` calls `navigate('/welcome')`
(`app.ts:1265`) — it is a screen, already covered by the `getCurrentScreen()` gate [94].

Auto-repeat: holding the key steps back repeatedly until the stack is empty, the same as native
undo [18]. `e.repeat` suppresses only the announcement [93] and the analytics event [69], never the
action itself — holding for a second would otherwise write to a polite region at the OS repeat rate
and post thirty identical analytics rows.

A shortcut never moves focus — nothing in this branch touches focus, and both controls stay
`aria-disabled` rather than natively disabled [59].

The two click handlers gain their `'button'` source in the same edit:
```ts
dom.undoBtn?.addEventListener('click', () => { if (undoLast()) { announceReset(false); track('undo_used', undefined, 'button'); } });
dom.resetBtn?.addEventListener('click', () => { if (resetBoard()) track('reset_used', undefined, 'button'); });
```
Presses that do nothing send no event [70]. Both routes are tracked, not just the keyboard — a
keyboard-only count is a number with no denominator [67].

---

## Task 8 — worker: allowlist and the `source` split

Implements [67, 71, 81, 82, 101, 102]. Authorised exception, see the scope note.

**`src/worker/index.ts:25`** — add `'undo_used', 'reset_used'` to `VALID_EVENTS`. Without this the
POST 400s and `track()`'s `.catch(() => {})` swallows it, so the feature looks fine and records
nothing [81]. One line. `source` already rides in blob3 (`index.ts:409`) and anonymity is unchanged
— the same anonymous `uid` and `newUser` flag, no new field, no key-by-key logging [71].

**`src/worker/stats.ts`** — the dashboard's interactions table (`stats.ts:127`) is a hardcoded
key/label list read from `eventMap`, which is grouped by blob1 only, so `source` is written and
never queried [82]. Two changes:

1. A sixth query in `getStats`'s `Promise.all`, returning `sourceSplit`:
   ```sql
   SELECT blob1 AS event, blob3 AS source, COUNT() AS count FROM clumeral ${where}
   AND blob1 IN ('undo_used', 'reset_used') GROUP BY event, source ORDER BY count DESC
   ```
2. In `renderDashboard`, build `sourceMap` keyed `` `${event}|${source}` `` and append four rows to
   the interactions table: **Undo used (keyboard)**, **Undo used (button)**, **Reset used
   (keyboard)**, **Reset used (button)**. Missing keys render `0`, matching the existing
   `eventMap.get(key) ?? 0` behaviour.

Without step 2 item 67's entire justification — comparing keyboard against button — is not
delivered [82].

No impression event for the hint [68]: it would fire on essentially every desktop game load, a lot
of noise to answer a question the `source` split answers better.

Item 100 (write volume) is checked at review, not built for: undo is a repeated action and
`undo_used` could out-fire `puzzle_start`. `e.repeat` suppression [69] is the mitigation already in
Task 7; **glance at the Analytics Engine write budget before the PR merges** — noted, not a blocker.

**`docs/URL-ARCHITECTURE.md:224`** — add both names to the documented `VALID_EVENTS` list, with a
line noting they carry `source` of `keyboard` or `button`.

---

## Task 9 — tests

QA level is **targeted, not the full battering** [73]: new cases extend the existing specs, and the
full cross-engine suite runs in CI as usual with nothing new built for it. The change is one keydown
branch, one CSS rewrite and two events — but it touches keyboard handling, layout and accessibility
at once, so "no tests" is wrong too.

**Unit — `tests/shortcuts.spec.ts`** (Task 1, written first) [74].

**Unit — `tests/stats-dashboard.spec.ts`**: call the exported `renderDashboard()` with a fake
`getStats` shape carrying `undo_used`/`keyboard` = 7 and `undo_used`/`button` = 3, assert all four
split rows render with the right figures and that a missing combination renders `0`. Pure string
builder, no network [82].

**E2E — `e2e/specs/undo-reset.spec.ts`**, appended to the existing describe [75]:
- eliminate a digit, `Control+Z`, the digit is back and the board matches the pre-toggle state
- eliminate several, `Control+X`, board clear, Undo reads "Undo reset", one `Control+Z` restores the
  whole pre-reset board
- auto-repeat: press `Control+Z` repeatedly past the bottom of the stack — unwinds to empty, then
  stops, no error, Undo goes `aria-disabled`
- `Control+Z` and `Control+X` on a solved board change nothing (use `solvePuzzle` from the existing
  helper)
- `Control+Shift+Z` does nothing
- **regression watch** [75]: the existing bindings still work with the new branch ahead of them —
  digits toggle, Tab/arrows move between boxes, Enter submits a resolved board, Escape closes the
  keypad

All of these use `Control`, not `Meta` — CI runs Linux and the harness must not depend on the Mac
modifier [96].

**E2E — exclusions** [16, 76]: with the feedback modal open and text typed into the textarea,
`Control+X` cuts the text and the board is untouched; with the menu open, neither key changes the
board. `Control+X`, not `Cmd+X` — `Meta+X` does not cut in any engine on Linux [96].

**E2E — the hint** [77], each case naming the projects it applies to, because `undo-reset.spec.ts`
runs on all five Playwright projects and an ungated case fails on the other four [97]:
- `chromium-desktop`: the shortcut text is visible on load, reading `Ctrl + Z` / `Ctrl + X`
- `mobile-chromium`: absent on load (no keydown sent)
- `mobile-chromium`: send one keypress, then it appears

**E2E — a11y — `e2e/specs/a11y.spec.ts`** [78], on the existing `A11Y_PROJECTS`:
- axe passes (serious/critical) on the game screen with the hint shown, both colour schemes, as the
  existing pass already does
- Undo exposes **both** its name and its description: `aria-label` "Undo last change" *and*
  `aria-describedby` resolving to "Keyboard shortcut: Control Z"; same for Reset with "Control X"
- the visible key span carries `aria-hidden="true"` [92]

**E2E — the worker allowlist — `e2e/specs/ssr-pages.spec.ts`** [81]: `request.post('/api/event')`
with `{event:'undo_used', uid:'e2e', source:'keyboard'}` expects **202**, and a bogus event name
expects **400**. This is the only automated proof that H1 is actually fixed — the frontend cannot
tell, because `track()` swallows the failure. It writes a datapoint against the preview hostname;
`whereClause` filters on `blob4 = hostname`, so production figures are unaffected.

**Manual, on the branch preview** [79] — automation is poor at these:
- VoiceOver or NVDA actually reads the description and the new live-region messages [54, 56, 57]
- contrast of the shortcut line in both light and dark themes [50]
- `prefers-reduced-motion: reduce` kills the 200ms transition [64]
- the reveal on a real tablet with a keyboard [65]

Jamie takes the screen-reader and contrast checks, since accessibility is his; both of you eyeball
the layout on the preview before the PR is raised [79].

---

## Commit order

1. `src/shortcuts.ts` + `tests/shortcuts.spec.ts` (Task 1)
2. `getCurrentScreen()` + `isWalkthroughActive()` (Task 2)
3. `undoLast()`/`resetBoard()` return values + `announce()` (Task 6) — behaviour-neutral, existing
   e2e must stay green on its own
4. markup + CSS (Tasks 3, 4)
5. keyboard detection + hint rendering (Task 5)
6. the keydown branch + click-handler sources (Task 7)
7. worker allowlist + dashboard split + doc update (Task 8)
8. e2e and the stats unit test (Task 9)

Each is independently testable. Step 3 lands before anything calls the new return values so a
regression there is isolated from the feature.

## Done

All of the above green, the CI smoke suite passing cross-engine, `da-build` clean, and the brief
plus this plan committed on the branch [80].

## Follow-ups — not in this PR

- **Item 99 (da-brief L5), a pre-existing bug.** The digit branch has no target check and
  `activeBox` is not cleared when the feedback modal opens, so typing a digit into the feedback
  textarea toggles a board digit today and `preventDefault()` eats the character. Item 7 keeps it
  out of scope, which is right — but the exclusion e2e in Task 9 tests one keystroke away from it.
  **Needs logging as its own issue; awaiting Jamie's go-ahead to file it.**

---

## Traceability

Every numbered brief item, accounted for.

- **Task 1** — 12, 13, 34, 40, 74, 87, 95, 103
- **Task 2** — 32, 33, 88
- **Task 3** — 48, 54, 55, 62, 86, 91, 92, 104
- **Task 4** — 49, 50, 51, 52, 63, 64, 66, 85, 90
- **Task 5** — 21, 27, 61, 65
- **Task 6** — 56, 57, 58, 84, 93
- **Task 7** — 14, 15, 16, 17, 18, 19, 28, 29, 59, 69, 70, 94, 98
- **Task 8** — 67, 68, 71, 81, 82, 100, 101, 102
- **Task 9** — 73, 75, 76, 77, 78, 79, 80, 96, 97
- **No code needed** — 1, 2, 3, 4, 5 (framing and direction, carried into the sections that own
  them); 6, 7, 8, 9, 10, 11 (out of scope — no redo, no other shortcuts, not remappable, no
  behaviour change, no touch change, no How to Play change); 20 (Ctrl/Cmd+X confirmed, implemented
  by 12); 22 (no confirm step — the absence of code is the decision); 23 (maths n/a); 24, 25, 26 (no
  new persisted state, no dismissal, no fade-out — all absences); 30 (**withdrawn** by 102 — the
  worker IS touched); 31 (superseded by 85, 86 — two hint spans, and a `.board-ctrl` rewrite, not
  utilities only); 35, 37, 38, 39, 41 (superseded by the §7 reopening — 48–52, 62–66); 36, 43, 44,
  45, 46 (**retired** by 89 and 103 — the shared between-buttons label no longer exists; there is no
  separator and no action word to case, and 46's combined sentence is replaced by 91's per-button
  form); 42 (the hint sits inside the controls row, so it disappears with it on a solved board — no
  extra code); 47 (no wording change elsewhere); 53 (the size answer, delivered by 49 + 50 + 52);
  60 (WCAG 2.1.4 does not apply — both bindings take a modifier, which is why bare U/R were never
  proposed); 72 (**withdrawn** by 101); 83 (answered (a) by 101); 89 (implemented via 103); 99
  (logged as a follow-up above)

Nothing in the brief is unhandled.
