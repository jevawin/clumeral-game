# Plan — Results page redesign (board O)

**Date:** 2026-11-15
**Branch:** `dev/results-page-redesign`. PR into `staging` (docs/GIT-WORKFLOW.md), never `main`.
**Brief:** [2026-11-15-results-page-redesign-brief.md](2026-11-15-results-page-redesign-brief.md) —
closed. Gates met: no `Ack: pending`; `da-brief` passed with fixes (items 81–92); §4 carries
Jamie's override.
**Approval:** pending — Jamie.
**da-plan:** run once on revision 1 (1 High, 7 Medium, 14 Low); all fixed in revision 2. **Blocked on Jamie:** R1 and R7 before Task 1.

Read the brief's "da-brief fixes" section (81–92) first: it amends earlier items by number, and
where they differ the later item wins. Item numbers below are brief item numbers.

Design reference: `docs/work/2026-11-01-Idea-O-Time-vs-Everyone.dc.html` (board O). Its CSS
block (lines 13–120) and markup (lines 143–300) are the source for every size quoted here.

---

## Decisions this plan makes (how, not what)

Each is an implementation choice inside a settled item.

- **D1. A new module, `src/goes-strip.ts`, holds the strip's markup builder and its spoken
  summary.** Pure: strings in, strings out, no DOM access, so it is unit-tested without a
  page. Sits beside `time-chart.ts`/`time-chart-view.ts` (item 37). `completion.ts` inserts its
  string; nothing else needs JavaScript, because the strip opens at today through CSS (D6).
- **D2. Counting rules and message copy go in `src/player-stats.ts`** (item 36): the per-day
  goes list, the before-today baselines, the chosen message, its copy and the Streaks line.
  That file already holds the formatting helpers (`formatDuration`, `speakDuration`), so copy
  living beside the rules has precedent.
- **D3. `goesDistribution` and `GOES_BUCKETS` are removed** (item 36 leaves it to the plan).
  The strip summary counts buckets from the strip's own day list, so the two can never
  disagree about which rows count. Every other `PlayerStats` field stays.
- **D4. The preview switch is a query parameter read once at module load** (item 84):
  `?strip=faded|faded-passing|hollow|dotted`. Read by a pure `stripVariant(url)` in
  `src/testing-panel.ts`, the home of every preview-only helper, gated by its existing
  `testingAllowed(hostname)`. On any other host, or with no or an unknown value, the result is
  the default. Read once at load because in-app navigation (`router.ts navigate`) pushes a bare
  pathname and drops the query; the choice holds for the page's life and survives a reload.
  The Testing panel also gets a "Strip misses" button group that reloads `/solved` with the
  parameter set, because Jamie tests on a phone (item 51 allows "testing panel or similar").
- **D5. The variant is one attribute on the panel**, `data-strip-variant` on
  `[data-completion-panel]`. CSS keys every variant rule off it, so the strip and the message
  icon change together (item 51: "the pick also settles the message icon's pill").
- **D6. The strip opens at today with O's `direction: rtl` scroller** and an `ltr` inner
  track. The initial scroll position is the right end in every engine, with no script and no
  remembered position (items 22, 32).
- **D7. The left fade is a `mask-image` on the scroller; the focus ring is drawn on its
  wrapper** with `:has(> [data-strip-scroller]:focus-visible)`, because a mask would also
  fade an outline drawn on the scroller itself (item 68).
- **D8. Heading icons sit on the padding line through the sprite sheet** (item 40):
  `icon-flame` and `icon-podium` get a viewBox tightened on the left to their ink edge plus
  `preserveAspectRatio="xMinYMid meet"`. Height stays 24 units, so the scale is unchanged and
  only the left edge moves. `icon-calendar` is reused on `/play` (`src/app.ts:881`), which
  item 11 puts out of scope, so it is left alone and the All time heading uses a new
  `icon-calendar-head` symbol with the same four shapes and the tight viewBox.
- **D9. One heading per card, built by one helper.** `card(id, heading, iconId, body)` in
  `completion.ts` replaces `block()`. Classes `result-card`, `result-card__head`,
  `result-card__icon`. The Daily leaderboard takes the same three classes (item 44).
- **D10. The Today `h2` keeps the `data-completion-heading` hook** (now inside the Today
  card), so the e2e helpers that wait on it keep working. The `index.html` pair is removed
  (item 35).
- **D11. `data-stat-block` values:** `today` (was `this-game`), `daily-leaderboard`,
  `streak`, `all-time`. `records` is gone.

### Readings to confirm (Jamie)

Places where the brief's words admit two readings. R1 and R7 are copy and counting
decisions, so they are **Jamie's to settle before Task 1 starts**, and the answer is recorded
in the brief, not only here. R2–R5 are readings inside settled items; each is a one-line
change if Jamie reads it the other way.

- **R1 — item 55, difference format. Blocks Task 1.** Item 55 is self-contradictory: it says
  differences use "the sentence form" (and item 54 says "never the compact chart form"), yet
  its examples are `17s quicker` and `9s under`, which only the compact form writes (the
  default writes `0m 17s`; from a minute up the two are identical, `1m 05s`). Recommendation:
  follow the examples — differences use `formatDuration(n, { compact: true })`; the figure
  line keeps the default form (`1 go, 0m 41s`). The plan is written that way; if Jamie picks
  the sentence form, `compact(x)` in Task 1 becomes `formatDuration(x)` and the expected
  strings become `0m 09s under`, `0m 17s quicker`.
- **R7 — items 18, 83, a 0s time. Blocks Task 1.** `validSeconds(0)` is valid, so a junk 0s
  solve (a bug the time chart already refuses, `completion.ts:358-363`) would become "Your
  fastest ever" and drag every later average. Recommendation: rungs 1 and 3 treat a time
  below 1s — today's or an earlier one — as no time. The plan is written that way
  (`timed(s) = s !== null && s >= 1`); if Jamie declines, drop the `>= 1`.
