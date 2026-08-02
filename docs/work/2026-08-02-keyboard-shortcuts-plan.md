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
- `e2e/pages/game.page.ts` — one new locator (see Task 3, this is not optional)
- `e2e/specs/undo-reset.spec.ts`, `e2e/specs/a11y.spec.ts`
- `tests/worker-guard.spec.ts`
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

Implements [32, 88]. (Item 33's guard is *used* in Task 7; this task only adds the getter.)

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
building a walkthrough DOM harness for a `return active`. **Covered by the walkthrough e2e case in
Task 9 instead.** No unit test.

There is no `e2e/specs/walkthrough.spec.ts` — the walkthrough has unit coverage
(`tests/walkthrough.spec.ts`, pure exports only) and no e2e at all today. The new case therefore
goes into `undo-reset.spec.ts` alongside the other exclusion tests, not into a spec that does not
exist.

**Known limit — `getCurrentScreen()` lags by one fade.** `src/screens.ts:112–128` assigns
`currentScreen = next` *inside* the `FADE_OUT_MS = 200` timer, so for 200ms after a
`showScreen('welcome')` the getter still returns `'game'`. A shortcut fired in that window — e.g.
immediately after tapping How to Play — would still mutate the board. Accepted: it is a 200ms
window requiring a modifier chord mid-transition, `gameState.solved` does not cover it, and the
alternative (DOM sniffing) is wrong for the whole 200ms rather than exact outside it. Recorded so
it is a known limit and not a surprise at `da-build`.

---

## Task 3 — markup: shortcut lines inside both buttons

Implements [48, 54, 55, 62, 86, 91, 92, 104]. Markup and CSS land together with Task 4;
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

### Required in the same commit — ten existing e2e assertions break otherwise

`e2e/pages/game.page.ts:33` defines `undo = page.locator("[data-undo]")` — the **button**, not its
label — and ten assertions match its whole text:

```
e2e/specs/undo-reset.spec.ts:137,164,176,191,203  toHaveText("Undo")
e2e/specs/undo-reset.spec.ts:145,173,187,195,279  toHaveText("Undo reset")
```

`toHaveText` is a whole-string match over `textContent` with `useInnerText: false`, so `sr-only`
content counts. Once Task 5 fills the spans, the button's textContent on a desktop project reads
`Undo Ctrl + Z Keyboard shortcut: Control Z` and all ten fail — on `chromium-desktop`,
`firefox-desktop` and `webkit-desktop` only, because the spans stay empty on the two mobile
projects. A half-red matrix reads like an engine bug rather than an expected consequence.

**Fix, landing in the same commit as the markup:**
- add `readonly undoLabel: Locator` to `e2e/pages/game.page.ts`, as
  `page.locator("[data-undo-label]")`
- repoint all ten assertions from `game.undo` to `game.undoLabel`

This is also the more honest assertion: `renderBoardControls()` (`src/app.ts:546`) writes
`dom.undoLabel.textContent`, so the label span is what the relabel regression suite from #251 is
actually about. **Do not weaken these to `toContainText`** — the whole-string match is what proves
"Undo" has become "Undo reset" and not merely gained it.

---

## Task 4 — CSS: `.board-ctrl` becomes icon + text column

Implements [49, 50, 51, 52, 63, 64, 66, 85, 90]. `src/tailwind.css:609–631`.

All of the new rules go in **`@layer utilities`** (opened at `src/tailwind.css:489`), the same layer
`.board-ctrl` already lives in — otherwise the cascade differs from what this task assumes.

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
- **Correction to item 66: the button does not actually get taller, and nothing below it moves.**
  `.board-ctrl` already carries `min-height: 2.75rem` (44px, the touch target, `tailwind.css:614`).
  The revealed two-line column computes to roughly `0.875rem × 1.15` (label) `+ 1.05rem` (key)
  ≈ **2.06rem / 33px**, comfortably inside that floor. So the reveal is absorbed entirely by the
  existing button height: the digit boxes do not shift, and item 66's "nudges the boxes down a few
  pixels" cannot occur. The 200ms transition is still worth having and is still what [63] asked
  for — it smooths the **label shifting up inside the button** as the column grows under it, plus
  the key text fading in. This is a factual correction to a consequence, not a change to any
  decision: [63] (there is a transition), [64] (it honours reduced motion) and [66] (the shift is
  accepted) all stand.
  **Do not write an e2e assertion on a `boundingBox` delta for the digit boxes** — it can only ever
  be zero, and a builder chasing item 66 literally will either write a test that cannot pass or add
  height the design does not need.
- Touch layout is untouched — the attribute never gets set on a pure-touch device [52].

---

## Task 5 — keyboard detection and hint rendering

Implements [21, 27, 61, 65]. `src/app.ts`. Consumes the platform rules [40, 95, 103] built in
Task 1.

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

Implements [14, 56, 57, 58, 84, 93]. `src/app.ts`. **This is the correction from
da-brief item 84** — the brief's original "not one line of `undoLast()` changes" was wrong.
Behaviour parity [9] stands; the no-change claim does not.

Two problems to fix at once: `undoLast()` returns `void`, so no caller can tell whether it acted
(which [57] and [70] both need), and it calls `announceReset(false)`, which blanks the live region
[56] wants to write "Undone." into.

**Announcement helper**, replacing the direct writes to `dom.undoMsg`:

```ts
let announceTimer: number | undefined;
let lastAnnounced = '';

function announce(message: string): void {
  if (!dom.undoMsg) return;
  clearTimeout(announceTimer);
  if (message !== lastAnnounced) {
    // Normal path — a changed message IS re-announced, so write it synchronously.
    // Every existing call site takes this branch, unchanged.
    dom.undoMsg.textContent = message;
    lastAnnounced = message;
    return;
  }
  // Repeat path: two consecutive undos produce identical text, and a polite region
  // whose content does not change is not re-announced at all. Clear now, rewrite
  // after a beat, so the second undo is audible. 100ms is under the polite-region
  // settle time and well above a microtask, which AT would coalesce away.
  dom.undoMsg.textContent = '';
  announceTimer = window.setTimeout(() => { dom.undoMsg!.textContent = message; }, 100);
}

function announceReset(on: boolean): void {
  announce(on ? 'Board reset. Undo reset available.' : '');
}
```

`announceReset` keeps its signature and its exact string [58, 47], so all six existing call sites
are untouched.

**Why the two branches rather than always deferring.** `announceReset(true)` writes
`dom.undoMsg.textContent` synchronously today (`src/app.ts:527`). Deferring every write by 100ms
would make commit-order step 3 a real behaviour change, quietly invalidate any synchronous read of
`[data-undo-msg]`, and only Playwright's auto-retry would hide it. Branching on
`message !== lastAnnounced` means **every existing path stays exactly synchronous** and only the
genuinely-identical repeat — which is new in this PR — pays the 100ms. That is what makes step 3
behaviour-neutral rather than merely looking it.

One consequence worth naming: on a held-key unwind, the single non-repeat announcement is the
**first** keydown's, and `e.repeat` suppresses the rest [93]. A twenty-step unwind therefore speaks
"Undone." once, at the start, not once per step. Deliberate — the alternative is a polite region
written at the OS repeat rate.

**Return values:**

```ts
// Returns the kind of entry stepped back over, or null if nothing happened.
function undoLast(): EntryKind | null {
  if (gameState.solved) return null;
  const kind = boardHistory.nextKind();      // read BEFORE the pop
  const previous = boardHistory.undo();
  if (previous === null) return null;
  applyBoard(previous);
  return kind;   // non-null whenever undo() was: nextKind() and undo() share the empty-stack guard
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

Implements [15, 16, 17, 18, 19, 28, 29, 33, 59, 69, 70, 94, 98]. `src/app.ts`, the existing `document`
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

Implements [67, 68, 71, 81, 82, 100, 101, 102]. Authorised exception, see the scope note.

**`src/worker/index.ts:25`** — add `'undo_used', 'reset_used'` to `VALID_EVENTS`, and change the
`const` to `export const` so the allowlist is unit-testable (the module has only a default export
today, and its body is definitions only — importing it in vitest runs no side effects). Without the
two names the
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

**Small re-scope of item 101, stated rather than implied.** Item 101 says "both events added to the
interactions list", which reads as two rows. This delivers **four** — the split — and no combined
total, because a combined `undo_used` row alongside its own two components would be a third number
that is just their sum. The split is what item 67 asked the events for; if Jamie wants the totals
too, that is two more `eventMap` rows and a one-line change.

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

**Unit — `tests/stats-dashboard.spec.ts`**: call the exported `renderDashboard()` with a fake stats
object carrying `undo_used`/`keyboard` = 7 and `undo_used`/`button` = 3, assert all four split rows
render with the right figures and that a missing combination renders `0`. Pure string builder, no
network [82]. Note the parameter is typed `Awaited<ReturnType<typeof getStats>>`
(`src/worker/stats.ts:72`), so the fake must construct **all six** query shapes — `events`, `daily`,
`uniqueUsers`, `newUsers`, `guessDistribution` and the new `sourceSplit` — each as
`{ data: [...], rows: n }`, not just the new one.

**Unit — `tests/worker-guard.spec.ts`**, extended: import the newly-exported `VALID_EVENTS` from
`src/worker/index.ts` and assert it contains `undo_used` and `reset_used`. This is the automated
proof that H1 (item 81) is fixed — the frontend cannot tell, because `track()` swallows the 400.

Deliberately **not** an e2e POST to `/api/event`. E2E runs against `vite preview` with the Cloudflare
plugin (workerd, local bindings), so a `writeDataPoint` that throws locally would be caught by the
handler's own `try/catch` and returned as a **400** — indistinguishable from an allowlist rejection,
i.e. red on a correct implementation. The unit test tests the thing that was actually broken without
that ambiguity. Residual gap, accepted: nothing automated proves the full browser → worker →
Analytics Engine round trip. Item 100's write-budget glance is the manual pass over that ground.

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

**E2E — the ten repointed label assertions** — see Task 3. They move from `game.undo` to
`game.undoLabel` in the markup commit, and they are the regression that proves the "Undo reset"
relabel still works with a second line inside the button.

**E2E — the new announcements** [56, 57], asserted on `[data-undo-msg]` via the existing
`game.undoMsg` locator (`e2e/pages/game.page.ts:35`, already used at `undo-reset.spec.ts:149`).
These are five specific strings, and whether they are *written* is plain text assertion — manual
screen-reader checking covers whether they are *spoken*, which is a different question and no
substitute:
- eliminate, `Control+Z` → `Undone.`
- eliminate, `Control+X`, `Control+Z` → `Undo reset.`
- `Control+Z` on an untouched board → `Nothing to undo.`
- `Control+X` on an untouched board → `Board is already clear.`
- `Control+X` on a touched board → `Board reset. Undo reset available.` (unchanged [58])

**E2E — exclusions** [16, 76]: with the feedback modal open and text typed into the textarea,
`Control+X` cuts the text and the board is untouched; with the menu open, neither key changes the
board. `Control+X`, not `Cmd+X` — `Meta+X` does not cut in any engine on Linux [96].

**E2E — the walkthrough guard** [33], one case, one project (`chromium-desktop`): the walkthrough
auto-starts only when `localStorage.dlng_history` is absent (`src/walkthrough.ts:296`), so load a
playable game with history unseeded, wait for it to be running, press `Control+Z`, and assert the
board is unchanged. This is the only coverage `isWalkthroughActive()` gets — Task 2 declines a unit
test for it, and the walkthrough has no other e2e today.

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
4. markup + CSS (Tasks 3, 4) — **including the `game.page.ts` locator and the ten repointed
   assertions**, which are not a follow-up: without them the suite goes red at step 5, on three
   projects out of five
5. keyboard detection + hint rendering (Task 5)
6. the keydown branch + click-handler sources (Task 7)
7. worker allowlist + dashboard split + doc update (Task 8)
8. remaining e2e and the two unit tests (Task 9)

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

## Build record — 2026-08-02

Built from this plan on `dev/keyboard-shortcuts`, eight commits in the order above.
`npm run build` clean, `npx tsc --noEmit` clean, vitest 317 passing (22 files, up from 309/21).
Playwright is CI-only — nothing in the e2e additions has been run locally.

Two deviations from the plan text, both small and both deliberate:

1. **`announce('')` short-circuits.** The plan's two branches would have sent every
   clear down the repeat path, because `lastAnnounced` starts `''` and `announceReset(false)`
   fires on every digit tap — queueing a 100ms timer per tap to write `''` over `''`.
   Clearing is not an announcement, so it now returns synchronously before the repeat
   branch. This makes M3's "every existing call site stays synchronous" true of the clears
   as well as the writes, which is what M3 was actually after.
2. **`game.page.ts` gained `undoKey` and `resetKey` as well as `undoLabel`.** The hint
   assertions in Task 9 need locators for the two key spans; the plan named only `undoLabel`.

Everything else landed as written, including the ten repointed assertions in the same
commit as the markup (H1), the four-row dashboard split, and the exported `VALID_EVENTS`.

### Jamie's preview review — 2026-08-02, four changes

Reviewed on the branch preview. All four agreed in chat and built; recorded here because
chat is not the memory.

1. **Shortcut text 14px → 13px** (`0.8125rem`). A step below the button's own 14px label so
   the shortcut reads as secondary. The reveal height drops 1.05rem → 0.95rem to match the
   smaller line box. Still "normal" text for WCAG either way, so the 4.5:1 bar is unchanged.
2. **Label and shortcut left-aligned to each other** — `.board-ctrl__text` goes
   `align-items: center` → `flex-start`. The column stays vertically centred against the
   icon, so [62] and Jamie's Saturday note both still hold; only the two lines' shared edge
   changes.
3. **Keyboard detection no longer trusts any keydown.** Jamie revealed the hint on an
   iPhone by typing feedback — an on-screen keyboard firing keydown is not evidence of a
   physical one, and it advertised shortcuts that phone can never send. A keydown now only
   counts when `isTypingTarget(e.target)` is false: iOS cannot raise its keyboard without a
   focused text field, so a keypress anywhere else means real keys. **Any** key qualifies
   rather than a hand-picked Tab/digit list — Tab, digits, arrows and Escape are all real
   board bindings, and a list would be one more thing to keep in step with the keydown
   handler. `isTypingTarget` moved from `app.ts` to `shortcuts.ts` so both the shortcut
   guard and the detector share one definition and it can be unit-tested.
   **Consequence, accepted by Jamie:** the listener can no longer be `once` — the first
   keydown of a session is often a character typed into feedback, so it has to survive that
   and keep watching. It removes itself once it fires for real. A tablet-with-keyboard
   player who *only* ever types in the feedback box now never sees the hint; one Tab or
   digit anywhere else brings it back, and Jamie's call is that this is the right trade for
   what is mostly an accessibility affordance.
4. **Shortcut colour to 80% of the text colour.** Measured against the real tokens on
   `--color-surface`: full strength is 15.16:1 light / 13.52:1 dark, and each theme would
   touch the 4.5:1 floor at 63% / 50%. 80% gives **7.90:1 light and 9.20:1 dark** — about
   half the distance to the floor, clearing AAA in both. A single value rather than the
   exact per-theme pair (81% / 75%), because the difference is invisible and one number is
   easier to keep honest. Applied as `color-mix(in srgb, currentColor 80%, transparent)`, so
   it still inherits and the disabled fade still multiplies over it.

New coverage for 3: `isTypingTarget` unit tests in `tests/shortcuts.spec.ts`, and an e2e
regression on `mobile-webkit` proving that typing into the feedback box reveals nothing and
that detection still works afterwards. The `mobile-chromium` reveal case now presses Tab
rather than a letter, which is what a keyboard player actually presses first.

### The walkthrough broke the shortcuts outright — disabled (#294)

Jamie, macOS Firefox on the branch preview: **the shortcuts did nothing**, in every focus
state he tried. His diagnosis was right, and it is this plan's own Task 7 guard.

`isWalkthroughActive()` returns early in the shortcut branch [33] so an undo cannot land
mid-step and desync a tutorial narrating real board actions. Correct in principle. What
makes it fatal is the walkthrough's lifetime:

- `start()` sets `active = true` on entering the game screen, before the 5s hold elapses.
- Steps 3 and 6 are **gated** — they wait indefinitely on `game:box-opened` and
  `game:digit-eliminated`.
- `finish()` only runs on the final step or on leaving the game screen.

So a first-time player who never opens a box holds the flag forever, and the shortcuts
never work at all. Anyone else has them dead for the length of the script. Every e2e case
in Task 9 seeds history via `gotoPlayableGame`, which is exactly why the suite would have
stayed green.

**Jamie's call: disable the walkthrough rather than patch its lifetime.** It is being
replaced with a proper first-play tutorial and was already getting in the way. One
`WALKTHROUGH_ENABLED` constant in `src/walkthrough.ts`, so re-enabling is a one-line revert.
**#294** tracks removing the code once the replacement lands.

Knock-ons:

- **Correction to this plan's `da-plan` M1 note, which was wrong.** It states
  "`e2e/octopus-walkthrough.spec.ts` — that file does not exist; the walkthrough has no e2e
  spec at all". It does exist, in the `e2e/` root, and runs under the `legacy-chromium`
  project (`playwright.config.ts` LEGACY pattern). Five of its six cases assert the
  walkthrough runs, so they are skipped with a pointer to #294 — skipped, not deleted,
  because it is the executable description of the sequence the replacement has to better.
- Task 9's walkthrough-guard e2e case is **replaced** by its inverse: a first-time player
  with no seeded history can use both shortcuts. That is the regression Jamie hit, it runs
  on the full matrix rather than one project, and it will catch a replacement tutorial
  making the same mistake.
- The `isWalkthroughActive()` guard **stays** in `app.ts`, always false for now, commented
  with the trap. The replacement will want it — and must actually terminate.
- Stale comment in `e2e/specs/restore.spec.ts` corrected.
- Bundle drops 65.8 kB → 62.3 kB, since the walkthrough runtime tree-shakes out behind the
  `const false`.

### da-build review — 2026-08-02

Fresh-context pass after Jamie's preview review: **0 High, 2 Medium, 6 Low**. All eight
fixed; nothing deferred.

- **M1 — the hint e2e hardcoded `Ctrl`.** The app derives the modifier from the platform, so
  those five assertions were really asserting "the runner is not a Mac". Green on Linux CI,
  red the first time Jamie or Dave ran e2e locally — a red suite on a *correct* build.
  Fixed: `e2e/helpers/modifier.ts` derives the expected string from the page using the app's
  own `modifierLabel`, so the two cannot drift. `tests/shortcuts.spec.ts` still pins the
  label logic itself, which is what stops this becoming a tautology.
- **M2 — nothing tested that the analytics fire, or with which `source`.** The entire
  justification for the authorised worker change, and the only coverage was that the two
  names sit in `VALID_EVENTS`. `track()` swallows every failure, so a wrong source string
  recorded nothing while the dashboard showed a confident zero. The plan declined an e2e
  because a local `writeDataPoint` failure would 400 indistinguishably — but `page.route`
  intercepts *before* workerd, which sidesteps that entirely, and `sw.js` returns early for
  `/api/` without `respondWith`, so the service worker is not in the path either. Fixed: one
  `chromium-desktop` case asserting all four event/source combinations and that dead presses
  and force-clicks log nothing.
- **L3 — the reveal height was `rem`.** A browser minimum-font-size setting (a low-vision
  preference in both Chrome and Firefox) raises the computed font-size without touching
  `rem`, so `overflow: hidden` would slice the bottom off the shortcut for exactly the
  readers who set it. Now `1.25em`, which tracks the element's own font-size.
- **L8 — `isTypingTarget` matched bare `input`,** so the save-score checkbox killed the
  shortcuts. It sits on the game screen and appears when the board is fully resolved — the
  moment a player most wants an undo. Narrowed to text-entry types, with unit cases both
  ways. Safe for detection too: a checkbox raises no on-screen keyboard.
- **L7 — item 59 did not hold.** `buildKeypad()` wipes and rebuilds all ten keys, so a
  shortcut pressed while focused on one dumped focus to `<body>`. Fixed in the shortcut
  branch only (the new route), with an e2e. The identical pre-existing behaviour on a keypad
  *click* is left alone — out of scope, and changing it risks the #251 focus assertions.
- **L4 — two new IDs against CONVENTIONS.md.** `aria-describedby` needs an IDREF so the ids
  are unavoidable; the DOM lookups now use `data-*` like everything else, and CONVENTIONS.md
  records the exception explicitly rather than leaving it undocumented.
- **L5 —** `#294` pointers added to the three now-inert walkthrough hooks (both CustomEvent
  dispatches and `[data-walkthrough-live]`), whose comments still described live behaviour.
