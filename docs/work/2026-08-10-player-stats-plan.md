# Plan — clearer end-of-puzzle player stats

Date: 2026-08-10 · Branch: `dev/player-stats` · Author: Claude (clumeral dev bot)

Source of truth: [`docs/work/2026-08-10-player-stats-brief.md`](2026-08-10-player-stats-brief.md),
closed 2026-08-10 at brief item 143. Every task below cites the brief items it implements.

Status: **DRAFT — awaiting da-plan, then Jamie's approval.**

Related tickets: #252, #163, #143, #148 (sharing, comes after this work).

---

## One open question for Jamie

**P-01. Brief items 65 and 130 disagree about when history is actually deleted, and I have
not resolved it on my own.**

- Brief item 65 (Jamie, play screen): untick the box → warn; *delete when they submit*.
- Brief item 130 (M3, completion panel): there is no submit on the completion panel, so
  untick → warn → *delete when they confirm the warning*.

Read literally, the same checkbox behaves differently depending on which screen it is on:
on the play screen a confirmed warning changes nothing until you finish the puzzle, and it
is undefined what happens if you re-tick the box, or never finish, in between.

**My recommendation, which this plan is written to:** one behaviour on both screens. The
warning dialogue *is* the confirmation — "Delete my stats" turns the setting off and deletes
the stored history there and then; "Keep them" puts the tick back and changes nothing.
Ticking the box on saves from that game onward, immediately.

Why: item 130 already says an unconfirmed destructive change that fires later is
unpredictable, and that reasoning applies to the play screen just as much. One rule is also
one thing to test and one thing to explain.

If Jamie prefers item 65 as written, Task 8 changes and nothing else does. **This supersedes
item 65's "delete on submit" only if he agrees.**

---

## What changes, in one paragraph

The four stat boxes on the completion screen become three labelled blocks — *This game*,
*Streaks*, *All time* — each number carrying a plain line saying what it means. A new play
timer counts only the time a player is actually present, stores it with the game, and feeds
an average-time figure into both the player's panel and the team's `/stats` page. The rules
that turn history into numbers move out of the completion screen into a module of their own,
so #163 and #148 can read them instead of copying them. Players who have switched score
saving off get a day-only marker instead of a result, an explanation on the panel, and a way
to switch saving back on — with a proper confirmation dialogue before anything is deleted.

---

## Module layout

New files:

| File | Job |
|---|---|
| `src/player-stats.ts` | Pure. History rows in, every displayed figure out. No DOM. |
| `src/play-timer.ts` | Pure counting core for the timer. Injected clock, no DOM, no globals. |
| `src/confirm-dialog.ts` | The one reusable "are you sure?" dialogue the codebase lacks. |

Changed files:

| File | Change |
|---|---|
| `src/types.ts` | `HistoryEntry` gains `seconds?` and `marker?`; `ActiveState` gains `elapsed?` and `idles?`. **Jamie owns types** (brief 128). |
| `src/storage.ts` | Store/validate the new fields; write the day-only marker; delete history. |
| `src/completion.ts` | Rewritten render. Stat *rules* leave; only rendering stays. |
| `src/app.ts` | Drive the timer, decide what is stored and what is sent, own the checkbox flow. |
| `index.html` | Completion panel scaffolding, live region, confirm dialogue, checkbox copy. |
| `src/tailwind.css` | Component classes for the three blocks and the goes chart. No new tokens. |
| `src/worker/index.ts` | `puzzle_time` joins `VALID_EVENTS`. |
| `src/worker/analytics-db.ts` | Weighted average time added to `getStats`. |
| `src/worker/stats.ts` | One more card: average time to complete. |
| `src/worker/puzzles.ts` | Archive "goes" column shows `—` for a marker day. |

**Why `src/player-stats.ts` and not `src/stats.ts`:** `src/worker/stats.ts` is the team's
`/stats` dashboard. Two files called `stats.ts` doing unrelated jobs is how the wrong one
gets edited.