- **R2 — items 67/88, zero buckets.** The summary leaves out a bucket with no days ("56 in
  one, 3 in three…", never "0 in two").
- **R3 — the default variant before the pick is `faded-passing`.** It is the only faded look
  that passes 3:1 with no new colour (item 87). Production never sees a switch: the PR opens
  only after the pick (item 80).
- **R4 — the message icon's pill shows only under `faded`.** O pairs the pill with its 22%
  tint; under the other variants an accent pill would put the accent icon on an accent
  ground, so the icon sits plain (item 51's recommendation).
- **R5 — the strip's "{N} days · Today" row is `aria-hidden`.** The summary already says the
  day count and today's goes; reading "243 days Today" after it adds nothing. O's left
  chevron before "{N} days" is not drawn: item 60 names the words only and the sprite sheet
  has no chevron.
- **R6 — a short strip hugs the right edge.** With `direction: rtl` (D6), a strip narrower
  than the card sits against the right edge, under "Today". That is intended: today is the
  anchor, and the strip grows leftwards as days are added. The scroller stays a tab stop
  even when nothing scrolls (item 68 accepts it; the summary is still worth reaching).

Noted, not built: `index.html` has no `[data-completion-octo]` element, so the octopus
injection at the top of `renderCompletion` is dead code. It is left alone (outside this
brief) and raised with Jamie as a hygiene item.

---

## File map

| File | Change | Task |
|---|---|---|
| `src/player-stats.ts` | add strip days, message, copy, ordinal, streak line; later drop `goesDistribution` | 1, 7 |
| `src/goes-strip.ts` | **new** — strip markup and summary | 2 |
| `public/sprites.svg` | add `icon-bolt`, `icon-calendar-head`; tighten `icon-flame`, `icon-podium` | 3 |
| `src/testing-panel.ts` | `stripVariant()`, `STRIP_VARIANTS`, "Strip misses" buttons; history swaps keep `?strip=` | 4 |
| `src/completion.ts` | rewrite the panel as cards | 5 |
| `index.html` | remove the heading/subheading pair; panel gap | 5 |
| `src/tailwind.css` | add card, ledger, strip, variant rules (5); rebase dot (6); remove old rules (7) | 5, 6, 7 |
| `src/time-chart-view.ts` | slot and heading classes only | 6 |
| `docs/DESIGN-SYSTEM.md`, `docs/ARCHITECTURE.md` | update | 9 |
| tests (unit) | `player-stats`, `goes-strip` (new), `sprites`, `testing-panel`, `completion-stats`, `completion-links`, `time-chart-view`, `palette-contrast`, `demo-history`; delete `accent-rotation` | 1–7 |
| tests (e2e) | `pages/completion.page.ts`, specs `completion`, `player-stats`, `game-solve`, `a11y`, `random`, `testing-panel`, `time-chart`; new `results-page.spec.ts` | 8 |

Not touched: `src/worker/**`, `src/storage.ts`, `src/types.ts`, `src/app.ts`, `src/router.ts`,
`src/time-chart.ts`, `src/demo-history.ts` (item 42: its 9-go and 6-go days already draw two
broken columns), `heroLine` in `completion.ts` (item 11).

---

## Task 1 — Counting rules and copy in `player-stats.ts`

Items 17, 18, 20, 21, 22, 31, 36, 55, 56, 57, 75, 81, 82, 83, 89, 90.

Additive only: nothing existing changes in this task, so the old panel keeps building.

### API (all exported, all pure)

```ts
/** Rungs 1 and 3 need this many earlier valid times (item 83). */
export const MIN_EARLIER_TIMES = 3;

/** Rows past this draw as a broken column (items 22, 23). */
export const STRIP_CAP = 5;

export interface StripDay { date: string; goes: number }

/** One entry per countable row (not archived, not a marker) whose `tries` is an
 *  integer ≥ 1, sorted by date ascending. Today is included when it is in history.
 *  Missed days are not entries (item 24). */
export function goesByDay(history: HistoryEntry[]): StripDay[];

export type TodayMessage =
  | { kind: 'fastest'; under: number }       // seconds under the earlier best
  | { kind: 'quicker'; by: number }          // whole seconds under the earlier average
  | { kind: 'one-go'; nth: number }          // this one-go solve's ordinal
  | { kind: 'fewer-goes'; usual: string }    // the earlier average as shown, one decimal
  | { kind: 'solve-number'; n: number };

/** Item 17 as amended by 81, 83, 89. `tries` and `seconds` are today's, as the panel
 *  shows them; `seconds` already passed through validSeconds. Returns null when
 *  `tries` is not an integer ≥ 1. */
export function todayMessage(
  history: HistoryEntry[], today: string, tries: number | null, seconds: number | null,
): TodayMessage | null;

export interface MessageCopy { icon: string; pre: string; bold: string; post: string }
export function messageCopy(m: TodayMessage): MessageCopy;

/** 1 → "first"; otherwise the number with an English suffix (item 90). */
export function ordinal(n: number): string;

export interface StreakLine {
  figure: number;          // the play streak
  label: string;           // "days played" | "day played" | "days solved in one" | "day solved in one"
  best: number;            // the best play streak
  oneGoRun: number | null; // shown only from 2 and only when the label has not switched
}
export function streakLine(stats: PlayerStats): StreakLine;
```

### Rules, exactly

`earlier` = the rows `goesByDay` would keep (countable, `tries` an integer ≥ 1) with
`date < today` — strictly before today, so today never pulls a baseline (items 18, 31). Using
`goesByDay`'s filter means "Solve number" and the strip's "{N} days played" can never
disagree over a forged row. `timed(s) = s !== null && s >= 1` (R7). `earlierTimes` = the
`validSeconds` of each earlier row, kept where `timed`.

`todayMessage` tries the rungs in item 81's order and returns the first that holds:

1. **fastest** — `timed(seconds)`, `earlierTimes.length >= MIN_EARLIER_TIMES`, and
   `seconds < Math.min(...earlierTimes)`. `under` = that minimum − `seconds`. Equal is not a
   beat (item 18).
2. **quicker** — `timed(seconds)`, `earlierTimes.length >= MIN_EARLIER_TIMES`;
   `by = Math.round(mean(earlierTimes) − seconds)` on the exact mean, not the rounded
   `avgTimeSeconds`; holds when `by >= 1`. A difference that rounds to 0 does not count
   (item 55).
3. **one-go** — `tries === 1`. `nth` = earlier rows with `tries === 1`, plus 1.
4. **fewer-goes** — `earlier.length >= 1`; `usual = (sum of earlier tries / earlier.length)
   .toFixed(1)`; holds when `tries < Number(usual)` (item 89: compared with the average as
   shown, so 2 against 2.04 → "2.0" → no line).
5. **solve-number** — always. `n = earlier.length + 1`.

`messageCopy` (item 55; R1 for the differences; icons from the existing sheet, item 90):

| kind | icon | pre | bold | post |
|---|---|---|---|---|
| fastest | `icon-trophy` | `` | `Your fastest ever` | `, {compact(under)} under your best.` |
| quicker | `icon-arrow-up` | `` | `{compact(by)} quicker` | ` than your average.` |
| one-go | `icon-tick` | `` | `Straight in.` | ` Your {ordinal(nth)} one-go solve.` |
| fewer-goes | `icon-calculator` | `` | `Fewer goes` | ` than your usual {usual}.` |
| solve-number | `icon-gamepad` | `Solve number ` | `{n}` | `.` |

`compact(x)` is `formatDuration(x, { compact: true })`. Update the `formatDuration` doc comment:
the compact form is also used for message differences (R1).

`ordinal`: `n === 1` → `first`. Otherwise `n % 100` in 11–13 → `th`; else `n % 10` 1 → `st`,
2 → `nd`, 3 → `rd`, else `th`. So 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd, 101st,
111th.

`streakLine` (items 20, 21, 56, 57 as amended by 82):
- `switched = stats.playStreak > 0 && stats.firstGoStreak === stats.playStreak`.
- `label`: `switched` → `solved in one`, else `played`; prefixed `day ` when the figure is 1,
  `days ` otherwise.
- `best = stats.bestPlayStreak`.
- `oneGoRun = !switched && stats.firstGoStreak >= 2 ? stats.firstGoStreak : null`.

### Tests first — `tests/player-stats.spec.ts`

Add a `describe` per function. Each case builds a history with a local `day(back)` helper on
a fixed `TODAY`.

- `goesByDay`: archived and marker rows excluded; a row with `tries: 0`, `1.5` or `'3'`
  excluded; unsorted input comes back ascending; today included.
- `todayMessage`, one case per rung chosen, and one per rung skipped:
  - fastest chosen: earlier times 100, 90, 80, today 71 → `{ kind: 'fastest', under: 9 }`.
  - equal to best is not fastest: today 80 against the same → falls to `quicker` (`by` 10).
  - fastest skipped with 2 earlier times even when today beats both (item 83); falls through
    to `one-go` when today is one go.
  - fastest and quicker skipped when `seconds` is null, when `seconds` is 0 (R7), and when
    earlier rows have no times; an earlier 0s row is not counted towards the three.
  - today's own row in history does not change any baseline: the same case with and
    without today's row returns the same message (item 18).
  - quicker chosen: earlier 60, 120, 120 (mean 100, best 60), today 83 → not fastest, `by` 17.
  - an earlier row with `tries: '3'` is not counted: `solve-number` `n` matches
    `goesByDay` length.
  - quicker not chosen at a 0.4s difference: earlier 60, 60, 61, today 60 → falls through.
  - one-go: 7 earlier one-go rows → `nth` 8; none earlier → `nth` 1.
  - fewer-goes: earlier tries 2, 3, 2 (2.3), today 2 → `usual: '2.3'`.
  - fewer-goes not chosen at 2 against 2.04 shown as "2.0" (earlier tries totalling 51 over
    25 rows).
  - solve-number: nothing beaten → `n` = earlier count + 1.
  - null `tries` → null.
- `messageCopy`: the five rows of the table, exactly, including `Your first one-go solve.`
  and `1m 05s quicker` (65s).
- `ordinal`: 1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111 (item 90).
- `streakLine`: play 30 / first-go 1 → `days played`, `oneGoRun` null; play 30 / first-go 2
  → `oneGoRun` 2; play 4 / first-go 4 → `days solved in one`, `oneGoRun` null; play 1 /
  first-go 0 → `day played`; play 1 / first-go 1 → `day solved in one`.

Commit: `feat(results): message rungs, strip days and streak line in player-stats`.

---

## Task 2 — The goes strip, `src/goes-strip.ts`

Items 22, 23, 24, 32, 37, 47, 49, 60, 67, 68, 69, 88.

### API

```ts
import { STRIP_CAP, type StripDay } from './player-stats.ts';

export const CELL_PX = 10;   // item 47
export const GAP_PX = 4;
export const HEAD_PX = 14;   // room above the rows for a broken column's figure (O line 364)
/** The rotated 13px "Goes" label is about 28px long; the rows area is never shorter
 *  than this, so one- and two-row strips do not push the label into the meta row. */
export const MIN_AREA_PX = 32;

/** Rows = the worst day, capped at STRIP_CAP, at least 1 (item 22). */
export function stripRows(days: StripDay[]): number;

/** Height of the rows area: max(rows × CELL + (rows − 1) × GAP, MIN_AREA_PX). */
export function stripAreaPx(rows: number): number;

/** Item 67 as amended by 88; R2. */
export function stripSummary(days: StripDay[]): string;

/** The whole strip, or '' for an empty list. */
export function goesStripHtml(days: StripDay[]): string;
```

### Summary text

`Goes per day, your {N} days played: {parts}. Today: {g}.`

- `N` = `days.length`; `1 day` when 1.
- `parts`: buckets one … five and six-or-more, in that order, zero buckets left out, each
  `{count} in {word}` with words `one`, `two`, `three`, `four`, `five`, `six or more`, joined
  with `, `.
- `g` = the last day's `goes` (today — the strip only renders in full mode, where today's row
  exists). The true figure, so 9 stays 9.

### Markup

```html
<div class="goes-strip" data-goes-strip>
  <span class="goes-strip__y" aria-hidden="true" style="block-size: {areaH}px">Goes</span>
  <div class="goes-strip__col">
    <div class="goes-strip__frame">
      <div class="goes-strip__scroller" data-strip-scroller role="group" tabindex="0"
           aria-label="{summary}">
        <div class="goes-strip__inner" aria-hidden="true" style="block-size: {areaH + GAP_PX + HEAD_PX}px">
          {one column per day}
        </div>
      </div>
    </div>
    <div class="goes-strip__meta" aria-hidden="true">
      <span>{N} days</span><span class="goes-strip__today">Today</span>
    </div>
  </div>
</div>
```

`areaH = stripAreaPx(stripRows(days))`. The inner height adds `GAP_PX + HEAD_PX` because a
broken column is five rows, then the 4px flex gap, then the 14px count: 66 + 4 + 14 = 84px.
Without the gap term the column overflows the track by 4px and the scroller grows a vertical
scroll (O has that bug). `{N} days` is `1 day` at 1 (item 60). The
summary is escaped for an attribute (it contains only digits, letters, commas, colons and
full stops, but escape `&`, `"`, `<` anyway so the builder is safe by construction).

A column, cells in DOM order bottom to top (the column is `flex-direction: column-reverse`):

- `goes <= STRIP_CAP` (`data-strip-day`, `data-goes="{g}"`): `g − 1` ×
  `<span class="goes-strip__cell goes-strip__cell--miss"></span>`, then one
  `<span class="goes-strip__cell goes-strip__cell--hit"></span>`. Unused rows draw nothing.
- `goes > STRIP_CAP` (`data-strip-day`, `data-goes="{g}"`, `data-broken`): 3 miss cells,
  `<span class="goes-strip__elide"><svg class="goes-strip__bolt" aria-hidden="true"><use
  href="/sprites.svg#icon-bolt"/></svg></span>`, 1 hit cell, then
  `<span class="goes-strip__count">{g}</span>` (item 23).

A broken column only occurs when `rows` is 5, so the elided column is always exactly five
rows tall.

### Tests first — `tests/goes-strip.spec.ts` (new)

Parse the returned string with `DOMParser` (jsdom) and query it.

- `stripRows`: worst 3 → 3; worst 9 → 5; one day of 1 → 1; empty → 1.
- `stripAreaPx`: 1 → 32, 2 → 32, 3 → 38, 5 → 66.
- The inner track's `block-size` for a history with a 9-go day is `84px` — at least the
  broken column's 5 × 10 + 4 × 4 + 4 + 14.
- A 3-go day has 2 miss cells, 1 hit cell, in that DOM order, and no bolt or count.
- A 9-go day is broken: 3 misses, the bolt, 1 hit, count text `9`.
- A 6-go day is broken (6 is past the cap); a 5-go day is not.
- Columns come out in the order given (oldest first), and there is one per day.
- `stripSummary` for the brief's example (56/104/48/24/8/3 across 243 days, today 3) returns
  `Goes per day, your 243 days played: 56 in one, 104 in two, 48 in three, 24 in four, 8 in
  five, 3 in six or more. Today: 3.`; a one-day history says `your 1 day played`; zero
  buckets are absent; a 9-go today says `Today: 9.`
- The scroller has `role="group"`, `tabindex="0"` and `aria-label` equal to the summary; the
  inner track, the `Goes` label and the meta row are `aria-hidden="true"`; the scroller
  itself is not (item 88, axe `aria-hidden-focus`).
- `{N} days` / `1 day` in the meta row.
- Empty list → `''`.

Commit: `feat(results): goes strip markup and spoken summary`.

---

## Task 3 — Sprites

Items 40, 66, 86 (sprites test), 90.

`public/sprites.svg`:

- **New `icon-bolt`**: `<symbol id="icon-bolt" viewBox="0 0 8 10" fill="none"
  stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path
  d="M5 0.5 2.5 3.8 5.5 6.2 3 9.5"/></symbol>` (O line 243).
- **`icon-flame`**: ink left edge is x = 5 less half the 2-unit stroke = 4. viewBox
  `4 0 20 24`, add `preserveAspectRatio="xMinYMid meet"`.
- **`icon-podium`**: ink left edge x = 3 − 1 = 2. viewBox `2 0 22 24`, same attribute.
- **New `icon-calendar-head`**: the four shapes of `icon-calendar` copied, viewBox
  `2 0 22 24`, same attribute, same stroke attributes. `icon-calendar` itself unchanged (D8).

Reuse check done for this plan: `icon-flame` and `icon-podium` appear only in panel headings
(`completion.ts`, `time-chart-view.ts:165`); `icon-calendar` also at `src/app.ts:881`, hence
the copy.

### Tests first — `tests/sprites.spec.ts`

Replace `PANEL_ICONS` and the fixed-viewBox assertion with a map of id → expected viewBox:

```ts
const PANEL_ICONS: Record<string, string> = {
  'icon-flame': '4 0 20 24',
  'icon-podium': '2 0 22 24',
  'icon-calendar-head': '2 0 22 24',
  'icon-bolt': '0 0 8 10',
  'icon-trophy': '0 0 24 24',
  'icon-arrow-up': '0 0 24 24',
  'icon-tick': '0 0 24 24',
  'icon-calculator': '0 0 24 24',
  'icon-gamepad': '0 0 24 24',
  'icon-stopwatch': '0 0 24 24',
};
```

Assert each exists, carries exactly its viewBox, and draws in `currentColor`. Add: the three
heading icons carry `preserveAspectRatio="xMinYMid meet"`; `icon-calendar` still has
`viewBox="0 0 24 24"` and no `preserveAspectRatio` (the `/play` button is unchanged).

Commit: `feat(results): bolt and tight heading icons in the sprite sheet`.

---

## Task 4 — The preview-only variant switch

Items 51, 74, 84, 87; D4, R3.

`src/testing-panel.ts`:

```ts
export const STRIP_VARIANTS = ['faded', 'faded-passing', 'hollow', 'dotted'] as const;
export type StripVariant = (typeof STRIP_VARIANTS)[number];
export const DEFAULT_STRIP_VARIANT: StripVariant = 'faded-passing';

/** `?strip=` on a preview host; the default anywhere else or for any other value.
 *  Writes nothing and sends nothing (items 74, 84). */
export function stripVariant(url: URL): StripVariant;
```

- Returns `url.searchParams.get('strip')` when `testingAllowed(url.hostname)` and the value
  is in `STRIP_VARIANTS`; otherwise `DEFAULT_STRIP_VARIANT`.
- The panel gains a heading "Strip misses", a note "Reloads the results page with this
  style.", and one button per variant (`data-testing-strip="{id}"`, labels `Faded`,
  `Faded (passing)`, `Hollow`, `Dotted`). `mark()` sets `aria-pressed` on the one matching
  `stripVariant(new URL(location.href))`. A click does
  `location.assign('/solved?strip=' + id)`.
