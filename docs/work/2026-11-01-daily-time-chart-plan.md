# Plan — Results screen: today's solve-time chart

**Date:** 2026-11-01
**Branch:** `dev/daily-time-chart`. PR into `staging` (docs/GIT-WORKFLOW.md), never `main`.
**Brief:** [2026-11-01-daily-time-chart-brief.md](2026-11-01-daily-time-chart-brief.md) — closed.
Gates met: no `Ack: pending`; `da-brief` recorded with fixes in items 90–102; boards exported
(103–108); plan-stage questions answered by Jamie (109, 110); second `da-brief` (Fable)
recorded with fixes in items 111–121, signed and acked.
**Revision 2, 2026-11-01** — revised for items 111–121 before any `da-plan` ran.
**Revision 3, 2026-11-01** — `da-plan` on revision 2 found 2 High, 4 Medium and 8 Low. All
were checked against the code and all held. Every one is fixed here; the two that needed a
product answer went to Jamie as brief items 122 and 123. See the revision log at the end.
**Revision 4, 2026-11-01** — second `da-plan`, on revision 3: 2 Medium, 7 Low, no High. All
fixed here; none needed a product answer.
**Approval:** Jamie, 2026-11-01, on revision 4. Build may start.
**da-plan:** run twice — on revision 2 (2 High, 4 Medium, 8 Low; fixed in revision 3) and on
revision 3 (2 Medium, 7 Low; fixed in revision 4).

Read the brief's "da-brief fixes", "Boards export", "Plan-stage questions" and "Fable da-brief
fixes" sections first, then "Plan-stage questions, second round" (122, 123). Later sections
win over earlier ones and over the body. Item numbers below are brief item numbers.

---

## Decisions this plan makes (how, not what)

Each is an implementation choice inside a settled item. None changes observable behaviour the
brief settled.

- **D1. Route:** `GET /api/times/:num`. Response `{ "times": [{ "second": 41, "count": 1 }, …] }`,
  ascending by second (items 35, 37, 42).
- **D2. The uid travels in a request header, `X-Clumeral-Uid`, not the query string.** It keeps
  the uid out of URLs, which end up in logs and history. The server truncates it to `MAX_UID`
  exactly as `recordEvent` does, so a long uid still matches its stored row (items 91, 110,
  118).
- **D3. Column name `puzzle_num`, `INTEGER`, nullable, no index.** Item 95's `ts` window already
  narrows the scan to a slice of the `(hostname, event, ts)` index.
- **D4. Two modules.** `src/time-chart.ts` is pure: maths, copy, layout arithmetic, the spoken
  sentence. No DOM, no fetch (item 39). `src/time-chart-view.ts` owns the slot, the fetch, the
  DOM and the measuring. It follows the precedent of `completion.ts` and `welcome.ts`, which
  already render their own screens outside `app.ts`.
- **D5. Analytics from the view goes through the existing `analytics:track` CustomEvent bridge**
  (`src/app.ts:1608`), as the router does. The view never imports `app.ts`.
- **D6. The uid reaches the view once,** through `initTimeChart({ uid })` called in `app.ts`
  beside `initWelcome()`. The view does not read `localStorage` itself, and `storage.ts` is not
  touched (item 44).
- **D7. Fetch timeout 5 seconds,** via `AbortController` and `setTimeout`. A timeout counts as
  failure: the slot collapses and `time_chart` is sent with source `failed` (items 23, 77).
  Without a timeout a hung request would leave the reserved gap open forever (item 54).
- **D8. Stale responses are dropped.** Each visit increments a counter. A response is drawn only
  if its counter is still current, so a slow first visit cannot overwrite a second one.
- **D9. On a revisit, the old drawing stays while the new fetch runs,** with `aria-busy="true"`.
  The new drawing replaces it; a failure collapses the slot. This avoids a blank flash on every
  in-app return (items 25, 54, 68).
- **D10. Layout is in px from measured widths, and is re-run by a `ResizeObserver` on the track.**
  The track height is in rem, so text zoom changes the track's size and fires the observer, as
  does any width change (items 50, 52, 69, 96).
- **D11. Vertical metrics convert from the board's px to rem** (÷16) so labels and their rows
  grow together at 200% text (item 69). Dot sizes and line weights stay px: they are not text.
- **D12. The board's width slack goes: `youW * 1.05` and the `+3` in `width()`** (item 115).
  Every label is measured, your own in bold.
- **D13. The axis note** sits on the second row of its top corner (item 123), with its 14px
  leader. When the far corner would touch your label, it drops to the bottom caption instead,
  centred, with no leader (item 122). Both are settled in the brief; this plan only
  implements them.
- **D14. Dots get a 1.5px border in `--color-bg`,** not the board's `--surface`, since the card
  sits on the page background (item 97). It separates touching dots.
- **D15. Heading icon:** a new `icon-podium` symbol in `public/sprites.svg`, from the Idea-O
  heading path `M9 11h6v9H9zM3 15h6v5H3zM15 7h6v13h-6z`, on `viewBox="0 0 24 24"` with
  `stroke-width="2"` and `stroke-linecap="round"`. That matches `icon-trophy`
  (`public/sprites.svg:248`) and the rule `tests/sprites.spec.ts:28` enforces for every panel
  icon. Cropping viewBoxes across the whole sheet (the canvas note) is out of scope. The icon
  takes `--color-accent`, the player's own colour (item 49).
