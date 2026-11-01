# Plan — clearer end-of-puzzle player stats

Date: 2026-08-10 · Branch: `dev/player-stats` · Author: Claude (clumeral dev bot)

Source of truth: [`docs/work/2026-08-10-player-stats-brief.md`](2026-08-10-player-stats-brief.md),
closed 2026-08-10 at brief item 143. Every task below cites the brief items it implements.

Status: **APPROVED 2026-08-10.** da-plan run and every High and Medium fixed; P-01 and P-02
settled by Jamie; plan approved by Jamie as dev lead. Ready for Build.

Related tickets: #252, #163, #143, #148 (sharing, comes after this work).

---

## P-01 — settled by Jamie, 2026-08-10

The question was whether history is deleted when a player confirms a warning, or later when
they submit. **Jamie's answer: delete on submit, exactly as brief item 65 says. No confirm
dialogue anywhere.** His mechanism, in his words:

> Untick → change message → "❌ Existing progression will be lost on submit". That way the
> mechanism is purely CSS, change the text (or JS) and we don't actually delete anything
> until they submit. I would also disable submit, add a 5s countdown before submit becomes
> clickable again.

**And the saving control does not appear on the stats screen at all** (Jamie, 2026-08-10):

> Don't introduce saving on or off to the stats screen at all, keep it isolated to where it
> is now as that's the action of saving — it's where the "cookie" setting takes place. It's
> where we need consent.

**Amended again by Jamie the same day, and this is the version to build:**

> Don't mention it on the stats screen — defer that to the "menu = opt out" ticket. Only on
> play before submitting score, with the existing tick box, reworded.

So the completion panel says **nothing at all** about score saving: no checkbox, and no line
inviting anyone to turn it back on. A player with saving off sees the *This game* block and
nothing below it.

This **overrides brief items 53, 65 and 90** on the completion panel entirely. Those items
put an explanation and a control under an *All time* heading; both are gone. Brief 65's
deletion rule is untouched and still governs the play screen.