`src/worker/` must not import client modules and vice versa (`docs/CONVENTIONS.md`, "Code
separation"). Nothing here crosses that line: the Worker's average time is computed from D1
rows in `analytics-db.ts`, independently of `player-stats.ts`.

---

## Shared rules, defined once

These live in `src/player-stats.ts` and everything else imports them.

- **`MAX_COUNTED_SECONDS = 1800`** — brief 31, 122.
- **`IDLE_TIMEOUT_MS = 120_000`** — two minutes, brief 34 and 50.
- **`REVEAL_AFTER_GAMES = 2`** — streak and all-time blocks appear from the third countable
  game. Brief 19, 131.
- **`GOES_BUCKETS = [1, 2, 3, 4, 5, '6+']`** — brief 133.

**Countable** means: not `archived`, not a `marker`. Everything — totals, averages, streaks,
the chart — filters to countable rows *before* counting anything. Brief 16, 123, 71.

**A valid stored time** is an integer between 0 and 1800 inclusive. Anything else — missing,
negative, fractional, absurd, not a number — means the time for that game is **unknown**.
Unknown shows as no time, never counts as zero, never enters an average, never becomes a
fastest win. Brief 61, 122.

---

## Tasks

Each task is a commit. Tests are written before the implementation within each task.

---

### Task 1 — types and the storage layer

**Implements:** brief 59, 60, 61, 71, 75, 121, 122, 123, 128.

**Tests first** — `tests/storage-history.spec.ts` (extend), `tests/storage-active.spec.ts`
(extend):

1. `recordGame` stores `seconds` when given, and omits the key entirely when not.
2. A history entry written before this change (no `seconds`) round-trips unchanged.
3. `recordMarker(date)` writes exactly `{ date, tries: 0, marker: true }`, plus
   `archived: true` when told the solve was an archive replay.
4. `recordMarker` replaces an existing row for the same date, like `recordGame` does.
5. `deleteHistory()` removes `dlng_history` and leaves `dlng_prefs` and `dlng_active` alone.
6. `loadActive` accepts a board carrying `elapsed: 240` and returns it.
7. `loadActive` accepts a board with **no** `elapsed` — it must not be discarded, and
   `elapsed` reads as absent. This is the guard against brief item 121.
8. `loadActive` rejects the *field*, not the board, for each of: `-1`, `12.5`, `1801`,
   `"240"`, `NaN`, `null`. The board still loads; the elapsed time is treated as unknown
   and restarts at zero.
9. Same eight cases for `idles`, bounded 0–1000.
10. `ActiveState.v` is still `1`. A test asserts the literal, so bumping it fails CI loudly.

**Implementation** — `src/types.ts`:

```ts
export interface HistoryEntry {
  date: string;
  tries: number;
  answer?: number;
  archived?: boolean;
  /** Counted play seconds, 0–1800. Absent = unknown: pre-launch rows, opted-out
   *  players, and rows whose stored value failed validation. Never read as 0. */
  seconds?: number;
  /** Day-only marker (brief 71): the player finished this day with saving off.
   *  tries is 0 and means nothing. Filtered out of every figure before counting. */
  marker?: true;
}
```

```ts
export interface ActiveState {
  v: 1;                    // NEVER bump — brief 121
  date: string;
  possibles: number[][];
  guesses: number[];
  activeBox: number | null;
  feedbackKey: string | null;
  /** Counted seconds so far. Absent on any board written before this shipped. */
  elapsed?: number;
  /** How many times the idle cut-off has fired this game. Absent = 0. */
  idles?: number;
}
```

`src/storage.ts`:

- `recordGame(dateStr: string, tries: number, opts: { answer?: number; archived?: boolean;
  seconds?: number } = {})` — the positional `answer, archived` arguments become an options
  object, because a fourth positional flag is a bug waiting to happen. One call site in
  `src/app.ts`; test call sites updated in this task.
- `recordMarker(dateStr: string, archived = false)` — writes the shape at brief 123.
- `deleteHistory(): void` — `localStorage.removeItem('dlng_history')`, wrapped in
  try/catch like every other write here. **Named `deleteHistory`, not `clearHistory`** —
  `src/app.ts` already has a module-private `clearHistory()` for the undo stack.
- `loadActive` gains two optional-field checks. Both follow the file's existing pattern:
  an out-of-range value drops that field rather than the whole board, because a forged
  `elapsed` must not cost a player their in-progress game.

**Why the invalid-field-not-invalid-board split:** every other field in `loadActive` is
load-bearing — a bad `possibles` means an unusable board. `elapsed` is decoration. Throwing
away a real mid-game board because someone typed a float into `elapsed` would be a worse
outcome than losing the timing for that game.

---

### Task 2 — `src/player-stats.ts`, the counting rules

**Implements:** brief 5, 6, 7, 12, 13, 16, 17, 18, 20, 31, 55, 61, 71, 106, 122, 123, 133,
134.

**Tests first** — `tests/player-stats.spec.ts`, new. Every rule gets its own case:

*Streaks*
1. Three consecutive days including today → play streak 3.
2. A missed day in the middle → the streak is the run since the gap, not the total.
3. A run that ended two or more days ago → play streak 0, best streak unchanged.
4. A run ending yesterday → still live (existing recency gate, brief background).
5. First-go streak: three consecutive days each `tries === 1` → 3.
6. First-go streak breaks on a day played and missed (`tries === 2`) — brief 6.
7. First-go streak breaks on a missed day too — brief 6.
8. Best play streak and best first-go streak survive a broken current streak — brief 12.

*Totals and averages*
9. `plays` counts countable rows only.
10. `firstGoWins` counts `tries === 1` among countable rows; percentage rounds to a whole
    number and reads `23 (18%)` — brief 20.
11. `avgGoes` to one decimal place, matching today's `toFixed(1)`.
12. `avgTime` ignores rows with no `seconds`, rather than reading them as 0 — brief 61.
13. `avgTime` ignores a row with `seconds: 1801`, and `fastestFirstGo` does too — brief 31.
14. `avgTime` is `null`, not `0`, when no countable row has a valid time. The panel renders
    a dash, not `0:00`.
15. `fastestFirstGo` only considers rows with `tries === 1` — brief 13.

*Exclusions*
16. An `archived: true` row changes no figure at all — brief 16.
17. A `marker: true` row changes no figure at all: not `plays`, not `avgGoes` (its
    `tries: 0` must never reach the sum), not either streak — brief 123.
18. A row that is both `marker` and `archived` is excluded once, not twice.

*Chart and formatting*
19. `goesDistribution` returns exactly six buckets, in order, zeros included, with 7 goes
    and 12 goes both landing in `6+` — brief 133.
20. `formatDuration`: `221 → "3:41"`, `48 → "0:48"`, `3840 → "1h 04m"`, `null → "—"` —
    brief 88, 134.

**Implementation:**

```ts
export interface PlayerStats {
  plays: number;
  firstGoWins: number;
  firstGoPercent: number | null;
  avgGoes: string | null;
  avgTimeSeconds: number | null;
  fastestFirstGoSeconds: number | null;
  playStreak: number;
  bestPlayStreak: number;
  firstGoStreak: number;
  bestFirstGoStreak: number;
  goesDistribution: { bucket: string; count: number }[];
  /** Countable games played. Drives the reveal gate at brief 19 / 131. */
  countableGames: number;
}

export function computePlayerStats(history: HistoryEntry[], today: string): PlayerStats
export function formatDuration(seconds: number | null): string
export function validSeconds(value: unknown): number | null
export const MAX_COUNTED_SECONDS: number
export const IDLE_TIMEOUT_MS: number
export const REVEAL_AFTER_GAMES: number
```

Move the existing streak walk out of `computeStats` in `src/completion.ts` rather than
rewriting it — it already carries two hard-won fixes (the date-descending sort against the
June under-count, and the recency gate). Generalise it to take a predicate so the same walk
serves both the play streak (every countable row) and the first-go streak (`tries === 1`).

**The first-go streak walk needs care and is the likeliest place to get this wrong.** It is
*not* "the play streak restricted to first-go rows". A day you played and took two goes must
break it (brief 6), and if you filter those rows out first, that day looks identical to a
day you did not play — which also breaks it, so the two happen to agree. But the *best*
first-go streak differs: filtering first would join two runs either side of a two-go day
into one long run. So the walk runs over all countable rows and treats a non-first-go day as
a break, not as an absence. Test 6 exists to catch exactly this.

`computePlayerStats` takes `today` as an argument rather than calling `todayKey()`, so the
tests do not need fake timers to be deterministic.

**Why the module is pure:** it is the thing #163 and #148 will import (brief 73, 78). A
module that reads `localStorage` or touches the DOM cannot be reused on the main game screen
or in a share-image path without dragging both along.

---

### Task 3 — `src/play-timer.ts`, the counting core

**Implements:** brief 26, 27, 28, 29, 30, 32, 33, 34, 50, 107, 120.

**Tests first** — `tests/play-timer.spec.ts`, new, with an injected clock:

1. A freshly created timer with no activity reads 0 seconds — it does **not** start on load
   (brief 27).
2. First `activity()` starts it; 30 seconds later a second `activity()` reads 30.
3. Two actions 30 s and 45 s apart read 75.
4. An action 121 seconds after the previous one adds **nothing** and raises the idle count
   to 1 — brief 34, 50.
5. An action exactly 120 000 ms after the previous one still counts (the boundary is
   inclusive, so the cut-off is "more than two minutes").
6. After an idle gap, the next action starts counting again from that moment — brief 29.
7. `hide()` banks the time up to that moment; time passing while hidden adds nothing;
   `show()` then `activity()` resumes — brief 26.
8. `hide()` after an over-long gap banks nothing and counts an idle.
9. `seconds()` is a whole number, floored, and never negative even if the clock jumps
   backwards.
10. `seconds()` is capped at `MAX_COUNTED_SECONDS` on read, so a stored value is always in
    range — brief 31, 122.
11. Restoring with `{ elapsed: 240, idles: 1 }` and adding 30 s reads 270 with 1 idle —
    brief 30.
12. `idleLabel()` returns `'clean'` at zero idles and `'idle-2'` at two — brief 38.

**Implementation:**

```ts
export function createPlayTimer(opts?: {
  now?: () => number;
  elapsed?: number;
  idles?: number;
}): PlayTimer

export interface PlayTimer {
  activity(): void;
  hide(): void;
  show(): void;
  seconds(): number;
  idles(): number;
  idleLabel(): string;   // 'clean' | `idle-${n}`
}
```

**No `setInterval` and no ticking.** The timer is a pure accumulator driven by events. On
each `activity()` it looks at the gap since the last one: within two minutes, the gap is
added to the total; longer, the gap is thrown away entirely and the idle count goes up.
`hide()` banks the gap the same way and stops the clock until `show()`.

Why event-driven rather than a repeating tick: a tick would need starting, stopping, and
cleaning up across four code paths, it burns battery on a screen that is meant to be quiet,
and it is far harder to test than an injected clock. The accumulator gives exactly the same
number because nothing between two actions is countable anyway — brief 29's rule is that the
gap is thrown away, not merely paused.

`Date.now()` is injectable and defaults to `Date.now`. The clock is never rendered
(brief 32) and no other module reads it during play.

**Known and accepted (brief 120):** two tabs on the same puzzle each run their own timer and
the last save wins. Not guarded. Recorded here so a later reader does not treat it as a bug.

---

### Task 4 — wire the timer into play

**Implements:** brief 26, 27, 30, 59, 74, 107.

**Tests** — `e2e` covers the real behaviour in Task 13; this task's unit coverage is Task 3's.
The wiring itself is asserted in `tests/storage-active.spec.ts` by checking that a saved
board carries the elapsed field.

**Implementation** — `src/app.ts`:

- Module-scoped `let timer = createPlayTimer()`, alongside `gameState`.
- `timer.activity()` is called from the existing handlers that already mark a real
  interaction: digit toggle, keypad press, undo, reset, submit. Not from hover, not from
  scroll, not from theme or menu — reading the clues is not solving (brief 27).
- One module-level listener: `document.addEventListener('visibilitychange', …)` calling
  `timer.hide()` or `timer.show()` (brief 26). Module level, per `docs/CONVENTIONS.md` —
  never inside `startDailyPuzzle`.
- `buildActiveState()` adds `elapsed: timer.seconds()` and `idles: timer.idles()`.
  `saveActive` already runs on every board change, so the clock is persisted with the board
  and survives a reload (brief 30, 59).
- The restore path in `startDailyPuzzle` rebuilds the timer:
  `timer = createPlayTimer({ elapsed: draft.elapsed, idles: draft.idles })`.
- Every fresh start (`resetPuzzleUI`, random, archive replay) creates a new zeroed timer.

**Why `idles` is persisted as well as `elapsed`:** brief item 38 defines the analytics label
as `idle-N`, where N is how many times the cut-off fired *for that game*. Drop the counter on
reload and a game that went idle twice with a refresh in between reports `clean`, which is
the one reading that would make us trust the number when we should not. Persisting it is an
implementation detail of item 38, not a change to it.

---

### Task 5 — the confirm dialogue

**Implements:** brief 68, 91, 101, 128.

**Tests first** — `tests/confirm-dialog.spec.ts`, new (jsdom):

1. Opening moves focus into the dialogue.
2. Escape resolves as cancelled and does not run the confirm action.
3. The confirm button resolves as confirmed; the cancel button as cancelled.
4. Focus returns to the element that opened it, in both outcomes.
5. Button labels come from the caller and are rendered verbatim.
6. Clicking the backdrop cancels (matching the feedback modal's behaviour).

**Implementation** — `src/confirm-dialog.ts`:

```ts
export function confirmAction(opts: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  trigger?: HTMLElement | null;
}): Promise<boolean>
```

A single `<dialog data-confirm-modal>` in `index.html`, following `src/modals.ts`'s existing
feedback-modal pattern: `showModal()`, an `open` class for the transition, `cancel` handled
so Escape closes cleanly. Focus returns to `opts.trigger` on close.

**Why a new module rather than adding to `src/modals.ts`:** `modals.ts` is the feedback form
and toasts, and it is already 234 lines of one specific form. A general confirm belongs on
its own, and #148 will want it too.

**Why not `window.confirm`:** it cannot be styled, it cannot say "Delete my stats" and
"Keep them" (brief 91), and Safari has historically let a page suppress it — a destructive
confirmation that can vanish is worse than none.

---

### Task 6 — the completion panel markup and styles

**Implements:** brief 79, 80, 81, 82, 83, 85, 97, 98, 102, 104, 140.

**Tests** — covered by Task 7's render tests and Task 13's browser tests. The contrast check
in `tests/palette-contrast.spec.ts` already covers the tokens; this task adds no colours, so
it needs no new contrast case.

**Implementation** — `index.html`, replacing the single `[data-completion-stats]` grid:

```html
<div data-completion-panel class="w-full flex flex-col gap-6">
  <section data-stat-block="this-game">…</section>
  <section data-stat-block="streaks">…</section>
  <section data-stat-block="all-time">…</section>
</div>
<p data-completion-live class="sr-only" role="status" aria-live="polite"></p>
```

- **No share buttons.** Brief 140 removed them from this build; the section rules are drawn
  without them. Read the sketch at brief 23 with the `[ ↗ Share ]` blocks deleted.
- Each block is a `<section>` with its own heading, so a screen reader can jump between them.
- Each stat is a `<dl>` pair — term is the label, definition is the number — so nothing is
  read as a loose figure (brief 97). The explanatory line sits in the same `<dd>`, after the
  number, not in a `title` attribute.
- The goes chart is a list of rows, each carrying its label, its bar, and its count as
  text. The bar is `aria-hidden`; the count beside it is the accessible content (brief 98).
- Live region is `polite`, outside the three blocks, and empty until Task 7 fills it.

`src/tailwind.css` gains component classes for the blocks and the chart bars, using existing
tokens only (brief 83). The streak block is two columns that stack below roughly 360 px, so
it holds at 320 px and at 200 % text (brief 85, 104).

**Why `role="status"` and `aria-live="polite"` rather than `assertive`:** the player has
just won. Interrupting whatever the browser is saying to shout the result is the behaviour
brief 99 was trying to prevent.

---

### Task 7 — render the panel

**Implements:** brief 17, 18, 19, 20, 52, 53, 54, 55, 87, 88, 92, 93, 94, 95, 131, 133, 134,
135, 139.

**Tests first** — `tests/completion-stats.spec.ts`, rewritten. The existing file reads
values out of stat boxes by index; the boxes are gone, so it is rewritten rather than
patched, keeping its streak scenarios as data.

1. **Normal returning player** (5 countable games): all three blocks render; the play streak,
   first-go streak, plays, first-go wins with percentage, average goes, average time and
   fastest first-go win all show the values `computePlayerStats` returned.
2. **New player, first game**: only *This game* renders; the line "Your streaks and all-time
   stats start from your third game" is present; the streak and all-time blocks are absent
   from the DOM, not merely hidden — brief 19, 92.
3. **Second game**: same as above. **Third game**: all three blocks — brief 19.
4. **Just switched saving on, one countable game**: identical to the new-player state, with
   the same wording — brief 131.
5. **Saving off**: *This game* renders; the *All time* heading renders with "Turn on score
   saving to see your all-time stats" and the checkbox in place of the numbers; the streak
   block is absent — brief 53, 65, 90.
6. **Random puzzle**: *This game* only, plus "Random puzzles don't count towards your
   stats" — brief 52, 93.
7. **Archive replay** (`activeDate !== todayLocal`): the minimal existing panel, no streaks,
   no totals, no timing — brief 54.
8. Each of the seven explanatory lines at brief 135 appears verbatim under its stat, and
   "Miss a day and the streak starts again" appears under the streak pair.
9. The goes chart renders six rows in order with counts as text — brief 133.
10. A game with no valid time shows a dash in the *This game* line, not `0:00` — brief 61.
11. A game of 3 900 seconds shows `1h 05m` on the panel while being absent from the average
    and from fastest — brief 31, 134.
12. **The announcement**: the live region reads exactly
    `Solved in 2. 3 minutes 41 seconds. Play streak 14.` — goes, time, play streak, and
    nothing else — brief 139.
13. The announcement omits the time when it is unknown, and omits the play streak on the
    new-player and saving-off states, where no streak is shown.
14. The live region is written **once** per render, not on every subsequent re-render of the
    same solve.

**Implementation** — `src/completion.ts`:

- `computeStats` and its `Stats` interface are **deleted**. `renderCompletion` calls
  `computePlayerStats(loadHistory(), todayKey())` and renders what it gets. Everything on
  the panel is recomputed on each render, never stored as a running total (brief 55).
- A `PanelMode` decides which blocks exist: `'random' | 'archive' | 'new' | 'saving-off' |
  'full'`. One function, one switch, so the five states cannot drift apart.
- The announcement is built from the same values the panel renders, spelled out for speech:
  `3:41` becomes `3 minutes 41 seconds`. A screen reader saying "three colon forty-one" is
  the reason this is not the display string.
- The hero line reads `Solved in 2 · 3:41` (brief 88). `renderCompletion`'s signature is
  unchanged apart from the seconds for this game, which arrives in `RenderCompletionOpts`.

**Why blocks are absent rather than hidden:** a `hidden` block is still in the accessibility
tree in some combinations, and a screen-reader user tabbing into an empty *All time* heading
would get exactly the "looks broken" impression brief 19 exists to avoid.

---

### Task 8 — the save-my-scores setting, in two places

**Implements:** brief 62, 65, 66, 67, 68, 70, 71, 90, 91, 100, 101, 123, 124, 129, 130.

**This is the task that P-01 hangs on.** Written to my recommendation: the warning dialogue
is the confirmation, on both screens.

**Tests first** — `tests/save-pref.spec.ts`, new (jsdom):

1. Unticking either checkbox opens the confirm dialogue and changes nothing yet.
2. "Keep them" → the checkbox goes back to ticked, `dlng_prefs.saveScore` stays `true`,
   history is untouched.
3. "Delete my stats" → `saveScore` becomes `false`, `dlng_history` is removed, both
   checkboxes read unticked — brief 67.
4. Ticking either checkbox sets `saveScore` true immediately, with no dialogue, and does not
   resurrect deleted history — brief 130.
5. The two checkboxes stay in step: changing one updates the other — brief 67.
6. With saving off, solving today writes a marker and nothing else: no `tries`, no `answer`,
   no `seconds` — brief 65, 71.
7. With saving off, an archive solve writes a marker carrying `archived: true`.
8. With saving off, no `puzzle_time` event is sent — brief 141.
9. A marker for today still makes `hasPlayerData()` true, so the returning-player redirect
   keeps working — brief 125.

**Implementation:**

- `index.html`: the play-screen checkbox label becomes **"Save my scores on this device"**
  and the biscuit icon goes (brief 129). The completion panel's checkbox uses the identical
  label. Both are real `<input type="checkbox">` with real `<label for>` (brief 100).
- `src/app.ts` gains one handler used by both controls:
  - **Ticking on** → `persistPrefs(true)`, sync the other checkbox, re-render the panel if
    it is on screen. Immediate, no dialogue.
  - **Unticking** → `confirmAction({ message: 'This deletes the stats you have saved so far.
    It cannot be undone.', confirmLabel: 'Delete my stats', cancelLabel: 'Keep them' })`
    (brief 91). Confirmed → `persistPrefs(false)`, `deleteHistory()`, sync both checkboxes,
    re-render. Cancelled → put the tick back, nothing else.
- The solve path in `handleGuess` splits on the preference:
  - saving **on** → `recordGame(date, tries, { answer, archived, seconds })`
  - saving **off** → `recordMarker(date, archived)` — brief 65, 71, 123.
- `showCompletedState` must not read a marker's `tries`. A marker row means we do not know
  the count, so the solved-replay line reads "Solved!" with no number and the answer digits
  are not revealed, because neither was stored. **This is a real bug the marker introduces**:
  as the code stands today, `startDailyPuzzle` would find the marker and render "Solved in 0
  tries!". A unit case covers it.

**Why the marker carries `archived` too:** an archive solve with saving off still needs the
archive page and the replay check to know the day was played. Every figure filters markers
out first, so the extra flag costs nothing and keeps both readers working (brief 124).

---

### Task 9 — the archive page's goes column

**Implements:** brief 124.

**Tests first** — `tests/archive-stats.spec.ts` (extend):

1. A normal row shows its number of goes.
2. A marker row shows `—`, not a blank and not a `0`.
3. A day with no entry still shows the Play button.
4. Sorting is unaffected — it reads `data-*` attributes on the row, never the cell.

**Implementation** — `src/worker/puzzles.ts`, the inline "Populate tries column" script:

```js
for (var i = 0; i < history.length; i++) {
  byDate[history[i].date] = history[i].marker ? "—" : history[i].tries;
}
```

The `byDate[date] != null` gate below it is unchanged and still correct — a dash is not null.

This is hand-written ES5 in a template string, as the rest of that file is. It has no build
step and no module system, so it cannot import `player-stats.ts`. The one rule it needs is
one line long; duplicating a whole module here is what brief 73 was avoiding, and a single
`marker` check is not that.

---

### Task 10 — send the timing event

**Implements:** brief 37, 38, 39, 41, 52, 76, 132, 141.

**Tests first** — `tests/worker/` (extend the existing event tests):

1. `VALID_EVENTS` contains `puzzle_time`, so the Worker accepts it — brief 76.
2. `recordEvent` stores its value as whole seconds and its source verbatim.

And in `tests/save-pref.spec.ts` / a new `tests/analytics-events.spec.ts` (jsdom, `fetch`
stubbed):

3. A daily solve sends `puzzle_time` with the counted seconds and `source: 'clean'`.
4. A daily solve after one idle gap sends `source: 'idle-1'`.
5. A **random** solve sends no `puzzle_time` — brief 52.
6. An **archive** replay sends no `puzzle_time` — brief 132.
7. A player with saving **off** sends no `puzzle_time` — brief 141.
8. A game whose stored time is invalid sends no `puzzle_time` — brief 122.
9. `puzzle_complete` still sends `tries` as its value, unchanged — brief 37.

**Implementation:**

- `src/worker/index.ts`: `'puzzle_time'` added to `VALID_EVENTS`. No migration — the
  existing `analytics_events` table already holds a name, a value and a source (brief 76).
- `src/app.ts`, on the daily-solve branch only:
  `track('puzzle_time', seconds, timer.idleLabel())`.

The four conditions are all necessary and none is redundant: daily-only keeps randoms and
archive replays out of the average (brief 52, 132); saving-on honours brief 141; a valid time
keeps a junk value out of a number we will quote. Give-ups stay invisible and that is
accepted — they are read as a `puzzle_start` with no `puzzle_complete` (brief 41, 42).

---

### Task 11 — average time on `/stats`

**Implements:** brief 40, 49, 51, 110, 118, 128.

**Tests first** — `tests/worker/` analytics tests (extend) and
`tests/stats-dashboard.spec.ts` (extend):

1. `getStats` returns `avgTimeSeconds` weighted by `sample_interval`, not a plain average.
2. `avgTimeSeconds` is `null` when there are no `puzzle_time` rows, and the card renders a
   dash rather than `0:00`.
3. Rows from other hostnames and outside the selected range are excluded, like every other
   figure.
4. The dashboard renders a card labelled "Avg time to complete" showing `4:12` for 252
   seconds.
5. The card is present for every period option, including `?period=all`.

**Implementation:**

- `src/worker/analytics-db.ts`: `StatsResult` gains `avgTimeSeconds: number | null`, and
  `getStats`'s batch gains an eighth statement:

```sql
SELECT SUM(value * sample_interval) AS total, SUM(sample_interval) AS n
FROM analytics_events WHERE hostname = ? AND ts >= ? AND event = 'puzzle_time'
```

  Returning `null` when `n` is 0, so the page can tell "no data" from "zero seconds".

- `src/worker/stats.ts`: one more card in the existing grid, formatted `m:ss`. No chart and
  no new range controls (brief 49).

**On the weighting, precisely (brief 118):** every `puzzle_time` row is one we wrote
ourselves, so its `sample_interval` is 1 and the weighting changes nothing today. It is
written weighted anyway because it is the house rule in `docs/ANALYTICS.md` and it protects
the figure if sampling ever starts. Test 1 asserts the *SQL shape*, using rows seeded with
an interval above 1 — it does **not** claim the live number differs, which is the assertion
brief 118 warns against.

`docs/ANALYTICS.md` gains a short note: what `puzzle_time` is, what `clean` and `idle-N`
mean, and that the average covers opted-in players only (brief 141) — which is worth knowing
the first time that number looks surprising.

---

### Task 12 — documentation

**Implements:** brief 71, 76, 123, and the standing rule in `CLAUDE.md`.

- `docs/ARCHITECTURE.md` — the `dlng_history` line gains `seconds?` and `marker?`; the
  `dlng_active` line notes the two optional fields and that `v` stays at 1; the Files list
  gains `player-stats.ts`, `play-timer.ts` and `confirm-dialog.ts`.
- `docs/ANALYTICS.md` — the `puzzle_time` note described in Task 11.
- `docs/DESIGN-SYSTEM.md` — the three-block panel and the goes chart, noting no new tokens.

Documentation is its own task and its own commit so it cannot be quietly dropped when the
build runs long.

---

### Task 13 — browser tests

**Implements:** brief 106 (browser side), 108, 110, 111, 113, 114, 115, 125, 136.

Four new tests, per brief 114, in `e2e/specs/player-stats.spec.ts`. They join the existing
suite and ride the existing gates: `ci-smoke.yml` runs chromium on every pull request into
staging and main, `ci-matrix.yml` runs the other engines into main. **No new workflow and no
new gate** (brief 113). Playwright never runs on the Pi (brief 111).

1. **Panel after a solve.** Seed history so the numbers are known, solve today's puzzle,
   and assert all three blocks with the expected figures, the explanatory lines, and the
   goes chart.
2. **Brand-new player.** No history. Solve. Assert *This game* only and the
   "starts from your third game" line.
3. **Saving turned off.** Seed `{ saveScore: false }`. Solve. Assert *This game*, the
   *All time* invitation and its checkbox, no streak block — and that `dlng_history` holds a
   marker with no `tries` and no `answer`.
4. **The delete flow, end to end.** Seed history and solve. Untick the box → the warning
   appears. "Keep them" → history intact, box re-ticked. Untick again → "Delete my stats" →
   `dlng_history` gone, both checkboxes unticked. Then reload and confirm the redirect still
   treats the player as having played today (brief 125) — the marker written by that solve
   is what keeps it working.

`e2e/pages/completion.page.ts` gains locators for the three blocks, the chart, the checkbox
and the live region. `e2e/helpers/storage.ts`'s `HistoryEntry` gains `seconds?` and
`marker?` so scenarios can be seeded.

`e2e/specs/stats-chart.spec.ts` gains one assertion: the average-time card is present on
`/stats` (brief 110). It asserts presence and format only — not a weighting difference,
per brief 118.

**Not covered in the browser, deliberately:** the timer's idle cut-off. Proving a two-minute
cut-off in a browser test means either waiting two minutes per run or reaching into the
page's clock, and the accumulator is already covered exhaustively by Task 3's unit tests with
an injected clock. Recorded so nobody later mistakes its absence for an oversight.

---

## Done means

Brief 115, extended by 136:

- The panel shows the agreed numbers for a normal player, a new player, a player with saving
  off, and after a random puzzle.
- The timer behaves as brief 26–35 and 50 describe.
- Turning saving off deletes the history, after the warning, and writes a day-only marker
  from then on.
- The goes chart renders — brief 18, 133.
- The explanatory lines at brief 135 are on screen.
- `/stats` shows the average time to complete.
- The timing event reaches the database with its `clean` or `idle-N` label.
- Finishing a puzzle announces the result once — brief 139.
- The share buttons are **not** built — brief 140.

---

## Brief coverage

Every numbered brief item, and where it lands. Items marked *no code* are decisions,
context or corrections that need nothing built.

| Brief items | Task |
|---|---|
| 1–4, 9, 10, 11, 14, 15, 22, 24, 25 | no code — problem statement, background, process |
| 5, 12, 13, 17, 20 | 2, 7 |
| 6 | 2 |
| 7, 8, 16, 46 | 2 (exclusion rules) |
| 18, 133 | 2, 7 |
| 19, 92, 131 | 7 |
| 21, 84, 137, 140 | no code — buttons removed from this build |
| 23 | 6 (read with the share blocks removed) |
| 26–30, 32–35, 50 | 3, 4 |
| 31, 61, 122 | 1, 2 |
| 36–39, 41, 42 | 10 |
| 40, 51, 118 | 11 |
| 43, 44, 45, 47, 48 | no code — out of scope |
| 49, 110 | 11, 13 |
| 52, 93 | 7, 10 |
| 53, 90 | 7, 8 |
| 54 | 7 |
| 55 | 2, 7 |
| 56 | no code — existing behaviour unchanged |
| 57, 58, 78, 86, 96, 105, 114, 142, 143 | no code — sign-offs |
| 59, 60, 75 | 1, 4 |
| 62, 65, 66, 67, 68, 70, 71, 130 | 8 |
| 63, 64 | no code — consequences of 1 and 10 |
| 69, 129 | 8 (copy on both checkboxes) |
| 72, 73 | 2 (the module move) |
| 74 | 3, 4 |
| 76 | 10 |
| 77 | 11 |
| 79–83, 85 | 6 |
| 87, 88, 94, 95, 134, 135 | 6, 7 |
| 89 | 6, 7 — "first go" throughout |
| 91, 101 | 5, 8 |
| 97, 98, 102, 104 | 6 |
| 99, 103, 126, 139 | 6, 7 — one polite announcement, no counting animation |
| 100 | 8 |
| 106 | 2 |
| 107 | 3 |
| 108 | 8, 13 |
| 109, 113 | no code — superseded; the gates already exist |
| 111 | 13 |
| 115, 136 | "Done means", above |
| 116, 117, 119 | no code — housekeeping |
| 120 | 3 (accepted, recorded) |
| 121 | 1 |
| 123 | 1, 2 |
| 124 | 9 |
| 125 | 8, 13 |
| 127, 128 | no code — ownership; types named in Task 1 |
| 132 | 10 |
| 138, 141 | 8, 10 |
| 112 | does not exist — brief 116 |

---

## Order and why

Tasks 1 → 2 → 3 are the foundations and have no UI, so they can be built and tested with
nothing on screen. Task 4 wires the timer to real play. Tasks 5 → 6 → 7 build the panel,
which needs Task 2's numbers. Task 8 needs Task 5's dialogue and Task 7's panel. Tasks 9, 10
and 11 are independent of each other and could be done in any order once Task 1 has defined
the marker. Task 12 is documentation and Task 13 is the browser tests, both last because
both describe what the other twelve actually did.

---

## Risks

1. **The first-go streak walk.** The June under-count came from exactly this kind of loop.
   Mitigated by moving the proven walk rather than writing a new one, and by test 6 in Task 2,
   which is the case a filter-first implementation gets wrong.
2. **The marker meets `showCompletedState`.** Adding a `tries: 0` row to a codebase that
   reads `entry.tries` in three places is the sharpest edge in this build. Named in Task 8
   with its own test; `da-build` should look at it again.
3. **Panel density.** Dave's live worry at brief 22 was the sheer number of figures. Brief 81
   settled it as "open but quiet", and this plan follows that — but it is the thing most
   likely to want a tweak once it is on a real phone.
4. **The two-minute cut-off is a guess.** Nobody has measured how long players actually sit
   still. That is why brief 36 asks for the `idle-N` label: the first fortnight of data tells
   us whether two minutes was right, and changing it later is a one-line change.

---

## Review record

- **da-plan:** *pending*
- **Jamie's approval:** *pending* — and P-01 above needs his answer.