- **D16. Defensive parsing of the response.** The client keeps only rows whose `second` is an
  integer 0–86400 and whose `count` is a positive integer, and treats a non-array `times` as a
  failure. The server already drops rows outside 1–86400 (item 116); this guards the pure
  module from malformed JSON, and a 0 that got through is still floored for placement
  (item 21's client guard).
- **D18. The two chart tokens are declared outside `@theme`,** in a plain `:root` rule in
  `src/tailwind.css`, as `--chart-dot` and `--chart-line`. `tests/token-parity.spec.ts`
  requires every `--color-*` in `@theme` to be mirrored in the Worker's `/archive` page
  (`src/worker/puzzles.ts`), which never shows the chart. Declaring them in `@theme` would
  mean editing a Worker SSR page for nothing. They are still the two `color-mix` tokens of
  item 64. Dark mode re-resolves them because `:root` and the `html.dark` override are the
  same element.
- **D17. Percentile arithmetic is integer-first, then capped:**
  `Math.min(99, Math.ceil((100 * (faster + 1)) / n))` (items 28, 111).
  `Math.ceil((faster + 1) / n * 100)` gives 71 for 7 of 10, because `0.7 * 100` is
  `70.00000000000001`.

---

## File map

Create:
- `migrations/analytics/0008_add_puzzle_num.sql`
- `src/time-chart.ts` — pure
- `src/time-chart-view.ts` — DOM, fetch
- `tests/time-chart.spec.ts` — unit, jsdom project, pure module
- `tests/time-chart-view.spec.ts` — unit, jsdom project, slot and fetch behaviour
- `tests/worker/times-route.spec.ts` — worker project
- `e2e/specs/time-chart.spec.ts`

Modify:
- `src/worker/analytics-db.ts` — `recordEvent` writes `puzzle_num`; new `getTodayTimes`
- `src/worker/index.ts` — `/api/event` passes `puzzleNum`; new route; `time_chart` in `VALID_EVENTS`
- `src/app.ts` — `track()` gains `puzzleNum`; the `puzzle_time` call passes it; `initTimeChart`
- `package.json` — `e2e:db:analytics` applies 0008 (the local e2e database lists migrations
  by name)
- `tests/project-guard.ts` — file counts: jsdom 37 → 39, workers 4 → 5
- `src/completion.ts` — reserve the slot; set the chart context; call the view on `screens:enter`
- `src/player-stats.ts` — `formatDuration` gains `{ compact: true }`
- `src/tailwind.css` — two tokens (outside `@theme`, D18), card CSS, section accent
- `public/sprites.svg` — `icon-podium`
- `tests/worker/analytics-db.spec.ts`, `tests/worker/schema.spec.ts`, `tests/worker-guard.spec.ts`,
  `tests/player-stats.spec.ts`, `tests/palette-contrast.spec.ts`, `tests/completion-stats.spec.ts`,
  `tests/sprites.spec.ts`
- `e2e/helpers/console.ts` — a per-test `allowUrl` on the guard (Task 8)
- Docs: `docs/ANALYTICS.md`, `docs/ARCHITECTURE.md`, `docs/CONSIDERATIONS.md`,
  `docs/INVARIANTS.md`, `CLAUDE.md`

Untouched, and checked in Task 10 (item 44): `src/worker/puzzle.ts` (imported for `puzzleDate`
only, already exported), the generator, `/api/guess`, tokens, `PUZZLES` KV, `src/storage.ts`
and every `dlng_` key, `src/play-timer.ts`, `public/sw.js`.

---

## Task 1 — Store the puzzle number on `puzzle_time`

Implements 24, 29, 41, 43, 45, 79 (recordEvent and migration lines). Commit:
`feat(analytics): store puzzle_num on events (migration 0008)`.

**Tests first** — `tests/worker/analytics-db.spec.ts`, in `describe('recordEvent')`:
- `stores a positive integer puzzleNum in puzzle_num` — `puzzleNum: 238` reads back `238`.
- `stores NULL for a junk puzzleNum` — `it.each` over `'238'` (string), `-1`, `0`, `2.5`,
  `undefined`, `NaN`, `1e300`: each reads back `null`.
- `old clients without puzzleNum still record` — an event with no `puzzleNum` key inserts and
  reads back `puzzle_num` `null` (item 45).

`tests/worker/harness.spec.ts` already proves migrations apply to an isolated D1; it now also
applies 0008. Run `npm run lint:migrations` (item 79).

`package.json`: append `&& wrangler d1 execute clumeral-analytics --local
--file=migrations/analytics/0008_add_puzzle_num.sql` to `e2e:db:analytics`, after 0007 and
before the seed file. Without it, every local `recordEvent` INSERT fails silently and every
real `/api/times/N` returns 500 on the e2e preview. That trips the console guard in every spec
that reaches `/solved` unstubbed: completion, a11y, player-stats and game-solve.

**Implementation:**
1. `migrations/analytics/0008_add_puzzle_num.sql`, with a header comment in the style of 0007
   (why it exists, why nullable: rows before it and old PWA builds have no number):
   ```sql
   ALTER TABLE analytics_events ADD COLUMN puzzle_num INTEGER;
   ```
2. `AnalyticsEvent` gains `puzzleNum?: unknown` (the body is cast, never validated).
3. `recordEvent` adds `puzzle_num` to the column list and binds
   `Number.isSafeInteger(e.puzzleNum) && (e.puzzleNum as number) > 0 ? e.puzzleNum : null`.
   Comment why: the body is unvalidated JSON, and a string `'238'` must not be coerced, since
   the read filters on the exact number.
4. `src/worker/index.ts` `/api/event`: add `puzzleNum?: unknown` to the body type, destructure
   it, pass `puzzleNum` to `recordEvent`. The `writeDataPoint` call is unchanged (item 41).

The backfill (`src/worker/backfill.ts`) names its columns explicitly, so a new nullable column
does not affect it. Its spec must still pass unchanged — that is the check.

---

## Task 2 — The read: `getTodayTimes` and `GET /api/times/:num`

Implements 7, 8, 15, 21 (server drop), 32, 33, 34, 35, 37, 42, 45, 75, 79, 91, 95, 99
(`VALID_EVENTS` comment), 116, 117, 118, 120. Commit: `feat(worker): read-only route for today's solve times`.

**Tests first.**

`tests/worker/analytics-db.spec.ts`, new `describe('getTodayTimes')`. Seed helper inserts
`puzzle_time` rows with `ts`, `uid`, `hostname`, `value`, `puzzle_num`, `sample_interval`.
`DAY = Date.parse('2026-11-01T00:00:00Z')`. The seeded rows are puzzle 239: 2026-11-01 is
puzzle 239 counting from `EPOCH_DATE` 2026-03-08. Tests derive it with
`puzzleNumber('2026-11-01')` rather than hard-coding it.
- groups by second and sums `sample_interval`: three rows on 69 → `{ second: 69, count: 3 }`;
  one row on 69 with interval 2 → count 2.
- returns ascending by second.
- filters by hostname: a row on `preview.workers.dev` is absent from a `clumeral.com` read.
- filters by puzzle number: a row for 238 is absent; a row with `puzzle_num` NULL is absent.
- filters by event: a `puzzle_complete` row with `puzzle_num` 239 is absent.
- drops values outside 1–86400 (item 116): `-5`, `0` and `86401` absent; `1` and `86400`
  present. The `0` case is the one that matters: `recordEvent` writes 0 for any non-finite
  value, so every junk POST is a 0s row.
- applies the window, bounds inclusive (item 117): rows at exactly `DAY - 14h` and
  `DAY + 38h` present; `DAY - 14h - 1` and `DAY + 38h + 1` absent.
- excludes the caller's uid (item 91 inputs): your row present → not returned; absent → no
  change; present twice (two tabs) → neither returned; a stranger on your exact second →
  still counted.
- `excludeUid` `''` excludes nothing (the saving-off case; stored uids are never empty).

`tests/worker/schema.spec.ts`: `uses an index for the today-times query` — the exact SQL
`getTodayTimes` runs, under `EXPLAIN QUERY PLAN`, contains `idx_analytics_host_ev_ts` and not
`SCAN analytics_events` (item 95). Export the SQL string from `analytics-db.ts` as
`TODAY_TIMES_SQL` so the test cannot drift from the real query (the comment at the top of
that spec explains why an approximation is worthless).

`tests/worker/times-route.spec.ts` — calls `worker.fetch(new Request(url, init), env, ctx)`
with `import worker from '../../src/worker/index.ts'` and `env` from `cloudflare:test`, as
`backfill.spec.ts` imports it (that spec calls `scheduled`; this one calls `fetch`). `ctx` is
`{ waitUntil() {}, passThroughOnException() {} }`. The env passed is
`{ ...env, ASSETS: { fetch: vi.fn(async () => new Response('asset')) } }`, because the
workers test env binds only `ANALYTICS_DB`, and a request that falls through reaches
`env.ASSETS.fetch`.
- the response body's key set is exactly `['times']`, and every element's key set is exactly
  `['count', 'second']` — so a future uid, timestamp or source fails it (item 37).
- `Cache-Control` is `no-store`; `Content-Type` is `application/json`.
- the `X-Clumeral-Uid` header excludes that uid's rows; no header excludes nothing.
- an over-long header uid is truncated to `MAX_UID` and still excludes a row stored from the
  same over-long uid.
- the hostname comes from the request URL: seed rows for `clumeral.com` and `a.workers.dev`,
  request each, get only its own.
- `/api/times/0` → 400; a far-future number → 400; a past number with rows → 200 with those
  rows (item 33).
- `/api/times/abc` and a POST to `/api/times/239` are not served by this route. Each reaches
  the `ASSETS` stub (assert it was called) instead of returning JSON.

`tests/project-guard.ts`: workers 4 → 5, in this task's commit, so `npm test` stays green.

`tests/worker-guard.spec.ts`: `accepts the time-chart event` — `VALID_EVENTS.has('time_chart')`.
`tests/worker/analytics-db.spec.ts`: `accepts all eleven documented events` becomes twelve,
and also asserts `time_chart`.

**Implementation** — `src/worker/analytics-db.ts`:
```ts
export const TODAY_TIMES_SQL =
  `SELECT value AS second, SUM(sample_interval) AS count
     FROM analytics_events
    WHERE hostname = ? AND event = 'puzzle_time'
      AND ts BETWEEN ? AND ?
      AND puzzle_num = ?
      AND uid <> ?
      AND value BETWEEN 1 AND 86400
    GROUP BY value
    ORDER BY value`;

const ZONE_SLACK_MS = 14 * 3_600_000;

export async function getTodayTimes(
  db: D1Database,
  q: { hostname: string; puzzleNum: number; dayStartMs: number; excludeUid: string },
): Promise<{ second: number; count: number }[]>
```
Binds `hostname, dayStartMs - ZONE_SLACK_MS, dayStartMs + DAY_MS + ZONE_SLACK_MS, puzzleNum,
excludeUid`. Both `ts` bounds inclusive (item 117). The comment states why the value floor is
1, not 0, as `getStats`' mean comment explains its own `BETWEEN` (item 116), and that rows
outside the range are dropped, never clamped.

Maps rows to `{ second: Number(r.second), count: Number(r.count) }` — building
new objects, never passing D1 rows through, so no column can leak into the response
(item 37). Comment carries item 37 as a hard rule and item 95's reasoning.

`src/worker/index.ts`, after the `/api/puzzle/:num/solution` block:
```ts
// GET /api/times/:num — every solve time recorded for a puzzle number, as
// (second, count) pairs. Read by the results card. Never returns a uid, a
// timestamp or anything but a time and its count (brief item 37).
const timesByNum = url.pathname.match(/^\/api\/times\/(\d+)$/);
if (request.method === 'GET' && timesByNum) { … }
```
- `num < 1` → `json({ error: 'Invalid puzzle number' }, 400, { 'Cache-Control': 'no-store' })`.
- `date = puzzleDate(num)`; `isFuturePuzzleDate(date)` → same 400. This also rejects the
  malformed date a huge number produces.
- `excludeUid = (request.headers.get('X-Clumeral-Uid') ?? '').slice(0, MAX_UID)` — import
  `MAX_UID` from `analytics-db.ts`.
- `dayStartMs = Date.parse(date + 'T00:00:00Z')`.
- Success → `json({ times }, 200, { 'Cache-Control': 'no-store' })`. A thrown D1 error →
  `json({ error: 'Times unavailable' }, 500, { 'Cache-Control': 'no-store' })`, logged with
  `console.error` like the event route.

`VALID_EVENTS` gains, with a comment:
```ts
// The results card (brief item 77). Source 'drawn' or 'failed', value the field
// size n (0 on failure). Sent once per /solved visit that should show the card.
'time_chart',
```
and the `puzzle_time` comment's "No migration: the existing table already holds…" line is
replaced: `puzzle_num` (migration 0008) carries the puzzle number, written by this event only
(item 99).

The route sits under `/api/`, which `public/sw.js:53` already sends network-only (item 42). No
change to the service worker.

---

## Task 3 — Send the puzzle number with `puzzle_time`

Implements 12, 24, 40, 74. Commit: `feat(analytics): send the puzzle number with puzzle_time`.

**Test first** — `e2e/specs/time-chart.spec.ts`, the first test of the file (the rest arrive
in Task 8): `puzzle_time carries the puzzle number`. It runs on **real time, with no
`freezeDate` and no `page.clock`**, as `e2e/specs/player-stats.spec.ts:7–19` explains:
`readAnswer` (`e2e/helpers/solve.ts:9`) serves today's real answer, so a frozen other day
loads the wrong puzzle, and the fake clock leaves clicks hanging during a solve.
`e2e/specs/game-solve.spec.ts` solves the same way. Solve with `solvePuzzle`, capture the
`POST /api/event` request whose JSON `event` is `puzzle_time` via `page.waitForRequest`, and
assert `puzzleNum` equals the number for the **browser's local date** (the client keys the
puzzle day on `todayKey`, not UTC). Read that date in the page with
`page.evaluate(() => new Date().toLocaleDateString('en-CA'))`, then compute whole days from
2026-03-08, plus one. Also assert the `puzzle_complete` body has no `puzzleNum`
key (item 40: no other event changes). `app.ts` has no unit harness; this is the test that can
fail.

