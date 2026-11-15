# Results screen: today's time chart — handover into Brief

Written 2026-11-01. This is the input to `/briefing`, not the brief.

Everything below was agreed in a design chat on the Clumeral canvas and nowhere else.
**The canvas is the only other record.** Boards, in order of use:

- `Idea-O-Time-vs-Everyone.dc.html` — the design. The one to build.
- `Idea-P-First-Plays.dc.html` — the same card at n = 1, 2, 3, 10.
- `Idea-R-Log-Positions.dc.html` — where the log-scale label goes.
- `Idea-N-Copy-States.dc.html` — the copy at six points your dot can land on.

O, P and R share one computation block, lifted verbatim between them so they cannot drift.
Build should port that block, not re-derive it.

---

## 1. The decision

**Daily leaderboard strip: your solve time against everyone else's today.**

Dots on a horizontal log axis, one per distinct second. Your dot is solid accent with your
time labelled above it. Fastest, Median and Slowest sit below with short leader lines.
Copy above: "You're in the **top 70%** solve times".

**Log scale is declared on the card as `— log time`** (Dave's requirement). Position follows
the **flip rule**, chosen 2026-11-01: the label takes the top corner furthest from your dot.
Your dot left of centre → top right. Right of centre → top left. It carries a 14px leader to
its own corner. Measured clearance 106px and 186px in the two cases; costs 235px of card
height against 253px for a fixed bottom caption.

Always `— log time`, never bare `log time`. The dash makes it read as an aside about the
chart rather than as another of the chart's own labels among Fastest and Median.

### Why this and not the attempts chart

The test that decided it: **does it change between visits?** A daily game's results screen is
seen once a day. The all-time attempts distribution does not move — a player 239 games in sees
237-of-239 today and 238-of-240 tomorrow. Today's field moves every day.

### Why time and not goes

Production is **88.1% one-go**. Goes cannot rank anyone; the overwhelming majority tie on 1.
Time is the only captured variable with real spread. This is also why Dave's whisker chart is
the right end state and the goes version of this card was only ever a placeholder.

---

## 2. What the data actually supports today

Checked against production, 2026-11-01:

- **`puzzle_time` has 5 rows, all dated today.** The timer sat on staging and reached main
  today via PR #347. There is no history. The card launches on single digits.
- `puzzle_time` is already daily-only: `playTimeToSend` in `src/play-timer.ts` returns null for
  randoms, archive replays, opted-out players and invalid values. No filtering needed.
- **`puzzle_complete` is not clean.** `src/app.ts:1065` fires it from one call site for daily,
  archive *and* random. A query windowed on today mixes all three. The `source` column already
  exists on the analytics table and is not being used here. **Owed before the goes figures on
  this card can be trusted.** Not blocking the time chart, which does not read it.
- `POST /api/event` (`src/worker/index.ts:424`) accepts any `uid` with no auth. Fine while the
  card shows a percentile. **Publishing a named rank creates the first real incentive to forge
  events**, so a named leaderboard stays blocked on accounts.
- `VALID_EVENTS` has included `'puzzle_time'` since 2026-08-10 (`src/worker/index.ts:40`).

### What build has to add

**There is no endpoint for "today's times, everyone".** `src/worker/analytics-db.ts:180`
groups `puzzle_complete` by value, all-time. The card needs today's `puzzle_time` values, and
the client needs your percentile among them. That is the one piece of new worker surface — and
it contradicts the redesign project constraint "no worker/API changes", so the brief has to
open that explicitly rather than assume it.

---

## 3. Card anatomy, from Idea-O

- Fixed 390 wide, 319px track.
- Log positions: `(ln(t) - ln(lo)) / (ln(hi) - ln(lo))`. Single distinct time → everything at 50%.
- One dot per **distinct second**, grown by how many share it:
  `size = min(21, (mine ? 13 : 9) + (count - 1) * 4)`. Overlap is accepted.
- Median gets its own 9px disc **only** from three finishers **and only if nobody finished on
  that second**. Drawing it unconditionally double-draws on odd counts and on n = 2.
- Label widths in the mockups are **estimated from a per-character table**. Live, they must be
  measured — the comment in O says so and travels with the lifted code.
- p95 clipping on the slow tail.

### Low-data states (Idea-P)

- **n = 1** — you are both yourself and the fastest.
- **n = 2** — you and the slowest.
- **n = 3** — you, slowest, median. Median appears here and not before.
- **n = 10** — the full card.
- Your label always tracks you.
- Below 10 plays the copy switches from a percentile to a rank: "You're the **2nd fastest**".
  "You're in the 2nd fastest solve times" does not parse, so those states keep their own frame.
- Note the existing reveal gate, `REVEAL_AFTER_GAMES = 2` in `src/player-stats.ts`, is about
  *your* game count, not today's field. Two different thresholds; don't conflate them.

---

## 4. Open, for the brief to settle

1. **The slowest player reads "top 100% solve times".** Technically true, reads as an insult.
   Needs its own copy.
2. **Time format.** `formatDuration` renders sub-minute as `0m 41s`. The design shortens to
   `41s` to fit the axis. Either the chart diverges from the rest of the screen on purpose, or
   the shared formatter gains a compact mode.
3. **Label widths measured, not estimated** (above).
4. **Caching and cost** of a per-day aggregate read on every completion.
5. **Privacy.** The card exposes the shape of today's field. Low n makes individual times
   identifiable to anyone who knows who played.
6. **Dave's whisker chart** stays parked as the successor, not a rejection — his two questions
   in `docs/work/2026-08-12-stats-polish-brief.md` items 106/107 are still unanswered.

---

## 5. Constraints to carry in

- **Two colours only**: theme accent and foreground. `--accent-soft` (22% accent on surface)
  and `--fg-50` already exist and may be reused. Bold for emphasis. No new shades.
- The live results panel from #311 **stays** — a revert breaches P1. Design forward.
- `docs/INVARIANTS.md` before touching the worker or storage. Storage changes additive only.
- Work branch off `main`. Never commit to `main` or `staging`.
- Review gates: `da-brief` → `planning` → `da-plan` → build → self-review → `da-build` → PR.