- **L6 —** the blanket skip on `octopus-walkthrough.spec.ts` covered the one case that still
  passes: "returning player sees no walkthrough" asserts *absence*, which is now true for
  everyone and is the only live check that the disable took effect. Skip moved to the other
  five.

### da-build re-review — 2026-08-02

Second fresh-context pass over the fixes plus the whole diff again. **0 High, 2 Medium,
6 Low.** All eight fixed; nothing deferred except one logged as its own issue.

- **M1 — the M2 fix from the first pass could not have passed.** The analytics e2e pushed
  the whole POST body and asserted `toEqual({event, source})`, but every payload also
  carries `uid` and `newUser`, and `toEqual` is exact deep equality. The headline
  remediation was a test that was guaranteed red. Fixed: the captured body is projected to
  the two fields under test.
- **M2 — the L8 fix traded a dead shortcut for a lost focus at the same moment.** Narrowing
  `isTypingTarget` let the shortcuts fire while the save-score checkbox has focus — but that
  checkbox only exists while the board is fully resolved, and either shortcut un-resolves
  it, so `[data-submit-wrap]` hides, `[data-save]` goes `display: none` with it, and focus
  falls to `<body>`. Item 59 again, in the exact scenario the L8 fix was justified by.
  Fixed by generalising `restoreKeypadFocus` into `restoreFocusAfterBoardChange`: it tries
  the remembered key, then *reads back* whether focus took (a `.focus()` on a hidden element
  silently no-ops) and falls back to Undo, which is always present and stays focusable
  because it is `aria-disabled` rather than disabled.