**Implementation** — `src/app.ts`:
- `function track(event: string, value?: number, source?: string, puzzleNum?: number)`; the body
  becomes `{ event, uid: analyticsUid, value, newUser: isNewUser, source, puzzleNum }`.
  `JSON.stringify` drops an `undefined` key, so every other event's body is byte-identical.
- `src/app.ts:1131` becomes
  `if (countedSeconds !== null) track("puzzle_time", countedSeconds, timer.idleLabel(), gameState.puzzleNum ?? undefined);`
- Nothing else in the timer path changes (item 12).

---

## Task 4 — Compact durations

Implements 63, 78 (formatDuration line), 115 (hour branch), 120. Commit: `feat(stats): compact formatDuration for chart labels`.

**Tests first** — `tests/player-stats.spec.ts`, beside the existing `formatDuration` cases:
- `compact drops the zero minutes`: `formatDuration(41, { compact: true })` → `'41s'`;
  `0` → `'0s'`; `59` → `'59s'`.
- `compact matches the default from a minute up`: `60` → `'1m 00s'`, `69` → `'1m 09s'`,
  `892` → `'14m 52s'`, `3600` → `'1h 00m'`, `3840` → `'1h 04m'` (115).
- `the default is unchanged`: the existing `221` → `'3m 41s'` and `48` → `'0m 48s'` cases stay,
  plus `formatDuration(null, { compact: true })` → `'—'`.

**Implementation** — `formatDuration(seconds: number | null, opts: { compact?: boolean } = {})`;
after the existing `null` check (so `formatDuration(null, { compact: true })` still returns
`'—'`; in JS `null < 60` is true), when `opts.compact && seconds < 60` return
`` `${seconds}s` ``. JSDoc says what compact is for
and that only the chart's own labels use it (item 63).

---

## Task 5 — The pure module, `src/time-chart.ts`

Implements 17, 18, 19, 21, 28, 39, 47, 48, 55, 56, 59, 60, 61, 71, 78, 85, 86, 87, 88, 90, 91,
94, 100, 101, 104, 105 (rank, percentile, copy lines), 106, 109, 111, 113, 115, 116 (client
guard), 120.
Commit: `feat(results): time chart maths, copy and layout (pure)`.

