# Architecture

Vite + TypeScript. Cloudflare Worker via `@cloudflare/vite-plugin`. REST API — answer never sent to client.

## Files

```
src/
  app.ts         Client UI, guess handling, game flow
  storage.ts     localStorage helpers (prefs, history)
  player-stats.ts  The counting rules — history rows in, displayed figures out (pure)
  play-timer.ts    Counted play time: event-driven accumulator, injected clock (pure)
  save-warning.ts  The untick warning and the five-second submit countdown (pure)
  modals.ts      How-to-Play, toast, feedback modals
  theme.ts       Light/dark toggle, dot-grid canvas bg
  colours.ts     Accent colour picker, icon swap
  octo.ts        Octopus mascot animations
  bubbles.ts     Rising bubbles on correct answer (owns canvas)
  types.ts       Shared types (GameState, ClueData, HistoryEntry, Prefs)
  global.d.ts    Ambient types
  tailwind.css   All styling (Tailwind v4 @theme tokens + component CSS)
  worker/
    index.ts     Entry — API routes + HTML serving
    puzzle.ts    Filter/compute logic, RNG, seeding (server-only)
    puzzles.ts   /puzzles history page (SSR)
    stats.ts     /stats dashboard renderer (chart, tables, nav)
    analytics-db.ts  Analytics storage + queries (D1)
    chart.ts     Daily-plays chart geometry (pure)
    feedback.ts  /feedback admin dashboard renderer (reads D1)
    crypto.ts    AES-GCM token signing for random puzzles
public/          Static (icons, manifest, sw.js)
index.html       Shell
```

## Worker API

- `GET /api/puzzle` — today's clues (no answer)
- `GET /api/puzzle/random` — random puzzle + signed token
- `GET /api/puzzle/:num` — specific puzzle clues
- `GET /api/puzzle/:num/solution` — answer for PAST puzzles only
- `POST /api/guess` — server validates, returns correct/incorrect
- `POST /api/event` — analytics
- `POST /api/feedback` — store player feedback (public)
- `GET /api/stats` — stats data
- `GET /api/dev/answer` — dev only
- `GET /stats`, `/puzzles`, `/puzzles/:num` — SSR HTML
- `GET /feedback` — admin feedback dashboard (private, gated by Cloudflare Access)
- `GET /`, `/index.html`, `/random` — app shell