- **L3 (was also flagged)** — the same fix covers the keypad-closes case, where the key
  still exists but is inside a hidden wrapper. The old comment claiming "the key is simply
  gone" was wrong and is corrected.
- **L4 — `page.route` is the suite's first, against a caveat `fixtures.ts` records.** Now
  asserts interception attached separately from the payload, so a miss reads as a harness
  failure rather than "the app sent nothing".
- **L5 — the 80% contrast figures were asserted nowhere.** `tests/palette-contrast.spec.ts`
  now computes the tint over `--color-surface` in both schemes, checks 4.5:1, and pins
  7.90 / 9.20 so a token change shows up as a drift rather than a still-passing number.
- **L6 — the ARIA-wiring e2e was gated to `chromium-desktop`** while the plan said otherwise.
  Widened to all three desktop projects, which is where name/description exposure is most
  likely to differ between engines.
- **L7 — `e.repeat` suppression had no coverage.** Playwright's keyboard API always sends
  `repeat: false`, so the case synthesises the repeats via `dispatchEvent` and asserts the
  board still unwinds while the announcement and the analytics stay at one apiece.
- **L8 — `Cmd`/`Ctrl`+digit eliminates a board digit and swallows the browser's tab
  shortcut.** Pre-existing, not caused by this branch: the digit branch parses `e.key` with
  no modifier check. Item 7 keeps it out of scope, so **logged as #295** rather than fixed
  here, cross-referenced to #293 since both are the digit branch acting on keystrokes it
  should ignore.