Ported from Idea-O lines 403–575 (item 104), with every item 105 and item 115 divergence
changed. The port
keeps the board's explanatory comments where they still describe the code, trimmed to fit.

### API

```ts
import { formatDuration, speakDuration } from './player-stats.ts';

export interface FieldRow { second: number; count: number }

export interface Field {
  /** Every time in the field including yours, ascending, whole seconds. */
  sorted: number[];
  /** second → how many players finished on it, yours included. */
  tally: Map<number, number>;
  yours: number;
  n: number;
}

/** Strangers' rows (from the server, your uid already excluded) plus your own time,
 *  added once. Drops malformed rows (D16). */
export function buildField(rows: FieldRow[], yours: number): Field;

/** Item 85: middle value at odd n; mean of the middle two, rounded, at even n. */
export function median(sorted: number[]): number;

/** Items 28 and 111, integer-first and capped at 99 (D17). faster = count strictly faster
 *  than you. Never called for the strictly slowest, who reads item 60's line. */
export function percentile(faster: number, n: number): number;

export type Ranking =
  | { kind: 'first' }                                   // n = 1 (61)
  | { kind: 'fastest'; joint: boolean }                 // n ≥ 2, nobody faster (88, 94)
  | { kind: 'ordinal'; rank: number; joint: boolean }   // 2 ≤ n < 10 (56)
  | { kind: 'percentile'; pct: number }                 // n ≥ 10, 1–99 (59, 111)
  | { kind: 'count'; n: number };                       // n ≥ 10, strictly slowest (60)

export function ranking(field: Field): Ranking;

/** The copy line in three parts; the middle one is bold. */
export function rankCopy(r: Ranking): { pre: string; bold: string; post: string };

export interface Dot { fraction: number; size: number; mine: boolean }
export interface Ref { word: 'Fastest' | 'Median' | 'Slowest'; seconds: number;
                       fraction: number; anchor: 'start' | 'center' | 'end' }
export interface Geometry { dots: Dot[]; refs: Ref[]; you: { fraction: number; seconds: number } }

export function geometry(field: Field): Geometry;

export interface Box { left: number; width: number; align: 'start' | 'center' | 'end'; at: number }
export interface Layout { refs: Box[]; you: Box; note: 'left' | 'right' | 'below' }

export function layout(input: {
  track: number; geometry: Geometry; refWidths: number[]; youWidth: number; noteWidth: number;
}): Layout;

/** Item 113's visually hidden sentence. */
export function spokenSummary(field: Field, g: Geometry): string;

/** Label text, compact form (item 63). */
export function labelTime(seconds: number): string; // formatDuration(s, { compact: true })
```

### Rules, exactly

- **buildField:** expand each valid row `count` times, push `yours` once, sort ascending.
  `yours` is the player's whole-second time and is never floored here.
- **Ranking**, with `faster = sorted.filter(t => t < yours).length` and
  `joint = tally.get(yours)! > 1`:
  1. `n === 1` → `first`.
  2. `faster === 0` → `fastest` with `joint`.
  3. `n < 10` → `ordinal` with `rank = faster + 1` and `joint`.
  4. `faster === n - 1` (strictly slowest; a tie at the bottom has `faster < n - 1`) → `count`.
  5. otherwise → `percentile` with `pct = percentile(faster, n)`.
- **rankCopy:**
  - first → `"You're the "`, `first`, `" to solve today"` (61)
  - fastest → `"You're the "`, `fastest` or `joint fastest`, `" today"` (88, 94)
  - ordinal → `"You're the "`, `` `${joint ? 'joint ' : ''}${ordinal(rank)} fastest` ``, `''` (56)
  - percentile → `"You're in the "`, `` `top ${pct}%` ``, `" of solve times"` (59)
  - count → `''`, `` `${n} players` ``, `" solved today"` (60)
  - `ordinal` is the board's function, unchanged. Never the word "slowest" (56).
- **Placement** (90): `p(t) = Math.max(1, t)` (21, 87). `lo = p(sorted[0])`,
  `hi = p(sorted[n-1])`, `flat = hi === lo`.
  `fraction(t) = flat ? 0.5 : (Math.log(p(t)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))`.
  No clip anywhere (106).
- **Dots:** one per distinct second in `tally`, ascending,
  `size = Math.min(21, (mine ? 13 : 9) + (count - 1) * 4)`, `mine = second === yours`.
  Then the median disc (85): if `n >= 3` and `!tally.has(median)`, push
  `{ fraction: fraction(median), size: 9, mine: false }`.
- **Refs** (board, unchanged): flat → `[Fastest center]`, at any n — the board wins over item
  47 here (item 115). Otherwise `Fastest start`, then
  `Median center` if `n >= 3`, then `Slowest end`. `seconds` is the true time (not floored).