- The history buttons keep the parameter: `location.assign(h.go + keepStrip(new
  URL(location.href)))`, where the exported pure `keepStrip(url: URL): string` returns
  `?strip={value}` when `url` carries a valid one, else `''`. A history swap mid-comparison
  should not reset the style.

### Tests first — `tests/testing-panel.spec.ts`

- `stripVariant` returns each of the four on `localhost` and on
  `x-clumeral-game.jevawin.workers.dev`.
- It returns `faded-passing` on `clumeral.com` and on `clumeral-game.jevawin.workers.dev`
  (the production deployment) even with `?strip=hollow`, with no parameter, and with
  `?strip=bogus`.
- `keepStrip`: `?strip=dotted` → `'?strip=dotted'`; `?strip=bogus` → `''`; no parameter →
  `''`.
- In the existing `initTestingPanel` describe: the dialog holds four
  `[data-testing-strip]` buttons with the four ids, and with no parameter the
  `faded-passing` one has `aria-pressed="true"` after the panel opens.
- Before and after a strip button click, `localStorage.length` and `sessionStorage.length`
  are unchanged (item 74). jsdom cannot follow `location.assign`, so the click is stubbed
  with `vi.spyOn(window.location, 'assign')` where jsdom allows it; if it does not, the
  navigation itself is covered by the e2e case in Task 8 and this test asserts storage only.