### da-build round 3 — 2026-08-02

**0 High, 1 Medium, 3 Low.** Converging (2M+6L → 2M+6L → 1M+3L), and round 3 confirmed
round 2's fixes all worked. The one Medium was the same shape of error as the two rounds
before it: a fix that is right about the failure it names and wrong about the case next door.

- **M1 — the focus fallback moved focus when nothing had been lost.** `activeElement ===
  body` after the action was read as proof the board change stole focus. It is also simply
  what a mouse user looks like: macOS Safari and Firefox do not focus a `<button>` on click,
  and Firefox on macOS is the browser Jamie reviews in. So a mouse player's first Ctrl+Z
  would have yanked focus onto Undo with a focus ring they never asked for — item 59 broken
  by the fix for item 59 — and pre-empted the polite announcement item 56 requires. Fixed by
  reading `e.target` (which *is* the focused element on a keydown, and is `<body>` when
  nothing is focused) to decide whether there was any focus to restore. New e2e covers it;
  the existing focus case could not, because it starts by focusing a key.
- **L2 — the pinned contrast figure was wrong and nearly failing.** `blend()` rounds to
  8-bit, giving 7.9465, while the pin was `toBeCloseTo(7.9, 1)` — a tolerance of 0.05
  against a 0.0465 diff, passing on 7% of its budget. Any one-channel token nudge would have
  flipped it red and read as a contrast regression rather than a mis-pinned constant. Now
  pinned at the exact 8-bit values to 3dp (deterministic arithmetic, so a tight tolerance is
  correct — it moves only if a token moves). Prose corrected from a false-precise "7.90:1"
  to "about 7.9:1"; higher-precision compositing gives 7.902.