- **layout:** the board's algorithm with `TRACK` replaced by `input.track` (105):
  each ref box is `width = refWidths[k]`, `at = fraction * track`, `left` from its anchor
  (start → `at`; end → `at - width`; center → `at - width / 2`); clamp into
  `[0, track - width]`; forward pass pushing each box to at least `prev.left + prev.width + 8`;
  backward pass pulling any box off the right edge and its predecessor with it. Loop variables
  stay `k` and `m` (the board's warning about shadowing). Your box: `align` start if
  `at - w/2 < 0`, end if `at + w/2 > track`, else center; `left` from `align`.
  Note (items 48, 122): the far corner is `right` when `you.at < track / 2`, else `left`. The
  corner box spans `[track - noteWidth, track]` or `[0, noteWidth]`. If it comes within 8px
  (the `GAP`) of your box, `note = 'below'`; otherwise `note` is that corner.
  Below the 288px content floor (item 96) the passes still run and leaders stay true, but
  labels may overlap — 288px is the WCAG reflow floor (a 320 CSS px viewport).
- **spokenSummary** (item 113, "players" throughout), first match wins, durations through
  `speakDuration`:
  1. n = 1 → `1 player solved today. Yours: 41 seconds.`
  2. flat (every time on one second), any n ≥ 2 →
     `5 players solved today, all in 41 seconds. Yours: 41 seconds.`
  3. n = 2 → `2 players solved today. Fastest 30 seconds, slowest 41 seconds. Yours: 41 seconds.`
  4. otherwise → `14 players solved today. Fastest 23 seconds, median 1 minute 10 seconds,
     slowest 4 minutes 2 seconds. Yours: 41 seconds.`
  The reference times are the true seconds, not the placement floor.

### Tests — `tests/time-chart.spec.ts`, written before the module

Positions and sizes (78):
- fastest at fraction 0, slowest at 1; `fraction(√(lo·hi))` is 0.5 (log, not linear), with
  `toBeCloseTo`.
- base independence (90): the fractions equal those computed with `Math.log10`.
- one distinct time, any n → every fraction 0.5; refs are `[Fastest center]`.
- 1s floor: a stranger on 0 and you on 1 → flat; a stranger on 0, you on 10 → stranger at 0.
- sizes: alone 9, yours alone 13, three on one second 17, five or more capped at 21; yours
  shared with two strangers is 21 (13 + 2·4).

Median (78, 85):
- n = 2 → no median ref and no extra dot (no double draw).
- n = 3 odd, median is a real time → Median ref present, no extra dot, dot count equals
  distinct seconds.
- n = 4 even `[10, 20, 31, 40]` → median `26` (25.5 rounds up), extra 9px dot at
  `fraction(26)`; n = 4 `[10, 20, 20, 40]` → median 20, someone on it, no extra dot.

Counting yourself once (18, 91, 110):
- server rows omit you → `n` is rows + 1.
- a stranger on your exact second → `tally.get(yours) === 2`, `n` counts both, ranking joint.
- rows containing malformed entries (`second: -1`, `second: 1.5`, `count: 0`, `count: '2'`)
  are dropped (D16).

Percentile (28, D17):
- `percentile(0, 10) === 10`, `percentile(6, 10) === 70` (the float trap),
  `percentile(0, 50) === 2`, `percentile(1, 3) === 67`.
- the 99 cap (111): `percentile(99, 101) === 99` (ceil gives 100), `percentile(198, 200) === 99`.

Ranking and copy, as full rendered strings `pre + bold + post` (56, 59–61, 88, 94, 100):
- n = 1 → `You're the first to solve today` (also documents item 100).
- sole fastest at n = 2, 9, 10, 50 → `You're the fastest today` (never a percentile).
- tied fastest at n = 2 and n = 12 → `You're the joint fastest today`.
- 2nd of 5 → `You're the 2nd fastest`; last of 5 → `You're the 5th fastest`; slowest of 2 →
  `You're the 2nd fastest`.
- tie mid-field below 10: two on 3rd of 7 → both `You're the joint 3rd fastest`.
- tie mid-field at 12: two tied with 4 faster → both `You're in the top 42% of solve times`.
- 7th of 10 → `You're in the top 70% of solve times`.
- strictly slowest of 10 → `10 players solved today`; tied slowest at 10 (two on the last
  second) → `You're in the top 90% of solve times`.
- 100th of 101, with one strictly slower → `You're in the top 99% of solve times`; tied
  slowest at rank 199 of 200 → `You're in the top 99% of solve times`. "top 100%" never
  appears (111).
- ordinals 11th, 12th, 13th, 21st, 22nd at n < 10 are unreachable, so test `ordinal` directly
  for 1–4, 11–13, 21–23.

Layout (48, 52, 96, 105, 108):
- refs never overlap and never leave `[0, track]`, for every position of three refs on a
  sweep of 50 fields, at `track` 288 and 480, with widths from the board's calibration
  (Fastest 39.9, Median 40.7, Slowest 42.1, time 43.6) and again doubled (200% text).
- `you.align` is start at fraction 0, end at fraction 1, center at 0.5.
- `note` is right when you are left of centre, left when right of centre.
- at normal widths (note 66, the measured `— log scale` at 12px), the sweep never yields
  `below`, at 288 or 480. This is item 122's "nothing changes at normal text size".
- at doubled widths (note 132, your box 88) and track 288, you at fraction 0.5 yields `below`.
  Across the sweep, a corner note never comes within 8px of your box.

All-identical fields (115, 120), at n = 3 and n = 10, everyone on 41: one dot, size 21 at
both n = 3 and n = 10 (`13 + (3 − 1) × 4 = 21`, and the cap holds it at 21 for n = 10),
`mine` true; refs exactly `[Fastest center]`; no median dot; copy
`You're the joint fastest today`; spoken `3 players solved today, all in 41 seconds. Yours:
41 seconds.` and the n = 10 equivalent.

`tests/project-guard.ts`: jsdom 37 → 38, in this task's commit.

Spoken sentence (113, 120): each of the four variants as written above — n = 1, n = 2 with
two different times, all-identical at n = 2, and the 14-player example — and that it uses
words (`seconds`, `minute`), never `41s`.

The 1s guard (116): a malformed 0 row that reaches the client is kept, floored to 1 for
placement, and its label still reads `0s`.

---

## Task 6 — Tokens, icon and CSS

Implements 49, 51, 64, 66, 69, 80, 97, 105 (tokens), 122 (caption style). Commit:
`feat(results): chart tokens, podium icon and card styles`.

**Tests first** — `tests/palette-contrast.spec.ts`, new `describe('time chart tokens')`. It
computes each token the way the browser does: `color-mix(in srgb, A p%, B)` is a per-channel
mix of the gamma-encoded bytes. Add a `mixSrgb(a, b, p)` helper to `tests/helpers/colour.ts`.
For all eight theme × mode combinations:
- `--chart-dot` (accent 72% into bg) against `bg` ≥ 3:1 (69, 97). Measured while
  planning: tightest is Lime light at 3.22.
- `--chart-line` (text 55% into bg) against `bg` ≥ 3:1. Measured: light 3.54, dark 5.95.
- your dot (`--color-accent`) against `bg` ≥ 3:1 — already true at ≥ 5.36, pinned here.
- chart text is `--color-text` on `bg`, already ≥ 4.5 — assert it in this block so the chart's
  own claim is pinned in one place.

A test that parses `src/tailwind.css` and asserts the two token declarations read exactly
`--chart-dot: color-mix(in srgb, var(--color-accent) 72%, var(--color-bg))` and
`--chart-line: color-mix(in srgb, var(--color-text) 55%, var(--color-bg))`, so a hand-edit of a percentage
cannot pass with the maths test still green. `tests/token-parity.spec.ts` already reads the CSS
file this way.

`tests/sprites.spec.ts`: add `icon-podium` to `PANEL_ICONS` first, so a missing symbol fails
the suite instead of rendering nothing. The existing checks (24×24 viewBox, `currentColor`)
then hold the new symbol to D15.

`tests/token-parity.spec.ts` must pass unchanged. That is the check that D18 kept the tokens
out of `@theme`.

**Implementation** — `src/tailwind.css`:
- A plain `:root` rule (D18), placed after the `@theme` block, with a comment citing items 64
  and 69, the measured floor, and why it is outside `@theme`:
  ```css
  :root {
    --chart-dot:  color-mix(in srgb, var(--color-accent) 72%, var(--color-bg));
    --chart-line: color-mix(in srgb, var(--color-text) 55%, var(--color-bg));
  }
  ```
  Mixed into `--color-bg`, not `transparent`, so the dots are opaque, overlapping dots do not
  darken, and the ratio is computable. They count against the 15-token ceiling all the same:
  10 in `@theme` plus these two is 12.
- `[data-stat-block="everyone-today"] { --section-accent: var(--color-accent); }` beside the
  other three.
- `.time-chart` component rules, converted from Idea-O's `.spread*` rules (lines 95–119) per
  D11 (px ÷ 16 → rem for every vertical metric and font size):
  `.time-chart__line` (1rem, weight 400, margin-block-start 0.875rem),
  `.time-chart__track` (position relative, block-size 7.25rem, margin-block-start 0.875rem),
  `.time-chart__axis` (top 3.625rem, block-size 1.5px, `--chart-line`),
  `.time-chart__above, .time-chart__below` (position absolute, display flex, flex-direction
  column, gap 0.125rem — the board's shared rule; the 2px gap is what lines the second-row
  note of item 123 up with your time),
  `.time-chart__above` (top 0, weight 700), `.time-chart__below` (top 5.375rem),
  `.time-chart__t, .time-chart__w` (0.75rem / 0.875rem line-height, nowrap),
  `.time-chart__lead` (1px × 0.875rem, `--chart-line`), `--up` top 2rem, `--down`
  top 4.375rem, `.time-chart__note` (top 1rem per item 123, 0.75rem, nowrap; `--left` left 0,
  `--right` right 0; `--below` static, centred, margin-block-start 0.375rem, line-height
  0.75rem, no leader — Idea-R's `.note-s`, item 122), `.time-chart__dot` (top 3.625rem, translate −50%, radius full,
  `--chart-dot`, `border: 1.5px solid var(--color-bg)` per D14), `.time-chart__dot--you`
  (`--color-accent`, z-index 3).
- The reserved height for the busy slot is **not** in this task. It is measured from the drawn
  card in Task 7 and committed there (item 54).
- No transition or animation on any `.time-chart` rule (51).

`public/sprites.svg`: `<symbol id="icon-podium" viewBox="0 0 24 24">` per D15, copying
`icon-trophy`'s attribute set exactly (`public/sprites.svg:248`), including
`stroke-width="2"`, `stroke-linecap="round"` and `stroke-linejoin="round"`. The board's
1.8 stroke is not used: every stroke in the sheet is 2 or 2.5.

---

## Task 7 — The view, and wiring it into the panel

Implements 4, 11, 16, 22, 23, 25, 26, 30, 31, 38, 46, 50, 52, 53, 54, 57, 62, 65, 66, 68, 69, 122,
71, 72, 76, 77, 91, 92, 93, 96, 97, 101, 105 (heading, note, width), 107, 109, 110, 112, 118,
120, 121.
Commit: `feat(results): Everyone today card on /solved`.

### `src/time-chart-view.ts`

```ts
export interface TimeChartContext { puzzleNum: number; seconds: number; sendUid: boolean }

export function initTimeChart(opts: { uid: string }): void;
/** The reserved, empty slot. Inserted by renderCompletion. */
export function timeChartSlot(): string;
/** Set by renderCompletion; null means no card this render. */
export function setTimeChartContext(ctx: TimeChartContext | null): void;
/** Called on every screens:enter for the completion screen — one visit (item 93). */
export function showTimeChart(): void;
```

- `timeChartSlot()` returns
  `<section data-stat-block="everyone-today" data-time-chart class="stat-block" aria-busy="true"></section>`.
  `aria-labelledby` is added only when drawn, so it never points at a missing id.
- `showTimeChart()`: no context, or no `[data-time-chart]` in the document → return. The
  context is set only for item 46's modes, so this is the mode check item 121 asks for: a
  random solve's `screens:enter` fetches nothing and sends no `time_chart`. Otherwise
  `visit += 1`; set `aria-busy="true"` and `hidden = false`; fetch
  `/api/times/${puzzleNum}` with `{ cache: 'no-store', signal }`, adding
  `headers: { 'X-Clumeral-Uid': uid }` only when `ctx.sendUid` (D2, items 91, 110); 5s
  timeout (D7). On a non-OK status, a network error, a timeout, or a body whose `times` is not
  an array → `fail()`. On success → `draw()`. Either way, if `visit` moved on, do nothing (D8).
- `draw(rows)`: `field = buildField(rows, ctx.seconds)`, `g = geometry(field)`,
  `copy = rankCopy(ranking(field))`. Writes, in this order:
  1. the heading, built like `block()` in `completion.ts`:
     `<h3 id="stat-head-everyone-today" class="stat-block__head"><svg class="stat-block__icon" aria-hidden="true"><use href="/sprites.svg#icon-podium"/></svg>Everyone today</h3>` (62, 97);
  2. `<p class="time-chart__line">${pre}<b>${bold}</b>${post}</p>` (real text, read first — 71);
  3. `<p class="sr-only">${spokenSummary(field, g)}</p>` (71);
  4. `<div class="time-chart__track" data-time-chart-track aria-hidden="true">` holding the axis,
     the note `— log scale` (101) with its `--up` leader (107), each ref box with its `--down`
     leader, each dot, and your box (`You` then your time, 109) with its `--up` leader.
     All strings are generated from numbers, so `innerHTML` takes no outside text.
  Before writing, it disconnects the previous visit's observer, if any. Then it sets
  `aria-labelledby="stat-head-everyone-today"`, removes `aria-busy` (68), runs
  `place()`, connects a `ResizeObserver` on the track that calls `place()` (D10), and
  dispatches `analytics:track` with `{ event: 'time_chart', source: 'drawn', value: field.n }`
  (77, D5).
- `place()`: reads `track.clientWidth`, measures each ref box, your box and the note with
  `getBoundingClientRect().width` (each box is `width: max-content` until placed) (50), calls
  `layout()`, writes `left` and `align-items` in px to each box and `left` to each leader,
  and puts the note where `layout().note` says. A top corner gets its leader at the track's
  0 or 100%. `below` moves the note after the track as a centred caption, with its leader
  hidden (item 122).
  Dot `left` is written as a percentage of `fraction`, so dots need no re-layout.
- `fail()`: disconnect any observer, empty the slot, `hidden = true`, remove `aria-busy`,
  dispatch `time_chart` with source `failed`, value 0 (23, 57, 77).
- No live region and no focusable element anywhere in the card (65, 72). No storage reads or
  writes (30).

Known and accepted, not fixed here (a pre-existing last-render-wins issue):
`startReplayPuzzle` (`src/app.ts:1012`) re-renders the panel in archive mode, which sets the
context to null. A later in-app trip back to `/solved` in the same session then shows no
card until a reload. Every other panel figure already behaves this way after an archive
replay.

### `src/completion.ts`

- In `renderCompletion`, after `mode` and `seconds`:
  ```ts
  // The card (brief 46): today's daily with a recorded or in-memory time.
  // Random and archive have no field (4); a marker has no time (22, 92).
  const showsChart = (mode === 'full' || mode === 'new' || mode === 'saving-off') && seconds !== null;
  ```
- `blocks` gets `timeChartSlot()` pushed straight after the this-game block, before the
  `mode === 'full'` blocks, so it sits above Current streaks (53) and the rest of the panel is
  unchanged (11).
- `setTimeChartContext(showsChart ? { puzzleNum, seconds, sendUid } : null)` where
  `sendUid = loadHistory().some((e) => e.date === todayKey() && !e.marker && !e.archived)`
  (110). On the saving-off solve visit `seconds` is the in-memory timer value passed in
  `opts.seconds` (92); on a saving-on visit it is the history entry's `seconds` (31).
- The existing `screens:enter` listener calls `showTimeChart()` when
  `screen === 'completion'`, **before** its `pendingAnnouncement === null` early return (93).
  The announcement text is unchanged (72).

### `src/app.ts`

`initTimeChart({ uid: analyticsUid });` beside `initWelcome()`, at module level (CONVENTIONS).

### Tests first — `tests/time-chart-view.spec.ts` and `tests/completion-stats.spec.ts`

jsdom has no layout, so these test structure and flow, not pixels. `fetch` is stubbed with
`vi.stubGlobal`; `ResizeObserver` with a no-op class.

`tests/completion-stats.spec.ts` (extends its existing `setupDOM` and history seeding):
- the slot exists, empty and `aria-busy="true"`, in full, new and saving-off modes, directly
  after the this-game block and before `[data-stat-block="streak"]` in full mode (46, 53).
- no slot in random, archive and marker modes, nor when `seconds` is absent (4, 22).

`tests/time-chart-view.spec.ts`:
- a `screens:enter` for `completion` fetches `/api/times/<num>` once; for `game` it does not.
- after a random solve (`renderCompletion(…, true, …)`), a `screens:enter` for `completion`
  makes no fetch and dispatches no `analytics:track` (121).
- the uid is never in the request URL, only the header (118).
- the header is sent when today's history holds a recorded entry, and absent on a saving-off
  solve with no entry; present for a saving-on solve later viewed with saving turned off
  (91, 110, 112, 120).
- two visits fetch twice (25); a slow first response arriving after the second is ignored (D8).
- success: heading `Everyone today`, the copy line text, the sr-only sentence, the track
  `aria-hidden="true"`, `aria-busy` gone, `aria-labelledby` resolving to the heading, no
  element with `tabindex` and no `a`/`button` inside (65).
- your box reads `You` and your compact time; the note reads `— log scale`.
- failure on 500, network error, timeout (fake timers, 5s), and `{ times: 'x' }`: slot
  `hidden`, empty, no `aria-busy`.
- a second successful visit disconnects the first visit's `ResizeObserver` (spy on
  `disconnect`).