**The trade-off, recorded rather than argued:** brief 53's reasoning was that someone who had
forgotten they switched saving off would otherwise think the panel was broken. That is still
true, and Jamie has weighed it and chosen to defer the fix to the menu ticket (#309), where
the opt-out will be discoverable from any screen. Noted here so a later reader knows the
silence is deliberate and where its replacement is going.

It also settles the plan review's H5 finding — "there is no checkbox to untick when saving is
on" — by removing the requirement rather than adding a control. There is no delete flow on
the completion panel because there is no control on the completion panel.

**What this deletes from the plan:** `src/confirm-dialog.ts` and its tests are gone. Task 5
becomes the warning-and-countdown mechanism instead. The `<dialog>` element is no longer used,
so the jsdom limitation the review found (H2) no longer applies to anything.

### Logged for later, not built now

Jamie's alternative — move the setting to the menu after first submit, as a
"👀 Disable tracking" option, with the first-play message gaining "(Opt out in ≡ menu)".

**Not worth folding into this build,** and the reason is the one we just spent a round on:
the menu has no submit button either. A menu toggle would need its own answer to "when does
the deletion actually happen", which is the exact problem Jamie's play-screen mechanism
solves by hanging on submit. So it is not a cheap add — it reopens the settled question in a
new place. Filed as its own issue.

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
| `src/player-stats.ts` | Pure. Shared constants, plus history rows in and every displayed figure out. No DOM. |
| `src/play-timer.ts` | Pure counting core for the timer. Injected clock, no DOM, no globals. Imports `IDLE_TIMEOUT_MS` from `player-stats.ts` — its only dependency. |
| `src/save-warning.ts` | The untick warning and the submit countdown. Pure state, no DOM. |

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

These live in `src/player-stats.ts` and everything else imports them. They are created in
**Task 1**, ahead of the rest of that module, so `src/storage.ts` and `src/play-timer.ts` can
import them rather than hardcoding numbers that then have to be revisited.

- **`MAX_STORED_SECONDS = 86_400`** — the *validity* bound. See below.
- **`OUTLIER_SECONDS = 1800`** — thirty minutes. The *exclusion* threshold. See below.
- **`IDLE_TIMEOUT_MS = 120_000`** — two minutes, brief 34 and 50.
- **`REVEAL_AFTER_GAMES = 2`** — streak and all-time blocks appear from the third countable
  game. The comparison is `countableGames > REVEAL_AFTER_GAMES`, so games 1 and 2 are
  hidden and game 3 reveals. Brief 19, 131.
- **`GOES_BUCKETS = [1, 2, 3, 4, 5, '6+']`** — brief 133.

**Countable** means: not `archived`, not a `marker`. Everything — totals, averages, streaks,
the chart — filters to countable rows *before* counting anything. Brief 16, 123, 71.

### Two numbers, not one — resolving brief 122 against brief 31 and 134

The brief names a single figure, 1800 seconds, for two different jobs, and the two jobs
disagree. Brief 122 uses it as a validity ceiling: anything above it is "unknown", which
renders a dash. Brief 31 and 134 use it as an outlier threshold: a game over thirty minutes
**keeps its own time on the panel** — shown as `1h 04m` — while being excluded from the
average and from fastest. Both cannot hold at 1800: a game of 65 minutes either shows
`1h 05m` (brief 134) or shows a dash (brief 122), and it is one or the other.

**This plan splits them, following the behaviour the brief actually decided.**

- **`MAX_STORED_SECONDS = 86_400`** is the validity bound. A stored time must be an integer
  from 0 to 86 400 inclusive. Anything else — missing, negative, fractional, absurd, not a
  number — means the time for that game is **unknown**: it shows as a dash, sends no event,
  never counts as zero, never enters an average, never becomes a fastest win. This is what
  brief 122 was protecting against, and a day is comfortably absurd enough to catch a forged
  value while leaving a real long game alone.
- **`OUTLIER_SECONDS = 1800`** is the exclusion threshold. A valid time above it still shows
  on its own panel, formatted with hours, and is left out of the average time and out of
  fastest first-go win. This is brief 31 and 134, unchanged.

Why this reading and not the other: brief 134 is an explicit statement of what a player sees
("show `1h 04m` above an hour"), and brief 122's ceiling was chosen to close a forgery hole,
not to decide a display. Reading 122 literally deletes a decision; reading it as a validity
bound with a different number keeps every decision the brief made. **Flagged for Jamie in the
summary — it changes what one rare player sees, and I would rather he knew I had chosen.**

---

## Tasks

Each task is a commit. Tests are written before the implementation within each task.

---

### Task 1 — types, shared constants, and the storage layer

**Implements:** brief 59, 60, 61, 71, 75, 121, 122, 123, 128.

This task also creates `src/player-stats.ts` holding **only** the shared constants above and
`validSeconds()`. Task 2 fills in the rest of the module. Splitting it this way keeps each
task a working commit: `storage.ts` validates against `MAX_STORED_SECONDS` and
`play-timer.ts` reads `IDLE_TIMEOUT_MS`, and neither should hardcode a number that a later
task then has to hunt down.

**Tests first** — `tests/storage-history.spec.ts` (extend), `tests/storage-active.spec.ts`
(extend):

1. `recordGame` stores `seconds` when given, and omits the key entirely when not.
2. A history entry written before this change (no `seconds`) round-trips unchanged.
3. `recordMarker(date)` writes exactly `{ date, tries: 0, marker: true }` — `tries` is
   present and zero, per brief 123, because the code that averages goes would otherwise sum
   an `undefined`. Plus `archived: true` when told the solve was an archive replay.
4. `recordMarker` replaces an existing row for the same date, like `recordGame` does.
5. `deleteHistory()` removes `dlng_history` and leaves `dlng_prefs` and `dlng_active` alone.
6. `loadActive` accepts a board carrying `elapsed: 240` and returns it.
7. `loadActive` accepts a board with **no** `elapsed` — it must not be discarded, and
   `elapsed` reads as absent. This is the guard against brief item 121.
8. `loadActive` rejects the *field*, not the board, for each of: `-1`, `12.5`, `86401`,
   `"240"`, `NaN`, `null`. The board still loads; the elapsed time is treated as unknown
   and restarts at zero.
9. Same eight cases for `idles`, bounded 0–1000.
10. `ActiveState.v` is still `1`. A test asserts the literal, so bumping it fails CI loudly.
11. `validSeconds` returns the number for `0`, `221` and `86_400`; returns `null` for
    `-1`, `12.5`, `86_401`, `'221'`, `NaN`, `undefined` and `null`.
12. `validSeconds(2000)` returns `2000` — above the outlier threshold is still **valid**.
    The exclusion happens in Task 2, not here. This test is the guard against the two
    numbers being collapsed back into one.

**Implementation** — `src/types.ts`:

```ts
export interface HistoryEntry {
  date: string;
  tries: number;
  answer?: number;
  archived?: boolean;
  /** Counted play seconds, 0–86400. Absent = unknown: pre-launch rows, opted-out
   *  players, and rows whose stored value failed validation. Never read as 0.
   *  A valid value above OUTLIER_SECONDS still shows on its own panel but is
   *  excluded from the average and from fastest (brief 31, 134). */
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
- `deleteHistory(keepMarkerFor?: string): void` — removes `dlng_history`, then, when given a
  date that the deleted history had a row for, writes a marker back for that date. Wrapped
  in try/catch like every other write here. **Named `deleteHistory`, not `clearHistory`** —
  `src/app.ts` already has a module-private `clearHistory()` for the undo stack.

**Why `deleteHistory` can write a row back, which looks contradictory:** it is the fix for
the hole the plan review found. `hasPlayerData()` (`src/storage.ts:142`) returns true only if
`dlng_history` exists or a mid-game board does — and solving clears the mid-game board
(`src/app.ts:986`). So deleting history after solving today leaves neither, the router sends
the player to `/welcome`, and today's puzzle becomes replayable. That is precisely the bug
brief 66 exists to prevent, arrived at by a different route. The marker written back holds
the date and nothing else, which is exactly what brief 71 says a player who has opted out
gets, so it honours the request rather than working around it. Test 13 below pins it.

13. `deleteHistory('2026-08-10')` on a history containing that date leaves exactly one row:
    `{ date: '2026-08-10', tries: 0, marker: true }`. Called with no argument, or with a
    date the history had no row for, it leaves `dlng_history` absent entirely.
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
12. `avgTimeSeconds` ignores rows with no `seconds`, rather than reading them as 0 —
    brief 61.
13. `avgTimeSeconds` ignores a row with `seconds: 1801`, and `fastestFirstGoSeconds` does
    too — brief 31. The row itself is still counted in `plays`; only its *time* is excluded.
14. `avgTimeSeconds` is `null`, not `0`, when no countable row has a valid time. The panel
    renders a dash, not `0:00`.
15. `fastestFirstGoSeconds` only considers rows with `tries === 1` — brief 13.

*Exclusions*
16. An `archived: true` row changes no figure at all — brief 16.
17. A `marker: true` row changes no figure at all: not `plays`, not `avgGoes` (its
    `tries: 0` must never reach the sum), not either streak — brief 123.
18. A row that is both `marker` and `archived` is excluded once, not twice.

*Chart and formatting*
19. `goesDistribution` returns exactly six buckets, in order, zeros included, with 7 goes
    and 12 goes both landing in `6+` — brief 133.
20. `formatDuration`: `221 → "3:41"`, `48 → "0:48"`, `3840 → "1h 04m"`, `null → "—"` —
    brief 88, 134. The hour branch is reachable precisely because `MAX_STORED_SECONDS` is a
    day rather than thirty minutes.
21. `speakDuration`: `221 → "3 minutes 41 seconds"`, `48 → "48 seconds"`,
    `60 → "1 minute"`, `3840 → "1 hour 4 minutes"`. Used only by the announcement.
22. `countableGames` counts countable rows, and the reveal gate is
    `countableGames > REVEAL_AFTER_GAMES` — 2 games hides, 3 reveals. An explicit test,
    because this is a one-off-by-one away from showing the wrong thing on the day a player
    is most likely to be paying attention.

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
export function speakDuration(seconds: number | null): string   // "3 minutes 41 seconds"
// Constants and validSeconds() ship in Task 1; Task 2 adds everything above them.
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
10. `seconds()` is capped at `MAX_STORED_SECONDS` on read, so what the timer hands to
    storage is always storable. It is **not** capped at `OUTLIER_SECONDS`: a genuinely long
    game keeps its real time and is excluded from the averages later, per brief 31 and 134.
    A test asserts a 40-minute game reads 2 400, not 1 800.
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

**One note on the opted-out player:** `buildActiveState` persists `elapsed` and `idles` even
when saving is switched off, because the mid-game board is persisted then too — that is the
existing behaviour brief 70 explicitly kept, on Jamie's reasoning that saving your current
play state is core functionality. Nothing about that game is written to history and no event
is sent (brief 65, 141). `clearActive()` on solve removes it. Recorded because "we save
nothing" deserves an honest footnote rather than a surprise.

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

### Task 5 — the untick warning and the submit countdown

**Implements:** brief 68, 91 (reworded), 100, 101, 130 — all as settled at P-01.

Jamie's mechanism: unticking the box swaps the message and disables submit for five seconds.
Nothing is deleted until the player submits. No dialogue, no confirm button, and re-ticking
the box puts everything back.

**Tests first** — `tests/save-warning.spec.ts`, new. The countdown is a small state machine
with an injected clock, so it can be tested without waiting five real seconds:

1. Ticked → no warning text, submit available.
2. Unticking → the warning text appears and submit is unavailable.
2a. **The checkbox's label reads "Save my scores on this device" throughout** — before,
    during and after the warning. Its accessible name never becomes the warning text (P-02).
3. Four seconds in, submit is still unavailable and the countdown reads `1`.
4. At five seconds submit becomes available and the countdown text is gone.
5. Re-ticking **before** the five seconds are up clears the warning and makes submit
   available immediately — the countdown does not hold a player hostage for a change they
   have already undone.
6. Unticking, re-ticking, then unticking again restarts a full five seconds rather than
   resuming the first one.
7. The countdown never leaves submit unavailable permanently if the tab is hidden across the
   five seconds: availability is computed from the clock on the next check, not from a timer
   that may not have fired.

**Implementation** — `src/save-warning.ts` holds the state machine; `src/app.ts` wires it to
the real checkbox and submit button; `index.html` gains the warning paragraph.

**The design, as Jamie specified it 2026-08-10.** Two lines appear beneath the checkbox when
it is unticked. The checkbox keeps its own label — see P-02 below, which settles that and
carries the final layout.

- Line one is the warning, in `--color-error`. That is the existing berry-red token, built
  from the cherry chroma at the accent lightness, and it already flips between light and dark
  on its own. **No new colour** (brief 83). There is no token called "berry"; `--color-error`
  is the one Jamie means, and it is the only red the palette has.
- Line two is the countdown, in `--color-text` — the primary text colour for whichever mode
  is active, again flipping on its own.
- Countdown wording: **"Submit enabled in 5"**, counting 5, 4, 3, 2, 1, then both lines go.
- The tick box sits against the top line. The two lines are left-aligned with each other, so
  the second line starts under the first line's text and there is a gap beneath the tick box.
- The submit button is visually dimmed to `opacity: 0.5` while it is unavailable.

**On dimming the button — permitted, and recorded so a later reader does not "fix" it.**
`.btn-solid` is `--color-accent` behind `--color-bg` text, whose tightest pairing in the
palette is 5.36:1. At half opacity that falls below the 3:1 that `docs/CONVENTIONS.md` asks
of UI components. WCAG 1.4.3 and 1.4.11 both exempt inactive controls, so this is allowed,
and the five seconds are precisely when the control is inactive. `tests/palette-contrast.spec.ts`
tests the palette rather than component states, so it does not need a case for this.

Warning copy is **"Your existing stats will be deleted when you submit."** — Jamie's own
wording, used verbatim. It replaces brief 91's dialogue text, which described buttons that no
longer exist.
- The warning line is `role="status"` `aria-live="polite"`, so unticking announces the
  consequence rather than leaving it visual-only. **The countdown line is not live** — five
  announcements in five seconds is noise. It is announced once when it appears and once when
  submit becomes available.

**P-02 — SETTLED: Jamie 2026-08-10, "agreed, I wondered about that earlier."** Accessibility
is his to sign and he has signed it.

The question was whether the warning replaces the checkbox's label. It does not. **The
checkbox keeps "Save my scores on this device" as its label permanently**, and the warning
and countdown appear as two lines underneath — three lines in total while the warning is up,
rather than the two in Jamie's original sketch.

Why: if the label text swapped, the control would stop saying what it does. A screen reader
would announce "Your existing stats will be deleted when you submit, checkbox, not checked",
and anyone returning to the screen would see a red sentence beside a box with no idea what
the box was for. It would also fail WCAG 2.5.3 Label in Name, which voice control depends on.

So the layout, superseding the sketch above:

```
[ ] Save my scores on this device                            ← --color-text
    Your existing stats will be deleted when you submit.     ← --color-error
    Submit enabled in 5                                      ← --color-text
```

Jamie's layout rules are unchanged and simply move down a line: the tick box sits against its
own label, and the two new lines are left-aligned with that label's text, leaving a gap
beneath the tick box.

The warning line is tied to the checkbox with `aria-describedby`, so unticking it announces
the label, the state, and then the consequence — in that order.
- **Submit uses `aria-disabled`, never the native `disabled` attribute**, and its handler
  no-ops while unavailable. This is the house rule at `docs/CONVENTIONS.md` — browsers blur a
  natively-disabled element, and the keypad's hundreds-box `0` and the undo/reset controls
  already work this way. Focus is on the checkbox rather than submit at the moment of the
  change, so nothing is stolen today, but a player who tabs to submit during the five seconds
  must not be thrown to the top of the document.
- The remaining seconds are in the button's accessible name, so a screen-reader user is not
  left pressing a button that silently does nothing.

**Why five seconds is worth having at all:** it is the whole confirmation step. There is no
second click to catch a mis-tap, so the pause plus the visible warning is what stands between
an accidental tap and a deletion. Recorded because a later reader will be tempted to remove
it as friction, and it is load-bearing.

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
- **Nothing about score saving appears on this panel at all** — no checkbox and no
  explanation, in any mode (P-01). The setting and everything said about it live on the play
  screen. When saving is off, the *All time* block is simply not rendered.
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
5. **Saving off**: *This game* renders and nothing else. No streak block, no *All time*
   block, no heading, no explanation — brief 53, 65 and 90 as overridden by P-01.
6. **Saving off renders no mention of score saving anywhere on the panel** — no checkbox, and
   no text matching "saving". An explicit test, because brief 53, 65 and 90 all ask for
   something here and P-01 removed all three, and the brief is what a builder reads first.
   The line that used to explain this is deferred to #309.
7. **Random puzzle**: *This game* only, plus "Random puzzles don't count towards your
   stats" — brief 52, 93.
8. **Archive replay** (`activeDate !== todayLocal`): the minimal existing panel, no streaks,
   no totals, no timing — brief 54.
9. **Reload after a saving-off solve** (`'marker'` mode): today's row is a marker, so the
   number of goes and the time are both unknowable. The hero line reads "Solved!" with no
   number and no time — never "Solved in 0". This is the mode the marker forces into
   existence and it is the sharpest edge in the build.
10. Each of the seven explanatory lines at brief 135 appears verbatim under its stat, and
    "Miss a day and the streak starts again" appears under the streak pair.
11. The goes chart renders six rows in order with counts as text — brief 133.
12. A game with no valid time shows a dash in the *This game* line, not `0:00` — brief 61.
13. A game of 3 900 seconds shows `1h 05m` on the panel while being absent from the average
    and from fastest — brief 31, 134. This is the case the two-constant split at the head of
    this plan exists to make possible.
14. **The announcement**: the live region reads exactly
    `Solved in 2. 3 minutes 41 seconds. Play streak 14.` — goes, time, play streak, and
    nothing else — brief 139.
15. The announcement omits the time when it is unknown, and omits the play streak on the
    new-player and saving-off states, where no streak is shown.
16. Re-rendering the same solve does not write the live region a second time. A module-level
    flag, reset when a new puzzle starts, not a comparison of the text.

**Implementation** — `src/completion.ts`:

- `computeStats` and its `Stats` interface are **deleted**. `renderCompletion` calls
  `computePlayerStats(loadHistory(), todayKey())` and renders what it gets. Everything on
  the panel is recomputed on each render, never stored as a running total (brief 55).
- A `PanelMode` decides which blocks exist: `'random' | 'archive' | 'marker' | 'new' |
  'saving-off' | 'full'`. One function, one switch, so the six states cannot drift apart.
- The announcement is built from the same values the panel renders, spelled out for speech
  by `speakDuration`: `3:41` becomes `3 minutes 41 seconds`. A screen reader saying "three
  colon forty-one" is the reason this is not the display string.
- The hero line reads `Solved in 2 · 3:41` (brief 88).
- **Brief 90's copy is deleted, not reworded.** P-01 removes the whole *All time* block for a
  saving-off player, so there is no line to write. The new-player line at brief 92 is
  **not** shown to them either: "your streaks and all-time stats start from your third game"
  would be a promise we are not going to keep, since with saving off no third game ever
  accumulates. They see the *This game* block and nothing else.

**`renderCompletion` gains one optional field, and all four call sites are specified.**
`RenderCompletionOpts` gains `seconds?: number`. The four callers in `src/app.ts`:

| Call site | Passes |
|---|---|
| `:1005` today's live solve | `timer.seconds()` |
| `:998` random solve | `timer.seconds()` — shown, but never stored and never sent (brief 52) |
| `:902` archive replay of a solved day | `entry.seconds` — usually absent, which renders a dash |
| `:1376` boot pre-render of today's solved state | `entry.seconds` from history, or nothing if the row is a marker |

**When the announcement is written, and why it is not at render time.** `renderCompletion`
runs *before* the screen becomes visible — at `src/app.ts:1005` the very next statement is
`replaceRoute('/solved')`, and at `:998` it is `showScreen('completion')`. At that moment the
completion `<section>` still carries `aria-hidden="true"` (`index.html:334`, cleared by
`src/screens.ts` during the transition). A live region inside an `aria-hidden` subtree is not
spoken, so writing it at render time would announce nothing at all — which is the exact
failure brief 126 was raised to fix. So `renderCompletion` *prepares* the announcement text
and `src/screens.ts`'s transition writes it once the completion screen is shown and
`aria-hidden` has been cleared. Task 13's browser tests are what actually prove this works;
the jsdom test can only prove the text is right.

**Avoiding the second announcement (brief 99).** `[data-feedback]` on the play screen carries
`aria-live="assertive"` (`index.html:321`) and `renderFeedback("correct", …)` writes
"Correct! That's puzzle #N." into it on every solve (`src/app.ts:368`). Left alone, a player
would now get that *and* the completion announcement — two voices, which is what brief 99
forbids. So `renderFeedback` gains an `announce` option, defaulting true:

- **daily solve** and **random solve** → `announce: false`. Both move to the completion
  screen, which does the announcing. The visual text is unchanged; only the live region is
  suppressed, by setting `aria-live="off"` on the element before writing and restoring
  `"assertive"` in `resetPuzzleUI`.
- **archive solve** → `announce: true`. It stays on `/play` and reaches no completion
  announcement, so this is its only one.

**Why blocks are absent rather than hidden:** a `hidden` block is still in the accessibility
tree in some combinations, and a screen-reader user tabbing into an empty *All time* heading
would get exactly the "looks broken" impression brief 19 exists to avoid.

---

### Task 8 — the save-my-scores setting, in two places

**Implements:** brief 62, 65, 66, 67, 68, 70, 71, 90, 91, 100, 101, 123, 124, 129, 130.

**This is the task that P-01 hangs on.** Written to my recommendation: the warning dialogue
is the confirmation, on both screens.

**Tests first** — `tests/save-pref.spec.ts`, new (jsdom):

1. Unticking the box deletes nothing. `dlng_history` is byte-for-byte unchanged until a
   submit happens — the single most important test in this task.
2. Unticking persists `saveScore: false` immediately, as it does today. The preference and
   the deletion are separate events.
3. Re-ticking before submitting leaves history untouched and saves that game normally.
4. **Submitting a correct answer with the box unticked deletes the stored results** —
   brief 65, as settled at P-01.
5. **After that deletion, a marker remains for the day just solved**, so `hasPlayerData()`
   is still true and today's puzzle is not replayable — brief 66, 125. See the reasoning
   under `deleteHistory` in Task 1.
6. Submitting an **incorrect** answer with the box unticked deletes nothing. Deletion happens
   on a solve, not on any press of the button — otherwise a wrong guess silently destroys the
   history of a player who was about to change their mind.
7. Unticking and then abandoning the puzzle deletes nothing. The next game they solve with
   the box still unticked does delete, because the rule is evaluated at solve time from the
   stored preference, not from a flag armed earlier in a session that no longer exists.
8. Ticking the box sets `saveScore` true immediately and does not resurrect deleted history.
9. With saving off, solving today writes a marker and nothing else: `tries` is 0, no
   `answer`, no `seconds` — brief 65, 71, 123.
10. With saving off, an archive solve writes a marker carrying `archived: true`.
11. With saving off, no `puzzle_time` event is sent — brief 141.
12. A marker for today still makes `hasPlayerData()` true, so the returning-player redirect
    keeps working — brief 125.
13. **Reloading after a saving-off solve renders "Solved!", never "Solved in 0 tries".**
    One case per reader, listed below.

**The rule, stated once so it cannot drift:** at the moment a correct answer lands, if
`saveScore` is false, delete the stored history and write a day-only marker for the puzzle
just solved. That is the whole mechanism. It holds no state between sessions, needs no
"pending deletion" flag, and reads identically to brief 65's own sentence — "if they submit
with it unticked, remove the storage entry".

**Implementation:**

- `index.html`: the play-screen checkbox label becomes **"Save my scores on this device"**
  and the biscuit icon goes (brief 129). It stays a real `<input type="checkbox">` with a
  real `<label for>`, as it is today (brief 100). It is the only such control in the app.
- `src/app.ts`'s existing checkbox handler (`:1122`) keeps calling `persistPrefs`, and gains
  the warning-and-countdown wiring from Task 5. It does **not** delete anything.
- The solve path in `handleGuess` splits on the preference:
  - saving **on** → `recordGame(date, tries, { answer, archived, seconds })`
  - saving **off** → `deleteHistory(date)`, which removes the stored results and leaves the
    marker for the day just solved — brief 65, 66, 71, 123.

  `deleteHistory(date)` replaces the `recordMarker(date, archived)` call the previous draft
  had here: writing a marker on top of history that is about to be deleted, and then deleting
  it, would be two steps that have to agree. One call that does both cannot disagree with
  itself. `recordMarker` still exists and is what `deleteHistory` uses internally.

**Every reader of `entry.tries` has to learn about markers — there are four, not one.**
Adding a row whose `tries` is 0 and meaningless to a codebase that reads `entry.tries`
straight out of history is the sharpest edge in this build. All four, with what each does:

| `src/app.ts` | Today | With a marker |
|---|---|---|
| `:827` `showCompletedState(entry.tries)` | "Solved in 2 tries!" | "Solved!" — no number, and no answer digits revealed, because neither was stored |
| `:897` `showCompletedState(entry.tries, date)` (archive) | same | same |
| `:902` `renderCompletion(num, entry.tries, …)` (archive) | archive panel | `'marker'` mode, per Task 7 test 9 |
| `:1376` `renderCompletion(_num, _todayHistoryAtBoot.tries, false)` (boot) | full panel | `'marker'` mode |

`showCompletedState(tries: number | null)` — `null` means "played, not recorded". A single
`entry.marker ? null : entry.tries` at each of the four call sites, and one branch inside
`showCompletedState`. Small, but it has to be done at all four or the fifth reload of the
day says "Solved in 0 tries".

**Why the marker carries `archived` too:** an archive solve with saving off still needs the
archive page and the replay check to know the day was played. Every figure filters markers
out first, so the extra flag costs nothing and keeps both readers working (brief 124).

---

### Task 9 — the archive page's goes column

**Implements:** brief 124.

**Tests first** — `tests/archive-goes-column.spec.ts`, **new**. Not
`tests/archive-stats.spec.ts`: that file tests `completion.ts`'s stat boxes, not the archive
page, and it is itself rewritten in Task 7 when those boxes are deleted. (Task 7's test list
covers what it was testing — that an archived solve changes no daily figure — so nothing is
lost, but the file must not simply be left to fail.)

The column is populated by hand-written ES5 inside a template string in
`src/worker/puzzles.ts:337`, which has no build step and no test harness. The new spec makes
one: render the page with `renderPuzzlesPage`, parse it into a jsdom document, seed
`localStorage`, then execute the page's own inline script text against that document. That
tests the shipped code rather than a copy of it.

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
2. `tests/worker/analytics-db.spec.ts:79` asserts `VALID_EVENTS.size === 10`. It becomes 11.
   Named here because a bare count assertion fails with no clue as to why.
3. `recordEvent` stores its value as whole seconds and its source verbatim.

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
  `getStats`'s batch gains an **eighth statement, built through the existing `q()` helper**:

```ts
q(`SELECT SUM(value * sample_interval) AS total, SUM(sample_interval) AS n
   FROM analytics_events ${where} AND event = 'puzzle_time'`),
```

  **It must use `${where}`, never a hardcoded `WHERE hostname = ? AND ts >= ?`.** `getStats`
  builds `where` with the time clause omitted for all-time and binds `args` of matching
  length (`analytics-db.ts:152-158`) — the comment there explains why all-time drops the
  clause rather than passing a zero cutoff. A hardcoded second placeholder would have two
  bind slots and one argument on `?period=all`, and the page would throw. Test 5 below is
  what catches it.

  It goes **last** in the batch array, after `first`, and is destructured last — the batch is
  read positionally at `:163`, so inserting it anywhere else silently reassigns every result
  after it. The "Seven statements, batched" line in the doc comment above `getStats` becomes
  eight.

  Returns `null` when `n` is 0, so the page can tell "no data" from "zero seconds".

- `src/worker/stats.ts`: one more card in the existing grid, formatted `m:ss`. No chart and
  no new range controls (brief 49).

**On the weighting, precisely (brief 118):** every `puzzle_time` row is one we wrote
ourselves, so its `sample_interval` is 1 and the weighting changes nothing today. It is
written weighted anyway because it is the house rule in `docs/ANALYTICS.md` and it protects
the figure if sampling ever starts. Test 1 asserts the *SQL shape*, using rows seeded with
an interval above 1 — it does **not** claim the live number differs, which is the assertion
brief 118 warns against.

The `docs/ANALYTICS.md` note lands in Task 12 with the rest of the documentation, not here.

---

### Task 12 — documentation

**Implements:** brief 71, 76, 123, and the standing rule in `CLAUDE.md`.

- `docs/ARCHITECTURE.md` — the `dlng_history` line gains `seconds?` and `marker?`; the
  `dlng_active` line notes the two optional fields and that `v` stays at 1; the Files list
  gains `player-stats.ts`, `play-timer.ts` and `save-warning.ts`.
- `docs/ANALYTICS.md` — what `puzzle_time` is, what `clean` and `idle-N` mean, that the
  average is weighted by `sample_interval` per the house rule, and that it covers opted-in
  players only (brief 141) — worth knowing the first time that number looks surprising.
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
3. **Saving turned off.** Seed `{ saveScore: false }`. Solve. Assert *This game* renders and
   that the streak block, the *All time* block and any mention of saving are all absent from
   the panel — and that `dlng_history` holds a marker with `tries: 0` and no `answer`.
4. **The delete flow, end to end, on the play screen.** Seed history, start today's puzzle,
   untick the box. Assert the warning text appears and submit is unavailable; wait out the
   five seconds and assert submit becomes available again; assert `dlng_history` is still
   untouched at that point. Solve. Assert the seeded results are gone and a marker remains
   for today. Then **reload and confirm the player is not sent to `/welcome` and today's
   puzzle is not replayable** — what keeps that working is the marker `deleteHistory` writes
   back for the day just solved, per Task 1.

   This is the one test that genuinely needs the five-second wait, so it takes five seconds
   longer than the others. Worth it: it is the only destructive thing in the build, and the
   pause is the only thing standing between a mis-tap and a deletion.

**Existing browser tests that Task 6 breaks, and which this task must update:**

- `e2e/specs/completion.spec.ts:30-34` asserts `stat("Played") === "3"`,
  `stat("Avg tries") === "3.0"`, and `toHaveCount(4)` on `[data-completion-stats] > div`.
  All three describe the four-box grid that Task 6 removes. Rewritten against the new blocks.
- `e2e/pages/completion.page.ts:17` locates `[data-completion-stats]`, which no longer
  exists. Replaced with locators for the three blocks, the chart, the checkbox and the live
  region.

`e2e/helpers/storage.ts`'s `HistoryEntry` gains `seconds?`, `marker?` **and `archived?`** —
it is missing the last one today, and the marker-plus-archive scenarios cannot be seeded
without it.

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
- Unticking the box shows the warning and holds submit for five seconds; the deletion happens
  on the next solve, not before, and leaves a day-only marker behind.
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
| 53, 90 | no code — P-01 removes the checkbox *and* the explanation from the panel; deferred to #309 |
| 54 | 7 |
| 55 | 2, 7 |
| 56 | no code — existing behaviour unchanged |
| 57, 58, 78, 86, 96, 105, 114, 142, 143 | no code — sign-offs |
| 59, 60, 75 | 1, 4 |
| 62, 66, 70, 71 | 8 |
| 65, 68, 130 | 5, 8 — mechanism settled at P-01: warning, countdown, delete on submit |
| 67 | no longer applicable — P-01 leaves one checkbox, so there are no two to keep in step |
| 63, 64 | no code — consequences of 1 and 10 |
| 69, 129 | 8 (copy on both checkboxes) |
| 72, 73 | 2 (the module move) |
| 74 | 3, 4 |
| 76 | 10 |
| 77 | 11 |
| 79–83, 85 | 6 |
| 87, 88, 94, 95, 134, 135 | 6, 7 |
| 89 | 6, 7 — "first go" throughout |
| 91, 101 | 5 — reworded at P-01: the dialogue is replaced by a warning and a countdown |
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

Task 5 no longer blocks Task 8 the way the confirm dialogue did — the warning is presentation
and the deletion is a solve-path rule, so they touch different code. They stay adjacent
because they are the same feature to a player.

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
5. **Deleting history makes a long-standing player look new to analytics.** `src/app.ts:44`
   computes `isNewUser = !localStorage.getItem("dlng_history")` once at module load, and
   every event carries it. After a delete, that player's next visit reports `newUser: true`,
   nudging the new-user figure on `/stats` upward. Accepted, not fixed: it is a handful of
   players at most, the alternative is keeping a "you used to have stats" flag on a device
   whose owner just asked us to forget them, and that trade is the wrong way round. Recorded
   so the figure is not later read as growth.

---

## Review record

### da-plan — run 2026-08-10, all findings answered

Fresh-context review against this file, the brief and the repo. Result: **5 High, 11 Medium,
7 Low.** Every High and Medium is fixed in place above rather than appended, so a builder
reading a task reads the corrected version. What changed:

**High**

1. **Deleting history left today's puzzle replayable.** `hasPlayerData()` needs either
   history or a mid-game board, and solving clears the board — so a delete after solving
   left neither. `deleteHistory` now writes a marker back for the solved day. Task 1, Task 8
   tests 4 and 5, Task 13 test 4.
2. **The confirm dialogue could not be unit-tested.** jsdom 25 has no `<dialog>` support —
   verified by running it. Coverage split: promise and label logic in jsdom with the methods
   stubbed, focus and Escape behaviour in Playwright. Task 5, Task 13.
3. **The thirty-minute rule contradicted itself across three tasks.** Brief 122's validity
   ceiling and brief 31/134's outlier threshold were the same number doing two jobs, which
   made brief 134's hour format unreachable. Split into `MAX_STORED_SECONDS` and
   `OUTLIER_SECONDS`, with the reasoning written out at the head of the plan.
4. **The `/stats` query would have thrown on `?period=all`.** The plan's literal SQL
   hardcoded a time clause that `getStats` deliberately omits for all-time, giving two bind
   placeholders and one argument. Now built through the existing `q()` helper. Task 11.
5. **There was no checkbox to untick when saving was on.** The completion panel only rendered
   one in the switched-off state, and the play-screen one is unreachable after a solve — so
   brief 65's whole delete flow had no control. The *All time* block now always ends with
   it. Task 6, Task 7 test 8.

**Medium** — the marker's `tries: 0` has four readers, not one (Task 8, with all four
tabulated); Task 9 targeted a test file that tests something else, and needs a new harness
for the archive page's inline script; existing browser tests and the completion page object
assert against the four boxes Task 6 deletes (Task 13); `VALID_EVENTS.size` is asserted as a
literal (Task 10); the announcement would have been written while the screen was still
`aria-hidden`, so nothing would have been spoken (Task 7); the play screen's assertive
"Correct!" would have made two announcements, which brief 99 forbids (Task 7); the marker
shape was stated two ways (Task 1 test 3); shared constants were used a task before they
existed (now created in Task 1); `avgTime`/`avgTimeSeconds` name drift (Task 2); the four
`renderCompletion` call sites are now tabulated (Task 7).

**Low** — all seven fixed: the new-user skew after a delete is now risk 5; the opted-out
player's persisted `elapsed` has a note in Task 3; the eighth statement's position in the
batch is specified; Task 7's re-render test says what it means; the e2e `HistoryEntry` gains
`archived?`; the reveal comparison is written out; the `ANALYTICS.md` note lives in Task 12
only.

The review confirmed brief coverage is complete — it walked all 143 items independently and
found none missing or misfiled.

### P-01 settled, 2026-08-10 — what changed after the review

Jamie answered P-01 after da-plan had run, and his answer removed work rather than adding it.
The confirm dialogue is gone, and with it `src/confirm-dialog.ts`, its spec, and the jsdom
`<dialog>` problem the review raised as H2 — that finding is now moot rather than fixed. The
review's H5 (no checkbox to untick when saving is on) is resolved by P-01 removing the
control from the panel entirely, rather than by the extra checkbox the earlier fix added.

Task 5 was rewritten from the dialogue to the warning and countdown. Tasks 6, 7, 8 and 13
were amended. One copy change falls out of it: the warning wording is plainer than Jamie's
draft. Jamie then amended P-01 a second time — nothing about score saving appears on the
completion panel at all, not even an explanation — so brief items 53 and 90 now need no code
and the saving-off panel is the *This game* block on its own.

Nothing in Tasks 1, 2, 3, 4, 9, 10, 11 or 12 changed, so the review's findings against those
stand as fixed. The marker-writing behaviour of `deleteHistory` — the review's H1 — matters
more under P-01, not less: it is now the only thing keeping today's puzzle unplayable after a
delete.

- **da-plan:** passed, 2026-08-10, after the fixes above.
- **P-01:** settled by Jamie, 2026-08-10 — delete on submit, no dialogue, nothing about
  saving on the completion panel.
- **P-02:** settled by Jamie, 2026-08-10 — the checkbox keeps its label; the warning and
  countdown sit underneath. Accessibility is his to sign and he has signed it.
- **Jamie's approval of the plan as a whole:** given 2026-08-10 — "update that then I'll new
  and build". No open questions remain. **Ready for Build.**

---

## Build record — 2026-08-10

All thirteen tasks built, one commit each, on `dev/player-stats`. Unit suite: 738 passing
across 37 files. Production build clean. Playwright not run — it never runs on the Pi; CI
runs chromium on the pull request and the full matrix into main.

Where the build departed from the plan, and why. Nothing here changes a decision Jamie or
Dave made; each is a place the plan contradicted itself or could not be built as written.

### B-01 — the warning line stays while the box is unticked. **NEEDS JAMIE.**

Task 5 said "Submit enabled in 5, counting 5, 4, 3, 2, 1, then **both lines go**". Built so
that only the *countdown* line goes; the warning stays for as long as the box is unticked.

Why: the deletion happens on submit, which can be minutes after the countdown ends. If the
warning has vanished by then, the destructive action is unlabelled at the moment it
happens. The plan's own reasoning three paragraphs later is that "the pause **plus the
visible warning**" is what stands between a mis-tap and a deletion, and Jamie's own message
(2026-08-10, "Warning line. But clearer. Second line, 'Submit enabled in 5 (4 3 2 1)'")
answers where the countdown lives, not when the warning disappears.

**This is the one build decision that changes what a player sees, and it is Jamie's to
confirm or reverse.** Reversing it is a two-line change in `renderSaveWarning`.

### B-02 — `deleteHistory` writes its marker unconditionally

Task 1 test 13 said the marker is written only when the deleted history held a row for that
date. Task 8's only caller runs at solve time with saving **off**, where no row was ever
written — `recordGame` never ran. The conditional version would leave that player with
nothing, `hasPlayerData()` would be false, and today's puzzle would be replayable: the exact
bug the plan's own H1 finding added the marker to prevent. Built unconditional, with the
reasoning in the function's doc comment and a test pinning it both ways.

### B-03 — `recordSolve` in `storage.ts`, so Task 8's rule is testable

Task 8's test list (`tests/save-pref.spec.ts`) describes behaviour that lives in `app.ts`,
which has no unit-test harness in this repo and cannot get one cheaply — it fetches, boots
the router and caches DOM at import. So the rule itself moved into one exported function
next to `recordGame`, `recordMarker` and `deleteHistory`, which is where brief 75 puts
storage's three new jobs anyway. `app.ts` calls it. The rule is now stated once, in one
place, and thirteen tests drive it directly.

### B-04 — `playTimeToSend` in `play-timer.ts`, for the same reason

Task 10's four conditions were specified as an `if` in the solve path, which is untestable
here and where a quietly dropped condition would be invisible — the event would simply start
arriving from somewhere it should not. Extracted to a pure function with seven tests.

### B-05 — `show()` resumes the clock for a player who had already started

Task 3's test list did not say what `show()` does to the clock. Brief 26 says "coming back
resumes it", so it resumes — but only for a player who has already acted, or opening a tab,
switching away and coming back would start counting before their first action, against
brief 27. The idle cut-off still covers someone who comes back and then wanders off.

### B-06 — `tests/archive-stats.spec.ts` rewritten rather than deleted

It asserted against the four stat boxes Task 7 removes. Its two real-world scenarios move to
`player-stats.ts`, the layer that now owns those rules, rather than being lost.

### B-07 — the explanatory line is a second `<dd>`, not inside the first

Task 6 said the line sits "in the same `<dd>`, after the number". A single `<dt>` may have
several `<dd>`s, so it is its own `<dd class="stat-note">` — valid HTML, reads in the right
order ("Plays, 128, Daily puzzles you have finished"), and lays out as a full-width row
underneath rather than squeezed into the right-hand column. The point of the plan's wording
— that it is text under the stat and never a tooltip — is unchanged.

### B-08 — three live regions, each with one job

The plan asked for the warning to announce when it appears, and for a second announcement
when submit becomes available, without the countdown announcing five times. Built as: the
warning paragraph is `role="status"` and announces itself; the countdown paragraph is not
live; a small screen-reader-only region announces "Submit is now available." once. Appending
to the warning region instead would have re-announced the whole warning.

### Not built, deliberately

- The share buttons (brief 140).
- Anything about score saving on the completion panel (P-01) — pinned by an explicit test,
  because brief 53, 65 and 90 all ask for something there and the brief is what a builder
  reads first.

### Next

Human review, then `da-build` on the diff, then push and open the pull request.

---

## da-build — run 2026-08-11, findings fixed

Fresh-context review of the whole diff, after Jamie's review and after the 2026-08-11 copy
change. Result: **0 High, 2 Medium, 7 Low.** Both Mediums fixed, plus three Lows worth
taking in the same pass. The review confirmed both named risks are genuinely closed — all
five readers of `entry.tries` handle a marker, and `deleteHistory`'s marker really does keep
today unreplayable — and endorsed all eight departures B-01 to B-08.

**M1 — one forged POST would have ruined "Avg time to complete" for good.**
`/api/event` is public and `recordEvent` casts `value` without validating it. Every previous
reader of that column bucketed it, so junk only ever added a junk bucket; `avgTimeSeconds`
is the first *unbounded mean* over it. A single `{"event":"puzzle_time","value":1e11}` would
have sat in the figure permanently with no non-destructive way to remove it, and the
client-side `validSeconds` guard is on the wrong side of the wire to help. Fixed with
`AND value BETWEEN 0 AND 86400` in the statement — which also excludes any junk already
stored. Two tests.

**M2 — the one announcement would probably not have been spoken.**
The build knew a live region inside an `aria-hidden` subtree is silent and deferred the
write to `screens:enter`. But that fires in the same synchronous block that takes the
completion screen from `display:none` to displayed, and a `display:none` subtree is not in
the accessibility tree at all — so the region and its text arrived together, as inserted
content, which screen readers routinely say nothing about. That is the exact silence brief
126 reopened section 9 to fix. Fixed by moving `[data-completion-live]` **outside every
`[data-screen]` section**, so it is in the accessibility tree from first paint and only its
text ever changes. The `screens:enter` handshake stays, and is now a change to a region that
was already being watched.

**L1 — `entry.tries` reached `innerHTML` unvalidated.** `loadHistory` validates nothing,
unlike `loadActive` and `loadUndo` next door. Self-XSS only — there is no cross-origin write
path to `dlng_history` — but `heroLine` now rejects anything that is not a whole count of
goes and returns "Solved!", which is a state it already handles.

**L2 — the explanatory lines rendered bold monospace.** `.stat-row dd` outranks `.stat-note`
on specificity, so the All-time notes were the loudest thing in a block settled as "open but
quiet", and differed from the identical notes in Streaks. A side-effect of B-07 the
departure note did not anticipate.

**The first fix for this was a no-op and the re-review caught it.** Restating the family and
weight on `.stat-note` could never win: `.stat-note` is (0,1,0) and `.stat-row dd` is
(0,1,1), and source order is only a tiebreak at equal specificity. The value rule is now
`.stat-row dd:not(.stat-note)`, so the note stops matching it at all rather than trying to
out-declare it. Verified in the built CSS, not just the source.

**L5 — an archive solve with saving off made today replayable.** Solve today with saving on,
untick, then solve an archive puzzle: `deleteHistory` wiped everything including today's
row, so `todayEntry()` found nothing and the router handed today's puzzle back. The review
graded it Low as faithful to brief 65 as written; it is fixed anyway, because the
consequence is exactly the replay bug brief 66 exists to prevent. `deleteHistory` now leaves
a marker for today as well when today had been played — no results kept, so the promise
holds, and the hole closes. Three tests. **Flagged to Jamie**, since it changes what a
delete leaves behind.

### da-build re-review — run 2026-08-11, one Medium found and fixed

The fixes above were re-reviewed cold. Four of the five were correct; the L2 fix was the
no-op described above, graded Medium and fixed properly. Three further Lows came out of it,
all taken:

- **The M2 fix was a position in `index.html` and nothing read it.** Moving the live region
  back inside a screen would have left the suite green and silently stopped the result being
  spoken. `tests/save-warning.spec.ts` now parses the shipped markup and asserts the region
  has no `[data-screen]` and no `aria-hidden` ancestor.
- **The M2 move introduced stale text.** The region used to leave the accessibility tree
  with the screen it lived in; now it is always there, so last game's result would sit
  between the main content and the footer for the life of the session. Cleared on reset and
  on entering any other screen — which also means two identical solves in a row both
  announce, since assigning the same textContent is not a mutation.
- **`deleteHistory`'s docblock said one marker** when it can now write two, and one of its
  tests had become clock-dependent. Both corrected.

**Not changed, recorded instead:** L3 (the warning is both a live region and an
`aria-describedby` target — may double on VoiceOver; needs a real screen reader to judge),
L4 (`/stats` still renders `4:12` rather than `4m 12s`; the Worker must not import client
modules and it is an internal page), L6 (a coverage gap: nothing asserts `app.ts` writes
`elapsed` into `dlng_active`, though both call sites were read and are correct), and the
`icon-cookie` sprite symbol, now unreferenced.