The navigation targets (`/solved?strip=hollow`, and a history swap keeping `?strip=`) are
asserted in `e2e/specs/testing-panel.spec.ts` (Task 8).

Commit: `feat(results): preview-only ?strip= switch for the miss style`.

---

## Task 5 — The panel as cards: `completion.ts`, `index.html`, CSS

Items 5, 14, 15, 16, 19, 25, 27, 34, 35, 44–50, 52–54, 56–59, 61–66, 68–70, 76, 91, 92.

### `index.html`

- Delete the `data-completion-heading` `<h2>` and the `data-completion-subheading` `<p>` and
  their comment (lines 371–373).
- `data-completion-panel`: replace `gap-6` with `gap-[1.125rem]` (O's 18px between cards).
  Keep `w-full flex flex-col text-left`.

### `src/completion.ts`

Remove: `dom.heading`, `dom.subheading`, `STREAK_LINE`, `CHART_LABEL`, `block`, `statLine`,
`statColumn`, `goesChart`, `figure`, `todayFigures`, and the local `plural`. Keep unchanged:
`COMPLETION_OCTO_SVG`, `panelMode`, `formatCountdown`'s maths, `showsTime`, the announcement
machinery (`pendingAnnouncement`, `announced`, `resetCompletionAnnouncement`, the
`screens:enter` listener, `buildAnnouncement`), `RenderCompletionOpts`, `renderCompletion`'s
signature, the time-chart context lines, the links block, the feedback listener, `heroLine`.

Add, at module level:

```ts
import { stripVariant } from './testing-panel.ts';
import { goesStripHtml } from './goes-strip.ts';
// Read once: in-app navigation drops the query (plan D4).
const STRIP_VARIANT = stripVariant(new URL(location.href));
```

Helpers:

- `card(id, heading, iconId, body)` — `heading` is plain text →
  `<section data-stat-block="{id}" class="result-card" aria-labelledby="stat-head-{id}"><h3
  id="stat-head-{id}" class="result-card__head"><svg class="result-card__icon"
  aria-hidden="true"><use href="/sprites.svg#{iconId}"/></svg>{heading}</h3>{body}</section>`
  (items 44, 62, 66).
- `todayCard(puzzleNum, isRandom, tries, seconds, showTime, mode, message)` — the Today card,
  no icon (item 46). Its outer element is
  `<section data-stat-block="today" class="result-card" aria-labelledby="stat-head-today">`,
  holding, in order:
  - `<h2 id="stat-head-today" class="result-card__title" data-completion-heading>{Puzzle
    #238 | Puzzle} <span class="result-card__solved">solved</span></h2>` — one `h2`, one
    line wrapping naturally (items 53, 63, 91).
  - Figure line, omitted when `tries` is not an integer ≥ 1 (marker, item 92):
    `<p class="result-card__figures" data-today-figures>` holding, with a time,
    `<span aria-hidden="true">{n} go|goes, {formatDuration(seconds)}</span><span
    class="sr-only">{n} go|goes, {speakDuration(seconds)}</span>`; without one, the plain text
    `{n} go|goes` (items 16, 54, 65). A time is shown when `showTime && seconds !== null`.
  - Message, full mode only (item 19), when `todayMessage` returns non-null:
    `<p class="result-card__message" data-today-message><span class="result-card__pill"><svg
    class="result-card__msg-icon" aria-hidden="true"><use href="/sprites.svg#{icon}"/></svg></span><span>{pre}<b>{bold}</b>{post}</span></p>`.
    Read in place, never announced (item 64).
  - The random note (`random`) and the new-player note (`new`) as
    `<p class="result-card__note">` with today's wording (item 61).
- `streakCard(stats, history)` — `card('streak', 'Streaks', 'icon-flame', …)`:
  - `<p class="streak__figure" data-streak-figure><span class="streak__n">{figure}</span>
    <span class="streak__label">{label}</span></p>`
  - `<p class="streak__line" data-streak-line>Best streak <b>{best}</b>{oneGoRun !== null ?
    ' · One-go run <b>{oneGoRun}</b>' : ''}</p>` (item 82).
  - `goesStripHtml(goesByDay(history))`.
- `allTimeCard(stats)` — `card('all-time', 'All time', 'icon-calendar-head', …)`, a
  `<dl class="ledger">` of four `<div class="ledger__row" data-ledger-row><dt>{label}</dt><dd>{value}</dd></div>`
  in item 25's order: `Solved in one` → `{firstGoPercent ?? 0}%`; `Best one-go run` →
  `{bestFirstGoStreak}`; `Fastest solve` → `formatDuration(bestTimeSeconds)` (a dash when
  null); `Puzzles solved` → `{plays}` (items 25, 59, 69).

`renderCompletion` body, in order:

1. Octo injection (unchanged).
2. `isArchivedOtherDate`, `history = loadHistory()`, `stats = computePlayerStats(history,
   todayKey())`, `mode`, `seconds` (unchanged, except history is loaded once and reused).
3. Time-chart context (unchanged).
4. If `dom.panel`: `dom.panel.dataset.stripVariant = STRIP_VARIANT`, then build the list:
   - always `todayCard(...)`, with `message = mode === 'full' ? todayMessage(history,
     todayKey(), tries, seconds) : null`;
   - `timeChartSlot()` when `showsChart` (the #368 gate, unchanged; item 15);
   - in `full` only, `streakCard` then `allTimeCard`.
   That gives item 15 per mode: full = Today, leaderboard, Streaks, All time; new = Today with
   the note, leaderboard; saving-off = Today, leaderboard; marker = Today with the heading
   only; random = Today with the random note; archive = Today only.
5. The announcement (unchanged; item 64).
6. Countdown: `formatCountdown` returns `{ lead: 'Next puzzle in ', time: '2h 25m' } | null`;
   written as `textContent` of the lead plus a `<b>` element with the time (built with
   `createElement`, not `innerHTML`) (item 61).
7. Links (unchanged; item 14).

Update the file's header comment and every comment that describes the old blocks.

### `src/tailwind.css` — added in this task

In the completion section, after the `[data-completion-panel]` rule. Every colour is an
existing token (items 45, 50); every text size is rem; cell and gap sizes are px (item 47).

```css
.result-card {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 0.375rem;               /* 6px, item 44 */
  padding: 1.125rem;                     /* 18px */
}
.result-card__title { margin: 0; font-size: 1.1875rem; font-weight: 400; line-height: 1.3; }
.result-card__solved { font-weight: 700; color: var(--color-accent); }
.result-card__head {
  display: flex; align-items: center; gap: 0.5625rem; margin: 0;
  font-size: 1.1875rem; font-weight: 700; line-height: 1.3; color: var(--color-text);
}
.result-card__icon { inline-size: 1.3125rem; block-size: 1.3125rem; flex: none; color: var(--color-accent); }
.result-card__figures {
  margin: 1.125rem 0 0; font-size: 2.125rem; font-weight: 700; line-height: 1.1;
  color: var(--color-accent);
}
.result-card__message { margin: 1rem 0 0; display: flex; align-items: center; gap: 0.5625rem; font-size: 0.9375rem; }
.result-card__pill { display: inline-flex; align-items: center; justify-content: center; flex: none; }
.result-card__msg-icon { inline-size: 0.875rem; block-size: 0.875rem; color: var(--color-accent); }
.result-card__note { margin: 0.75rem 0 0; font-size: 1rem; }
.streak__figure { margin: 1.125rem 0 0; line-height: 1.1; }
.streak__n { font-size: 2.125rem; font-weight: 700; color: var(--color-accent); }
.streak__label { font-size: 1.0625rem; font-weight: 600; }
.streak__line { margin: 0.5rem 0 0; font-size: 0.9375rem; }
.streak__line b { color: var(--color-accent); }
.ledger { margin: 1.25rem 0 0; display: grid; gap: 1rem; font-size: 1rem; }
.ledger__row { display: flex; justify-content: space-between; gap: 1rem; }
.ledger dd { margin: 0; font-weight: 700; color: var(--color-accent); white-space: nowrap; }

/* The goes strip (items 22, 47, 52, 68; plan D6, D7). */
.goes-strip { display: flex; align-items: flex-start; gap: 0.5rem; margin-block-start: 1.25rem; }
.goes-strip__y {
  flex: none; margin-block-start: 14px; writing-mode: vertical-rl; transform: rotate(180deg);
  display: inline-flex; align-items: center; font-size: 0.8125rem; line-height: 1;
}
.goes-strip__col { flex: 1; min-inline-size: 0; }
.goes-strip__frame { border-radius: 2px; }
.goes-strip__scroller {
  direction: rtl; overflow-x: auto; overscroll-behavior-x: contain;
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 40px);
  mask-image: linear-gradient(to right, transparent 0, #000 40px);
}
/* Fallback ring on the scroller itself (masked at the left edge) for an engine
   without :has(); with it, the ring moves to the unmasked frame. */
.goes-strip__scroller:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
@supports selector(:has(*)) {
  .goes-strip__scroller:focus-visible { outline: none; }
  .goes-strip__frame:has(> [data-strip-scroller]:focus-visible) {
    outline: 2px solid var(--color-accent); outline-offset: 3px;
  }
}
@media not all and (pointer: fine) {
  .goes-strip__scroller { scrollbar-width: none; }
  .goes-strip__scroller::-webkit-scrollbar { display: none; }
}
@media (pointer: fine) {
  .goes-strip__scroller { scrollbar-width: thin; }
}
/* padding-inline-start: the 40px fade is fixed to the scroller box, so without it the
   oldest columns would sit under the fade even when scrolled fully left. */
.goes-strip__inner {
  direction: ltr; display: flex; align-items: flex-end; gap: 4px; inline-size: max-content;
  padding-inline-start: 40px;
}
.goes-strip__inner > [data-strip-day] { inline-size: 18px; display: flex; flex-direction: column-reverse; gap: 4px; }
.goes-strip__cell { block-size: 10px; border-radius: 2px; box-sizing: border-box; }
.goes-strip__cell--hit { background: var(--color-accent); }
.goes-strip__elide { block-size: 10px; display: flex; align-items: center; justify-content: center; }
.goes-strip__bolt { inline-size: 8px; block-size: 10px; color: var(--color-accent); }
.goes-strip__count { block-size: 14px; display: flex; align-items: flex-end; justify-content: center; font-size: 0.6875rem; line-height: 1; }
.goes-strip__meta { display: flex; justify-content: space-between; margin-block-start: 0.5rem; font-size: 0.8125rem; }
.goes-strip__today { font-weight: 700; }

/* Miss-cell variants — preview only, the losers go before the PR (items 51, 87; plan D5). */
[data-strip-variant="faded"] .goes-strip__cell--miss {
  background: color-mix(in srgb, var(--color-accent) 22%, var(--color-surface));
}
[data-strip-variant="faded"] .result-card__pill {
  inline-size: 1.625rem; block-size: 1.625rem; border-radius: 9999px;
  background: color-mix(in srgb, var(--color-accent) 22%, var(--color-surface));
}
[data-strip-variant="faded-passing"] .goes-strip__cell--miss { background: var(--chart-dot); }
[data-strip-variant="hollow"] .goes-strip__cell--miss { border: 1.5px solid var(--color-accent); }
[data-strip-variant="dotted"] .goes-strip__cell--miss { border: 1.5px dotted var(--color-accent); }
```

The scroller drops its own ring only inside `@supports selector(:has(*))`, so an engine
without `:has()` keeps a ring. Task 8 asserts the frame's outline on focus. The old
`.stat-*` and `.goes-*` rules stay until Task 7, unused.

### Tests first — `tests/completion-stats.spec.ts` (rewritten), `tests/completion-links.spec.ts`, `tests/time-chart-view.spec.ts`

`setupDOM` in all three drops the heading and subheading elements.

`completion-stats.spec.ts`, rewritten around the new cards (items 76, 15, 14):

- Per mode, `[data-completion-panel] > section` `data-stat-block` values in order:
  full with a time → `today, daily-leaderboard, streak, all-time`; full without a time →
  `today, streak, all-time`; new → `today, daily-leaderboard`; saving-off →
  `today, daily-leaderboard`; marker → `today`; random → `today`; archive → `today`.
- Exactly one `h2` in the panel, `data-completion-heading`, text `Puzzle #238 solved`
  (whitespace-collapsed); random `Puzzle solved`; `solved` is in `.result-card__solved`.
- Figure line: visible text `3 goes, 2m 28s`; sr-only text `3 goes, 2 minutes 28 seconds`;
  `1 go, 0m 41s` for one go; no time → `3 goes`; archive → `3 goes` with no time even when
  seconds are passed; marker → no `[data-today-figures]` at all.
- Message present in full mode with the right copy for a seeded "fastest ever" history;
  absent in new, saving-off, marker, random and archive.
- Streaks: `30 days played`, `Best streak 30` with no one-go part when the run is 1;
  `· One-go run 2` at 2; label `days solved in one` with no one-go part when the runs match.
- Ledger: `dt`/`dd` pairs in order with values `23%`, `3`, `1m 14s`, `30`; never solved in
  one → `0%` and `0`; no valid time → `—`.
- Strip present only in the Streaks card; `data-strip-variant` on the panel is
  `faded-passing` (jsdom's `localhost` with no `?strip=`).
- None of `stat-col`, `stat-col__mark`, `data-goes-row`, `Attempts distribution`,
  `Records`, `Average attempts`, `Avg. time`, `Come back tomorrow`, `You took` in the panel
  HTML (items 26, 27, 76).
- The announcement is unchanged: `Solved in 3. 2 minutes 28 seconds. Play streak 30.` after
  a `screens:enter` for `completion` (item 64).
- Countdown: `Next puzzle in ` followed by a `<b>` holding the time.

Existing describes in `completion-stats.spec.ts` that are kept, not dropped:
- `heroLine` cases — unchanged; `/play` is out of scope (item 11).
- "the announcement (brief 139)" — kept; only DOM setup changes.
- "a forged history row cannot inject markup" — re-pointed at the new panel: a history row
  with `tries: '<img src=x onerror=…>'` or a string `seconds` produces no element in the
  panel, in the strip, in the ledger or in the message (they reach `innerHTML`).
- "the time chart slot" — kept, with `this-game` → `today`.
- "the panel colours itself once, at the top" — kept if `[data-completion-panel] { color:
  var(--color-text) }` stays (it does).
Deleted: the old-block describes inside "the completion panel" that assert boxes, columns,
watermarks, the attempts chart and section accents — replaced by the cases above.

`completion-links.spec.ts` keeps its four cases; only `setupDOM` changes.
`time-chart-view.spec.ts`: only `setupDOM` changes in this task.

Commit: `feat(results): Today, Streaks and All time as cards`.

---

## Task 6 — The leaderboard on the card style

Items 8, 38, 44, 85.

- `src/time-chart-view.ts`: `timeChartSlot()` class `stat-block` → `result-card`; the drawn
  heading's classes `stat-block__head` → `result-card__head` and `stat-block__icon` →
  `result-card__icon` (line 165). Nothing else in the file changes.
- `src/tailwind.css`:
  - `--chart-dot: color-mix(in srgb, var(--color-accent) 72%, var(--color-surface));` and its
    comment updated: the card is now surface, lowest ratio 3.36 (Lime light), item 85.
  - `.time-chart__dot` border `1.5px solid var(--color-surface)`; its comment updated.
  - `[data-time-chart][aria-busy="true"]:empty` `min-block-size`: re-measure. The slot is now
    border-box with 18px padding and a 1.5px border, and the heading shrank from 1.5rem to
    1.1875rem. The content box narrows by 39px (288 → 249 at a 320px viewport, 343 → 304 at
    375), so the longest copy line, "You're in the top 99% of solve times", may now wrap at
    320 and the drawn height may differ by width. The no-shift test
    (`e2e/specs/time-chart.spec.ts:157-172`) runs at 375 and 320 and allows under 1px.
    Method:
    1. Temporarily log `getBoundingClientRect().height` of the drawn `[data-time-chart]` in
       that test's state (the 99%-copy stub) at 320 and 375, in `chromium-desktop` and
       `webkit-desktop`. Remove the logging after.
    2. Write the exact value as `{px}/16` rem to three decimals — no rounding up, which alone
       can add 1.6px of shift.
    3. If 320 and 375 give the same height (within 0.5px across both engines): one rule.
    4. If they differ: two rules — the 375 value as the base, and the 320 value inside
       `@media (max-width: 22.4375rem)` (359px), with both measurements and the date in the
       comment. The test's two widths then each meet their own value.
    5. If Chromium and WebKit differ by 1px or more at the same width, stop and tell Jamie
       before choosing; do not pick one silently.
- Delete the `[data-stat-block="daily-leaderboard"] { --section-accent … }` rule — the icon
  colour now comes from `.result-card__icon`.

### Tests first — `tests/palette-contrast.spec.ts`

In `describe('time chart tokens')`: measure against `surface` instead of `bg` in all three
assertions, update the comment ("the card sits on the surface"), and pin the declaration
`--chart-dot:  color-mix(in srgb, var(--color-accent) 72%, var(--color-surface));`. No new
accent-on-surface case: `palette-contrast.spec.ts:35` already asserts accent on surface at
4.5:1, which covers the hit cell and the hollow and dotted outlines (item 70); the rebased
`--chart-dot` case covers faded-passing. The `faded` variant's 22% tint is not asserted: it
is known to fail and exists only for the comparison (item 51).

`tests/time-chart-view.spec.ts`: the drawn card's class is `result-card` and its heading class
`result-card__head`.

Commit: `feat(results): leaderboard on the card, dot shade rebased onto surface`.

---

## Task 7 — Remove what the page no longer uses

Items 13, 26, 27, 36, 39, 41, 43; D3.

- `src/tailwind.css`: delete `.stat-block__head`, `.stat-block__icon`, the three
  `[data-stat-block="streak|records|all-time"]` accent rules and `.stat-block__icon { color:
  var(--section-accent) }`, `.stat-hero`, `.stat-today`, `.stat-figure*`, `.stat-cols*`,
  `.stat-col*`, `.stat-lines`, `.stat-line*`, `.goes-chart`, `.goes-row*`, and the comments
  that describe them. The `--color-accent-2/3/4` tokens and the per-theme `--accent-2..4-h/c`
  values stay (item 13, #370).
- `src/player-stats.ts`: delete `GOES_BUCKETS`, the `goesDistribution` field and its
  computation.
- Delete `tests/accent-rotation.spec.ts` (its four-accent rule is what this removes, item 41).
- `tests/player-stats.spec.ts`: delete the whole `describe('the goes chart')` block
  (lines 264–286), not only its `goesDistribution` assertion.
- `tests/demo-history.spec.ts` line 50: replace the `goesDistribution` read with
  `goesByDay(demoHistory(TODAY))`, asserting a day of 9 and a day of 6 are present (so the
  demo still shows two broken columns, item 42) and that the archived row is absent.

### Tests first — a new case in `tests/completion-stats.spec.ts`

Read `src/tailwind.css` and assert: no `var(--color-accent-2)`, `var(--color-accent-3)` or
`var(--color-accent-4)` anywhere; no `.stat-col`, `.goes-row`, `--section-accent`. The token
declarations `--color-accent-2:` etc. are still present (item 13, and
`tests/token-parity.spec.ts` keeps passing, item 43).

Commit: `refactor(results): remove the old panel's styles and the goes distribution`.

---

## Task 8 — Playwright e2e

Items 41, 71, 77, 86.

### `e2e/pages/completion.page.ts`

Locators: `heading` = `[data-completion-heading]`; `panel`; `today` =
`[data-stat-block="today"]`; `figures` = `[data-today-figures]`; `message` =
`[data-today-message]`; `leaderboard` = `[data-stat-block="daily-leaderboard"]`; `streak`;
`allTime`; `streakFigure` = `[data-streak-figure]`; `streakLine` = `[data-streak-line]`;
`strip` = `[data-strip-scroller]`; `stripDays` = `[data-strip-day]`;
`ledger(label)` returns the `dd` in the `[data-ledger-row]` whose `dt` has exactly that text;
`cards` = `[data-completion-panel] > section`; plus `live`, `countdown`, `feedbackBtn`,
`links`. Remove `subheading`, `thisGame`, `records`, `average`, `cols`, `allTimeLines`,
`goesRows`, `stat()`.

### Existing specs

- `e2e/specs/completion.spec.ts`: "stats render from seeded history" asserts the three cards
  visible, `ledger('Puzzles solved')` = `3`, `ledger('Solved in one')` = `0%`, streak figure
  `3`; no `records`, no `Average attempts`.
- `e2e/specs/player-stats.spec.ts`: every `stat-col`, `Records`, `Attempts distribution`,
  `Average attempts` and `You took` assertion moves to the ledger, the streak card or the
  heading text, or is deleted where item 27 cuts the figure. The cases' intent (archive
  excluded, recency gate, saving-off) stays.
- `e2e/specs/game-solve.spec.ts`, `a11y.spec.ts`, `random.spec.ts`, `time-chart.spec.ts`:
  `[data-completion-heading]` still resolves (D10). Any text assertion on it changes to
  `Puzzle #N solved` / `Puzzle solved`.
- `e2e/specs/time-chart.spec.ts` lines 271–273: `this-game` → `today`.
- `e2e/specs/testing-panel.spec.ts` line 61: unchanged selector (`streak`); add two cases —
  a "Strip misses" button navigates to `/solved?strip=hollow` and the panel then carries
  `data-strip-variant="hollow"`; from `/solved?strip=dotted`, the "Rich history" button lands
  on `/solved?strip=dotted`.
- `e2e/specs/archive.spec.ts`, `undo-reset.spec.ts`: no old selector found in them at plan
  time (grep 2026-11-15); they run unchanged in the full suite.

### `e2e/specs/a11y.spec.ts`

The existing light/dark loop gets a `/solved` full-mode case if it has none: seed 40 days
ending today including a 9-go day, freeze the date, open `/solved`, wait for the completion
screen, run axe with the shared `LABEL_IN_NAME_*` list unchanged (item 71). Run once per
variant via `?strip=` so all four are scanned while they exist (Task 11 removes the loop).

### New `e2e/specs/results-page.spec.ts`

Frozen `TODAY`; seeded 40 consecutive days ending today, times on every row, one day of 9
goes ten days back, today 3 goes in 148s; `seedPrefs` saving on. The leaderboard field is
stubbed with a `page.route('**/api/times/**')` fulfilling a fixed 20-row field — move the
existing `stubField` helper out of `e2e/specs/time-chart.spec.ts` into
`e2e/helpers/time-field.ts` and import it in both specs — so the card always draws.

- Card order: `cards` `data-stat-block` sequence is exactly `today, daily-leaderboard,
  streak, all-time`.
- Ledger values match the seeded history (computed in the spec from the same array).
- The strip opens at today: the last `[data-strip-day]`'s bounding box right edge is within
  the scroller's box, and the first day's is not (40 columns at 22px exceed the card).
- A broken column: the day with `data-goes="9"` has `data-broken` and its count reads `9`.
- No vertical scroll: the scroller's `scrollHeight === clientHeight` (+ its horizontal
  scrollbar height on fine pointers: compare `offsetHeight - clientHeight` instead of
  assuming 0).
- The fade never hides the oldest day: after `scroller.scrollLeft = -scroller.scrollWidth`
  (scrolls fully left in an rtl box), the first `[data-strip-day]`'s left edge is at least
  40px inside the scroller's left edge.
- Short strips: with a seeded history whose worst day is 1 go, and again with 2, the `Goes`
  label's bounding box bottom is at or above the meta row's top.
- Keyboard (projects `chromium-desktop`, `mobile-chromium`, `webkit-desktop`; skipped
  elsewhere with `test.skip` and the reason): press Tab until `document.activeElement`
  matches `[data-strip-scroller]` (at most 20 presses, then fail), press `ArrowLeft` five
  times, and `Math.abs(scrollLeft)` has grown; the frame's computed `outline-style` is
  `solid` while focused. If `webkit-desktop` does not scroll on arrows, drop it from the
  list and say so in the test comment — the summary and the scrollbar remain.
- Modes: `/random` solve → only `today`, random note visible; a 2-game history → `today`
  plus the new-player note and no `streak`.
- Archive mode (item 77). An archive solve never reaches `/solved` (`src/app.ts:1139-1143`);
  the archive panel is pre-rendered into the hidden completion screen when an already-solved
  past date opens (`src/app.ts:1016`). So: seed today solved plus a solved past date
  (`archived: true`), open `/archive/{past date}`, wait for the solved-replay view, and
  assert `[data-completion-panel] > section` has count 1 with `data-stat-block="today"` and
  no `[data-strip-scroller]`, using `toHaveCount` / `toHaveAttribute` (the screen is hidden,
  so not `toBeVisible`).
- Item 52 (projects `chromium-desktop` and `mobile-chromium` only; `test.skip` on every
  other project): on `chromium-desktop` the scroller's computed `scrollbar-width` is `thin`;
  on `mobile-chromium` it is `none`.

Commit: `test(results): e2e for the card layout and the goes strip`.

Then push the branch so the preview builds (`<branch>-clumeral-game.jevawin.workers.dev`) —
Jamie needs it for the pick (item 51).

---

## Task 9 — Docs

- `docs/ARCHITECTURE.md` file list: add `goes-strip.ts — Results goes strip: markup and the
  spoken summary (pure)`.
- `docs/DESIGN-SYSTEM.md`: replace whatever it says about the completion panel's sections,
  accents and boxes with the card, ledger and strip rules; note the one-accent rule (item 45)
  and that `--chart-dot` now mixes into `--color-surface`.
- Comments in `src/tailwind.css` near the `--color-accent-2/3/4` tokens: say they are unused
  since this change and point at #370.
- `docs/INVARIANTS.md`: update the test counts it cites under P1 (`tests/player-stats.spec.ts
  (33)` and any other file this change grows or shrinks) to the counts after Task 7, and add
  `tests/goes-strip.spec.ts` if P1's guard list names the player-facing stats files.

Commit: `docs(results): card layout, strip and dot base`.

---

## Task 10 — Verify on the production build and ask for the pick

Items 78, 79, 80.

1. `npm test` — all files pass. Check the **file count** (it moves by +1 for
   `goes-strip.spec.ts`, −1 for `accent-rotation.spec.ts`, so stays 41), not the test count.
2. Full Playwright suite on the production build, all engines: `npm run test:e2e`. Read the
   tail, not the exit code; count passes per project; Firefox reports skipped locally
   (memory). Make sure port 4173 is free first.
3. Push. Send Jamie the preview URL with the four `?strip=` links and a one-line description
   of each, and ask for the pick (and, if under 3:1, his recorded call — item 51).

No build work proceeds past this until Jamie picks.

---

## Task 11 — Remove the losing variants and the switch

Items 51, 80, 84. Runs after Jamie's pick.

- `src/tailwind.css`: the picked variant's miss rule becomes the plain
  `.goes-strip__cell--miss` rule without the attribute selector; the other three rules go.
  If **faded** is picked: its 22% mix becomes a token beside `--chart-dot` named
  `--strip-miss` (12 of 15), the pill rule stays unscoped, the miss cells and the pill read
  it, and `tests/palette-contrast.spec.ts` pins the declaration. If anything else is picked:
  the pill rule goes and `.result-card__pill` has no fill (R4).
- `src/testing-panel.ts`: delete `STRIP_VARIANTS`, `StripVariant`, `DEFAULT_STRIP_VARIANT`,
  `stripVariant`, the "Strip misses" group and `keepStrip`.
- `src/completion.ts`: delete `STRIP_VARIANT`, its import and the `dataset.stripVariant`
  line.
- Tests: delete the `stripVariant` cases and the testing-panel e2e strip case; the a11y
  variant loop scans the one style.
- Brief: record the pick under item 51 (and the 1.4.11 call if Jamie makes one).

Tests first: `completion-stats.spec.ts` asserts the panel has no `data-strip-variant`
attribute and `src/tailwind.css` contains no `data-strip-variant`.

Re-run `npm test` and the full e2e suite (as Task 10). Commit:
`refactor(results): keep the {pick} miss style, remove the preview switch`.

Then the gates: human review, `da-build`, self-review, PR into `staging` (item 80).

---

## Traceability

| Items | Where |
|---|---|
| 1–4 | context; no code |
| 5 | Task 5 (nothing reverted; every figure kept unless cut by name) |
| 6, 7 | no code (Share is #148; no placeholder buttons — none are built) |
| 8 | Task 6 |
| 9, 10, 11, 12 | no code (out of scope; no worker, storage or `/play` edit) |
| 13 | Task 7 (rules removed, tokens kept), Task 9 (comment) |
| 14, 15 | Task 5 |
| 16 | Task 5 (as amended by 92) |
| 17, 18 | Task 1 (as amended by 81, 83) |
| 19 | Task 5 (`mode === 'full'` gate) |
| 20, 21 | Task 1 `streakLine` (as amended by 82), Task 5 |
| 22, 23 | Task 1 `goesByDay`, Task 2 |
| 24 | Task 1 (`goesByDay` has no entry for a missed day) |
| 25 | Task 5 ledger |
| 26, 27 | Task 5 (not rendered), Task 7 (removed) |
| 28, 29 | no code (§4 override recorded in the brief) |
| 30, 33 | no code (nothing stored, no URL change outside the preview switch) |
| 31 | Task 1 (before-today baselines) |
| 32 | Task 2 / D6 |
| 34, 35 | Task 5 |
| 36 | Tasks 1, 7 / D2, D3 |
| 37 | Task 2 / D1 |
| 38 | Task 6 |
| 39 | Tasks 5, 7 |
| 40 | Task 3 / D8 |
| 41 | Tasks 5–8 |
| 42 | no code (demo already has 9- and 6-go days; Task 7 asserts it) |
| 43 | Task 7 |
| 44–49 | Task 5 CSS |
| 50 | no code (tokens only) |
| 51 | Tasks 4, 5, 10, 11 |
| 52 | Task 5 CSS, Task 8 |
| 53, 54 | Task 5 |
| 55 | Task 1 (as amended by 89, 90; R1) |
| 56, 57 | Task 1 (as amended by 82) |
| 58 | Task 5 (headings), Task 6 (leaderboard unchanged) |
| 59 | Task 5 |
| 60 | Task 2 |
| 61 | Task 5 (notes, countdown bold) |
| 62–66 | Task 5 |
| 67, 68, 69 | Task 2 (as amended by 88), Task 5 CSS, Task 8 |
| 70 | Task 6 test |
| 71 | Task 8 a11y |
| 72, 73 | no code (no events) |
| 74 | Task 4 test (no storage write, nothing sent) |
| 75 | Tasks 1, 2 |
| 76 | Task 5 |
| 77 | Task 8 |
| 78, 79 | Task 10 |
| 80 | Tasks 10, 11 |
| 81, 82, 83 | Task 1 |
| 84 | Task 4 / D4 |
| 85 | Task 6 |
| 86 | Tasks 3, 7, 8 |
| 87 | Tasks 4, 5 |
| 88 | Task 2 |
| 89, 90 | Task 1 |
| 91, 92 | Task 5 |

## Sequencing

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → (Jamie picks) → 11 → gates. Tasks 1–4 are additive
and leave the old panel working. Task 5 switches the panel over, Task 6 depends on Task 5's
card CSS, Task 7 removes only what Task 5 stopped using. Each task ends on `npm test` (unit)
green and commits on its own. **The e2e suite is expected red from Task 5 until Task 8**,
because the old page object and specs still look for the old panel; nothing is pushed
before Task 8 ends with e2e green.

Task 1 does not start until Jamie has answered R1 and R7 and the answers are in the brief.

## Revision log

- **Revision 1, 2026-11-15** — first draft from the closed brief.
- **Revision 2, 2026-11-15** — `da-plan` on revision 1: 1 High, 7 Medium, 14 Low. All checked
  against the code; all held. Fixed:
  - H1 reserved leaderboard height: measured at 320 and 375 in two engines, exact value,
    width-keyed rule if the heights differ (Task 6).
  - M2 the "quicker" test case picked a history where "fastest" wins; new values (Task 1).
  - M3 broken column 4px taller than the track; inner height adds `GAP_PX` (Task 2).
  - M4 rotated "Goes" label overflowed one- and two-row strips; `MIN_AREA_PX` (Task 2).
  - M5 the fade hid the oldest days at full scroll; 40px start padding (Task 5, e2e).
  - M6 existing completion-stats describes listed as kept or re-pointed (Task 5).
  - M7 archive mode e2e now uses the real pre-render path (Task 8).
  - M8 R1 is a copy decision, not a reading; it blocks Task 1 and goes to Jamie and the brief.
  - Lows fixed: R6 octo premise was false (dead code, raised, not built); keyboard test focus
    and projects; item 52 project skip; deterministic card order via a shared field stub;
    `data-*` hooks for ledger and streak; duplicate contrast case dropped; `:has()` fallback
    ring; short strips hug the right edge on purpose (R6 new); whole goes-chart describe
    deleted; `card()` parameter name and Today `section` written out; 0s times raised as R7
    (blocks Task 1); `earlier` uses `goesByDay`'s filter; e2e red from Task 5 to 8 stated;
    INVARIANTS counts added to Task 9.