- one `analytics:track` per visit: `time_chart`/`drawn`/n on success, `failed`/0 on failure;
  saving-off players send it too (77).
- no `localStorage` key is written by a visit (30): snapshot keys before and after.

`tests/project-guard.ts`: jsdom 38 → 39, in this task's commit.

**Measure before Task 8.** In the browser at a 320px viewport (288 content), draw the longest
copy lines and confirm each fits on one line: `You're in the top 99% of solve times`,
`You're the joint 2nd fastest` and `You're the first to solve today`. If any wraps, stop and
ask Jamie. It is a copy question (items 56, 59, 61), and a wrap breaks item 54's reserved
height. Then measure the drawn card's height at a 375px viewport, default text, and add this
rule to `src/tailwind.css` in this task's commit, with the measured value in rem and a comment
saying where it came from:
`[data-time-chart][aria-busy="true"]:empty { min-block-size: <measured>rem; }`.
Task 8's no-shift test is what holds it.

---

## Task 8 — Playwright e2e

Implements 52, 54, 69, 70, 71, 81 (in part), 83, 96, 108, 113. Commit: `test(e2e): time chart card`.
QA scope is item 83: this one spec, plus the existing `completion.spec.ts` and `a11y.spec.ts`.
Not the full suite.

`e2e/specs/time-chart.spec.ts`, on `chromium-desktop`, `mobile-chromium` and `mobile-webkit`
(other projects skip with a reason). `test.use({ serviceWorkers: 'block' })`: `e2e/fixtures.ts`
records that `page.route` is unreliable on WebKit with an active service worker, and the
service worker sends `/api/` network-only anyway, so blocking it loses nothing this spec tests.
`/api/times/*` is stubbed with `page.route` and a fixed field. **No test in this file uses
`freezeDate` or `page.clock`.** History is seeded with `seedHistory`, relative to the real
local today, using the `day(back)` helper pattern from `e2e/specs/player-stats.spec.ts:20–24`.
The Task 3 test and the random-mode solve need real time; the seeded tests need nothing
frozen, since the card reads today's entry and the stubbed field.