- **L3 — none of the new e2e has been executed, and `tsc` does not cover `e2e/`.** True and
  unchanged: Playwright cannot run in this environment. Worth being plain that this is the
  structural reason rounds 1 and 2 each shipped an unrunnable test. A `tsconfig.test.json`
  was suggested — it would **not** have caught either, since neither was a type error
  (`toEqual` with extra keys type-checks fine). **CI is the first real execution of these
  specs.**
- **L4 — SUSPECTED, unverifiable here:** the a11y hint gate now covers `webkit-desktop` and
  `firefox-desktop`, which should report `(hover: hover) and (pointer: fine)` but have never
  been exercised against a pointer media query in this suite. If CI goes red, look here first.

**Still outstanding before merge:**
- Human review (Jamie and Dave), then `da-build`.
- Manual passes from Task 9 on the branch preview — screen reader, contrast in both
  themes, `prefers-reduced-motion`, and a real tablet with a keyboard. Jamie takes the
  screen-reader and contrast checks.
- Item 100's write-budget glance before the PR merges.
- Item 99 still needs logging as its own issue, on Jamie's go-ahead.

## da-plan review — 2026-08-02

Fresh-context devil's-advocate pass: 1 High, 4 Medium, 7 Low. All twelve resolved in this file;
nothing deferred.