Client fetches puzzle data on load. Never has the answer — validation is server-side (`POST /api/guess`). Daily puzzles are served from KV, write-once (see [Puzzle storage & archive integrity](#puzzle-storage--archive-integrity-kv--write-once)).

## Analytics

Events are stored in **Cloudflare D1** (`clumeral-analytics`, binding `ANALYTICS_DB`), written by
`POST /api/event` and read by the private `/stats` dashboard. Analytics Engine is dual-written
during the migration and is being retired — it retains only ~90 days, which is why the move
happened. Full reference — schema, sampling caveat, cutover and comparison gate:
[ANALYTICS.md](ANALYTICS.md).

## Feedback

Player feedback is stored in **Cloudflare D1** (`clumeral-feedback` in production, `clumeral-feedback-preprod` on every other branch, binding `FEEDBACK_DB`), written by `POST /api/feedback` and read via the private `/feedback` dashboard. Full reference — schema, access, migrations, process: [FEEDBACK.md](FEEDBACK.md).

## Puzzle algorithm (puzzle.ts)

- Candidates = `[100..999]`, filtered live via `compute(n)` — no prebuilt data
- 31 properties across 6 groups: 15 boolean specials (3 digits × prime/square/cube/triangular/Fibonacci) + 16 numeric (4 sums, 3 diffs, 4 products, 4 means, 1 range)
- Main loop: one filter per group per iteration
- Tiebreaker: `=` sweep on remaining candidate until length 1
- Seed = YYYYMMDD local, RNG = mulberry32 (`makeRng`)
- `EPOCH_DATE = '2026-03-08'` = Puzzle #1

**DO NOT modify** `EPOCH_DATE`, `makeRng`, `PROPERTIES`, or `PROPERTY_GROUPS` unless fixing a proven bug. Breaks determinism / shifts puzzle numbers. Adding a **new** property (or a redundant-clue pass) shifts only *future* puzzles — KV freezes history (see below).

## Puzzle storage & archive integrity (KV — write-once)

Puzzles are **generated once, then frozen in KV** — the archive is static by construction. This is the single most useful fact about puzzle data; check here before assuming a generator change is retroactive.

- `readDailyPuzzle(store, date)` (`worker/daily-puzzle.ts`) reads the `PUZZLES` KV namespace by date key. Present → return it. Absent → generate (`generatePuzzleFromRng`) and return it **without storing**. **KV entries have no TTL and are never overwritten.**
- **Writes belong to the cron alone** — see [Write authority](#write-authority-cron-only-257) below.
- **Both** display (`GET /api/puzzle*`) **and** guess-validation (`POST /api/guess`, daily path) read the same frozen KV entry — a stored puzzle stays self-consistent forever.
- **Consequence:** changing the generator (e.g. adding Fibonacci, adding a redundant-clue pass) affects **any date not yet in KV** — normally future dates, but also any past date that was never frozen — plus random puzzles. It **cannot rewrite already-served puzzles.** No puzzle-versioning system exists or is needed — KV *is* the freeze.
- **Random puzzles** are the exception: not stored — re-derived from the HMAC-signed token seed on each guess (`handleGuess` token path, `crypto.ts`). Self-consistent within a session.

### Generator contract (#193)

Every generated puzzle has **4 to 6 clues**, and **no clue in it can be removed while still leaving one answer**. The generator draws, sweeps the redundant clues out, and retries up to **10 times** to land in that range. Measured over 3,000 seeds: 4 clues 60.5%, 5 clues 34.8%, 6 clues 4.7%, 1.45 draws on average, worst case 7.

**`generatePuzzleFromRng` in `worker/puzzle.ts` is the only entry point.** The raw draw beneath it (`drawClues`, formerly the exported `runFilterLoop`) is private, and a test scans every worker module to keep it that way. This matters more than it looks: a random puzzle's answer is never stored, so `handleGuess` re-runs generation from the token's seed. A caller reaching a different generator than the one the player was shown would mark correct guesses **wrong**.

If no attempt produces a uniquely-solvable puzzle, generation **throws** rather than publishing one with several valid answers. Unreachable in 3,000 measured seeds. If it is ever reached on a daily it fails that date until someone intervenes, which is the trade being made: a loud, fixable outage beats silently telling correct players they are wrong.

**The 4–6 range is not guaranteed the way uniqueness is.** If all ten draws land outside it, the generator publishes the best of them — nearest to the range, under-range preferred — and logs a warning instead of failing the date. Measured at roughly **1 in 100,000** generations, and in practice that means a 3-clue puzzle. Publishing above 6 needs ten consecutive draws of 7+ clues, about 1 in 1e28. So a rare short puzzle is possible; a screen-breaking long one effectively is not.

**The cutover.** Puzzles before this change often carried a clue nobody needed, and 7-clue puzzles existed. The first daily generated under the new rules is the deploy date **plus two** — the cron freezes today and tomorrow, so both are already written under the old generator when the merge lands. Merged to `main` on **2026-08-10**, so puzzles **#156 (2026-08-10)** and **#157 (2026-08-11)** were already frozen by the cron under the old generator, and the first daily made under the new rules is **#158, 2026-08-12**. The archive page's "Clues" column shows a visible step down there; nothing breaks. (If the merge slipped past 2026-08-10, these three numbers are each one day out — check `puzzleNumber()` against the actual merge date.)

**One caveat on "plus two".** It holds for every date already frozen in KV, which is what a player sees in the archive. A generator change also affects **any past date that was never frozen** — see the bullet above and [#235](https://github.com/jevawin/clumeral-game/issues/235), which records that some early dates may be missing. Any such date starts serving a 4–6 clue puzzle immediately on merge, not at the cutover. Nothing is rewritten; those dates simply had nothing stored to rewrite.

One accepted rough edge: a **random** puzzle held open in a backgrounded tab across the deploy can have its correct guess marked wrong, because the token carries the seed and no generator version. A reload fixes it and nothing is persisted.

### Write authority (cron-only, #257)

There is **one** `PUZZLES` namespace, so **every deployment shares production KV — preview URLs included**. Combined with write-once entries, whichever deployment writes a date freezes it permanently for real players.

(`env.preprod` in `wrangler.jsonc` *does* restate `kv_namespaces` — but with the **same id**, deliberately. Wrangler does not inherit that key, so restating it is how sharing is expressed rather than a split. The D1 databases beside it genuinely are split. Sharing KV stays safe only because pre-prod versions are uploaded and never deployed, so they never run `scheduled()` — the sole writer below. Anything that later gives pre-prod a deployment with a cron must give it its own namespace in the same change.)

Write authority is therefore constrained to the nightly cron:

| Function | Used by | Writes? |
|---|---|---|
| `readDailyPuzzle(store, date)` | every request handler | **no** — generates ephemerally on a miss |
| `ensureDailyPuzzle(store, date)` | cron only | yes, on a miss |
| `runDailyCron(store, today?)` | `scheduled` handler | yes — freezes **today and tomorrow** |

Two named functions rather than a persist flag: a request handler cannot acquire write authority by passing the wrong argument.

**Why the cron freezes tomorrow too.** `date-guard.ts` deliberately tolerates `today+1` so a UTC+14 player at local midnight is not locked out (#205). Before this, tomorrow was never pre-generated, so that tolerance path was a live write on every deployment, every day — a preview build could mint tomorrow's production puzzle. Pre-generating tomorrow makes the tolerance path a cache hit, and the freeze point predictable (cron time) rather than "whenever the first ahead-of-UTC player opens the app".

Ephemeral generation is not a *different* puzzle — it is deterministic from the date seed, so a pre-cron serve matches what the cron later stores, provided the serving deployment's property set matches production's. A mismatched preview build can now only affect the player in front of it, transiently, instead of freezing a broken puzzle for everyone forever. Cost of the trade: if the cron fails, players are served correct puzzles that leave no stored record. That is recoverable **only while the generator is unchanged** — after a property-set change (#254 added Fibonacci; #193 added the redundant-clue sweep) what was served ephemerally during the outage cannot be reconstructed from anywhere. A cron outage is therefore not harmless: `runDailyCron` throws on any failed date so the invocation shows as errored rather than passing quietly.

Covered by `tests/daily-puzzle.spec.ts`.

### Historical method change (early puzzles)

Puzzles #1..cutover (launch `2026-03-08` → on/before `2026-04-01`) were first generated by an **earlier CSV-based generator** that predates git history. Because KV is write-once, those originals are preserved in prod KV and served from it — verified 2026-07-17 (#1 = 659, #13 = 110). The current generator would recompute some early dates differently, but KV-first serving means players still get the originals. Auditing/documenting this is [#235](https://github.com/jevawin/clumeral-game/issues/235).

Inspect a stored puzzle: `wrangler kv key get "YYYY-MM-DD" --binding PUZZLES --remote`.

## localStorage keys

- `dlng_history` — `[{date, tries, answer?, archived?, seconds?, marker?}]`
  - `archived: true` = a past/archive solve, excluded from every stat
  - `seconds` = counted play time, 0–86400. **Absent means unknown, never 0** — pre-launch
    rows, opted-out players, and values that failed validation. A valid time above 1800
    still shows on its own panel but is left out of the average and of fastest.
  - `marker: true` = the day-only marker a player with score saving off leaves behind.
    `tries` is `0` and means nothing. Every figure filters markers out *before* counting,
    and four places that read `entry.tries` pass `null` for one rather than showing the 0.
- `dlng_prefs` — `{saveScore}`
- `dlng_active` — in-progress puzzle state (mid-game restore; validated on load). Also
  carries `elapsed?` and `idles?` — the play clock, so a refresh does not reset your time.
  Both are optional and an invalid value drops **that field**, never the board. `v` stays
  at `1`: bumping it would throw away the in-progress board of every player mid-puzzle.
- `dlng_theme` — `"light"|"dark"`
- `dlng_colour` — accent colour name (e.g. `"Lime"`)
- `dlng_uid` — anonymous analytics id
- `dlng_last_visit_date` — last-seen local date key, drives the midnight rollover

`dlng_` prefix = legacy name. **Never rename** — persisted in user browsers.

## sessionStorage keys

- `dlng_undo` — the digit-box undo stack (#251), `{v, scope, cur, e}`; validated on load

The only key not in localStorage, and deliberately so. The stack should survive a reload and
a tab restore — otherwise a mis-tapped Reset followed by a refresh is unrecoverable — but it
must not outlive the tab: a stack that outlived the board it describes would be worse than
no stack.

It is **not** date-guarded like `dlng_active`. It carries two guards instead:

- `scope` (`date:<puzzle-date>` or `random:<token>`) — the entries hold whole boards, so
  applying one puzzle's stack to another's board would silently corrupt it.
- `cur` — the board the stack described when it was written. This store is per-tab while
  `dlng_active` is shared across tabs, so scope alone cannot tell whether the two came from
  the same place: play in tab A, play on in tab B, reload tab A, and the scopes still match
  over diverged boards. Undo would then jump the board back by however many moves tab B made.

The stack is only rehydrated on the path where the board itself restores (today's daily
mid-game restore), and only written there too — an archive or `/random` stack is never read
back, so writing one would be discarded I/O on the hottest path in the game.