- the Task 3 test (puzzle number on `puzzle_time`).
- the card at n = 1, 3 and 12: the copy line, the sr sentence, `You` and your time, and the
  median label present at 3 and 12 only.
- **no layout shift:** at 375px and 320px viewports, default text size, with the longest copy
  line, record the top of `[data-stat-block="streak"]` while the stubbed response is held
  (the route handler awaits a promise). Release it, and assert the top moved by less than
  1px (54). This is what holds the Task 6 reserved height. It is not run at 200% text: the
  reserve is a fixed rem height, and the caption fallback (122) adds height there by design.
- **no collisions at real widths:** at viewport widths 320, 375 and 512 (content 288, 343 and
  480 — item 96), read the `getBoundingClientRect()` of every label box and of the note.
  Assert no two overlap and every box is inside the track. Repeat at 200% root font size at a
  352px viewport. There, a `below` note is left out of the inside-track check: assert instead
  that its top is below the track's bottom and that it overlaps no other box. `--page-gutter` is 1rem, so at 200% each gutter is 32px, and 352 is what
  gives 288px of content (at 320 it would be 256, below the floor). At 200%, with your dot
  near the middle, the note is the bottom caption (122).
- a stubbed 500 collapses the slot (`hidden`), and the this-game, streak and all-time blocks
  are intact (23). Chromium's "Failed to load resource" text carries no URL, so a text
  pattern cannot scope it. Add an `allowUrl(re: RegExp)` method to the `ConsoleGuard` that
  `attachConsoleGuard` returns (`e2e/helpers/console.ts`). It suppresses a console error
  whose `msg.location().url` matches. Only this one test calls
  `consoleGuard.allowUrl(/\/api\/times\//)`, so no other spec hides an `/api/times/` error.
  When writing it, confirm on `mobile-webkit` that `location().url` is the failed resource's
  URL. If WebKit reports something else, match that instead, and record what it reports in a
  comment.
- absent in random (solve `/random`), archive (`/archive/<date>` solved view) and marker
  (seeded marker for today) modes, and in marker mode no request to `/api/times/` is made.
- axe on `/solved` with the card drawn, light and dark, using `a11y.spec.ts`'s existing
  configuration and exception list unchanged (70).
- the track is `aria-hidden`, and the sr sentence is in the accessibility tree with the
  item 113 text at n = 1, n = 2, an all-identical field, and n ≥ 3.

Run per CLAUDE.md and the memories: against the production build, reading passes per project
from the output, not the exit code.

---

## Task 9 — Docs

Implements 7, 36, 75, 82, 95, 99, 119. Commit: `docs: time chart route, puzzle_num and time_chart`.

- `docs/ANALYTICS.md`: the `puzzle_num` column (what writes it, NULL for older rows and old
  clients); the `time_chart` event (source, value, when sent, sent for saving-off players);
  the `GET /api/times/:num` route; and item 37's rule stated as a rule (119).