- **H1** — Task 3's markup breaks ten existing `toHaveText` assertions on three of five projects,
  because `game.page.ts:33` locates the button, not the label. Fixed: `undoLabel` locator and the
  ten repoints now land in the same commit. See Task 3.
- **M1** — `isWalkthroughActive()` had no coverage and Task 2 pointed at the wrong task for it.
  Fixed: a walkthrough guard e2e case added to Task 9. (The review suggested
  `e2e/octopus-walkthrough.spec.ts` as its home — that file does not exist; the walkthrough has no
  e2e spec at all, so the case goes in `undo-reset.spec.ts`.)
- **M2** — the five new announcements were routed entirely to manual screen-reader checking. Fixed:
  e2e text assertions on `[data-undo-msg]` in Task 9, with manual checking kept for whether they are
  *spoken*.
- **M3** — `announce()` made the existing synchronous reset announcement async, so commit-order
  step 3 was not the "behaviour-neutral" it claimed. Fixed: the 100ms defer now applies only to a
  genuinely identical repeat; every existing call site stays synchronous.
- **M4** — Task 4 claimed the reveal grows the button and pushes the digit boxes down. It cannot:
  `min-height: 2.75rem` absorbs the extra line. Corrected in Task 4, with an explicit warning not to
  write a `boundingBox` assertion that can only ever be zero.