- `docs/INVARIANTS.md`: item 37's rule as a standing rule — the field route never returns a
  uid, a solve timestamp, or anything but a time and its count — placed with the privacy and
  answer-safety rules, naming `tests/worker/times-route.spec.ts` as the test that holds it
  (119). `docs/INVARIANTS.md` requires this of a new rule: break it on purpose (add `uid` to
  the route's mapped rows), watch the exact-key-set test fail, revert, and say so in the PR.
- `docs/ARCHITECTURE.md`: the route under "Worker API"; `time-chart.ts` and
  `time-chart-view.ts` in the file list.
- `CLAUDE.md`: the "No worker/API changes" constraint gains an exception for this one
  read-only route, citing brief item 7.
- `docs/CONSIDERATIONS.md`: the entry from item 36 exists and already names abuse volume
  (item 95). Correct its "Likely fix then" line: the response now excludes the caller's uid
  (item 91), so it is no longer the same for every player. A shared edge cache would need the
  uid exclusion moved to the client. State that; decide nothing.

---

## Task 10 — Verify, review, pre-prod

Implements 44, 81, 82, 89, 108.

1. `npm test` (both projects: jsdom 39 files, workers 5, total 44; the guard enforces it) and
   `npm run lint:migrations`.
2. Read `docs/INVARIANTS.md` against the final diff; record P1–P7 one line each in the PR body.
   Confirm `git diff --stat staging` touches none of the files item 44 lists, other than the
   one-line `track()` change in `app.ts` and the read-only `puzzleDate` import.
3. Push the branch. On `dev-daily-time-chart-clumeral-game.jevawin.workers.dev`: solve today's
   daily, see the card, reload `/solved`, and confirm your second comes back from
   `/api/times/<num>` with the header removed (DevTools, or `curl` without it) — this proves
   the row landed with its number, since NULL rows are never returned (81).
4. Read the `time_chart` count from the `events` array of `/api/stats?period=7` on the preview
   host. It reads `clumeral-analytics-preprod` filtered to that hostname, so no
   `wrangler d1 … --remote` is needed (81). The `/stats` page itself shows a fixed list of
   events (`src/worker/stats.ts:215–255`), so `time_chart` does not appear there. The
   drawn/failed split cannot be read without remote D1. That is accepted: item 81 asks that
   the events arrive, and the count shows that.
5. Screenshots at content widths 288, 343 and 480 for Jamie to compare against Idea-O,
   including the D13 note placement (81, 108).
6. Gates, in the order CLAUDE.md sets: human review → `da-build` → Fable review
   (`claude-fable-5-1`) against the brief: the maths definitions, the copy at every state,
   item 37, contrast and accessibility (89) → PR into `staging`.

---

## Traceability

Every brief item, to a task or to "no code".

| Items | Where |
|---|---|
| 1, 2, 3, 5, 6, 10, 27, 58, 67, 73, 98, 102, 103 | No code — context, scope or settled-and-closed |
| 9, 13, 14 | No code — out of scope; Task 7 adds nothing about goes or sharing |
| 20, 84 | Void (106) |
| 4, 16, 22, 46 | Task 7 |
| 7 | Tasks 2, 9 |
| 8, 15, 32, 33, 34, 35, 37, 42, 95, 116, 117 | Task 2 (116 also Task 5) |
| 111, 113, 115 | Task 5 (113 also Task 8; 115 also Task 4) |
| 112, 118, 121 | Task 7 (118 also Task 2) |
| 114 | No code — record of acks |
| 122 | Tasks 5, 6, 7, 8 |
| 123 | Tasks 6, 7 |
| 119 | Task 9 |
| 120 | Tasks 2, 4, 5, 7 |
| 11, 23, 25, 26, 30, 31, 38, 50, 53, 57, 62, 65, 68, 72, 76, 92, 93, 110 | Task 7 |
| 12, 40, 74 | Task 3 |
| 17, 19, 28, 39, 55, 56, 59, 60, 61, 85, 86, 87, 88, 90, 94, 100, 104, 106, 109 | Task 5 |
| 18, 91 | Tasks 2, 5, 7 |
| 21 | Tasks 2 (drop), 5 (floor) |
| 24 | Tasks 1, 2, 3 |
| 29, 41, 43, 45 | Task 1 (45 also Task 2) |
| 36 | Task 9 |
| 44 | Task 10 |
| 47, 48, 101, 105 | Tasks 5, 6, 7 |
| 49, 51, 64, 66, 80, 97 | Task 6 (66, 97 also Task 7) |
| 52, 96, 108 | Tasks 5, 7, 8, 10 |
| 54 | Tasks 6, 7, 8 |
| 63 | Task 4 |
| 69 | Tasks 6, 7, 8 |
| 70, 83 | Task 8 |
| 71 | Tasks 5, 7, 8 |
| 75, 99 | Tasks 2, 9 |
| 77 | Tasks 2, 7 |
| 78 | Tasks 4, 5 |
| 79 | Tasks 1, 2 |
| 81, 82, 89 | Task 10 (82 also Task 9) |
| 107 | Tasks 6, 7 |

---

## Sequencing

Tasks 1 → 2 → 3 are the data path and each leaves the app working: the column is unused until
Task 2 reads it, and the route is unused until Task 7 calls it. Task 3's e2e test needs the
production build, so it runs in Task 8's run as well as when written. Tasks 4, 5 and 6 depend
on nothing before them and on each other only in that 5 imports 4's compact option. Task 7
needs 2, 4, 5 and 6. Task 8 needs 7. Each task is its own commit.

---

## Revision log

**Revision 3** — `da-plan` on revision 2, 2026-11-01. All findings checked against the code.

| Finding | Fix |
|---|---|
| H1: the local e2e database never gets 0008 | Task 1 adds it to `e2e:db:analytics`; Task 8's failure allow matches on URL, not text |
| H2: note and your label collide at 200% text; the e2e 200% width was 256, not 288 | Jamie chose the caption fallback (122). Task 5 `layout` returns `below`; Task 8 runs 200% at 352 |
| M1: `@theme` tokens break token parity | D18: tokens outside `@theme` |
| M2: a cropped viewBox fails the sprites test | D15: 24×24, stroke 2, round caps |
| M3: project guard counts not bumped | Tasks 2, 5, 7 bump them in their own commits |
| M4: Task 3's e2e cannot solve on a frozen other day | Freeze to now; derive the number |
| L1: puzzle 238 is 31 Oct | 239, derived with `puzzleNumber` |
| L2: fall-through tests throw without `ASSETS` | ASSETS stub, asserted |
| L3: the note row changed settled behaviour | Jamie chose the second row (123); D13 now cites it |
| L4: the observer leaked across visits | `draw()` disconnects first; tested |
| L5: an archive replay nulls the context | Recorded as known and accepted in Task 7 |
| L6: the INVARIANTS rule needs a seen-to-fail test | Task 9 |
| L7: float equality on √(lo·hi) | `toBeCloseTo` |
| L8: no-shift test viewport unstated; copy may wrap | Task 7 measures and stops on a wrap; Task 8 states viewports |

**Revision 4** — second `da-plan`, on revision 3, 2026-11-01. It confirmed every revision 3
fix holds against the code.

| Finding | Fix |
|---|---|
| M1: the all-identical test expected size 17 at n = 3; the formula gives 21 | Expect 21 at n = 3 and n = 10 |
| M2: the clock advice repeated the earlier M4 problem; `player-stats.spec.ts` freezes nothing | No `freezeDate` anywhere in the spec; seed relative to the real today; derive the number from the local date |
| L1: the icon attributes disagreed between D15 and Task 6 | Task 6 copies `icon-trophy` exactly |
| L2: `/stats` does not list `time_chart` | Read `/api/stats` instead; the drawn/failed split is accepted as unreadable |
| L3: a placeholder height was committed in Task 6 | The rule moves to Task 7, after the measurement |
| L4: the shared `above`/`below` rule was missing | Listed, with the 2px gap |
| L5: the inside-track check fails for the caption | The caption is checked as below the track instead |
| L6: `null < 60` | Compact branch after the null check, stated |
| L7: a shared `ALLOW_URL`, and WebKit unverified | A per-test `allowUrl`; verify on WebKit when writing |