- **L1** `getCurrentScreen()`'s 200ms lag, **L2** item 105, **L3** header/table mismatches,
  **L4** `@layer utilities`, **L5** the `/api/event` e2e that could go red on a correct
  implementation (replaced with a unit test on an exported `VALID_EVENTS`), **L6** the unreachable
  `?? 'toggle'`, **L7** the four-rows re-scope of item 101 and the six-shape stats fake — all fixed
  in place.

## Traceability

Every numbered brief item, accounted for.

Each task's header cites the same numbers as this table — they were reconciled after the `da-plan`
pass, and this table is the one that survives the context clear.

- **Task 1** — 12, 13, 34, 40, 74, 87, 95, 103
- **Task 2** — 32, 88
- **Task 3** — 48, 54, 55, 62, 86, 91, 92, 104
- **Task 4** — 49, 50, 51, 52, 63, 64, 66, 85, 90
- **Task 5** — 21, 27, 61, 65
- **Task 6** — 14, 56, 57, 58, 84, 93
- **Task 7** — 15, 16, 17, 18, 19, 28, 29, 33, 59, 69, 70, 94, 98
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
  (logged as a follow-up above); 105 (Jamie's "§9 fine" — a confirmation that 92, 93, 94 and 95
  stand as written, all of which are built in Tasks 3, 6 and 7)

Nothing in the brief is unhandled.
