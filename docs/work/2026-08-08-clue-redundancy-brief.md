# Brief — remove redundant clues from generated puzzles

Date: 2026-08-08 · Branch: `dev/clue-redundancy` · Author: Claude (clumeral dev bot)

Status: in progress — section 1 asked.

## Background evidence (gathered 2026-08-08, before the brief)

Measured on 100 live `/api/puzzle/random` puzzles and all 154 archive puzzles, plus a
local simulation of 2,000 generated puzzles. Answers verified against `/api/guess` and
`/api/puzzle/:num/solution`.

- Clue counts today (archive, 154 puzzles): 4 clues 1.3%, 5 clues 62%, 6 clues 34%,
  7 clues 2% (#33, #49, #144).
- Local simulation of 2,000 puzzles shows the generator can also emit **8- and 9-clue
  puzzles** (0.2% and 0.3%) — rarer than 7 but real, and none has happened yet by luck.
- 77% of random puzzles contain at least one clue that can be deleted with the puzzle
  still having exactly one answer. 27% of all clues are individually droppable.
- Average clues needed 4.1 against 5.3 given.
- Redundancy is concentrated in the early clues (first two clues redundant ~46% of the
  time; fifth 6%) and in inequality clues ("greater/less than" 38% redundant, "is exactly"
  13%).
- Simulated trimming sweep (drop any clue whose removal still leaves one answer):
  resulting counts 1 clue 0.1%, 2 clues 4.9%, 3 clues 26%, 4 clues 42%, 5 clues 22%,
  6 clues 4.0%, 7 clues 0.1%. **A sweep alone does not eliminate 7-clue puzzles.**
- Effect on clue mix (Dave's concern): "is exactly" clues rise 41% → 51%; the
  prime/square/cube/triangular/Fibonacci family rises 21% → 23%. Real but modest.
- Drop order barely matters: dropping earliest-first vs latest-first gives near-identical
  distributions.

## Ledger

| Section | State |
|---|---|
| 1. What it is | settled Dave 2026-08-08 · Ack: Jamie pending |
| 2. Out of scope | asked 2026-08-08 |
| 3. How it works | not started |
| 4. Maths | not started |
| 5. State & persistence | not started |
| 6. How it fits | not started |
| 7. How it looks | not started |
| 8. Copy & wording | not started |
| 9. Accessibility | not started |
| 10. Analytics | not started |
| 11. Done / test plan | not started |

## 1. What it is
Settled: Dave 2026-08-08 (accepted both recommendations) · Ack: Jamie pending

1. The problem: the generator picks clues by how much each one narrows the field, never
   checking whether a clue is still needed once later clues land. Result: 77% of puzzles
   carry at least one clue that adds nothing, and the count drifts up to 7 (and could
   reach 9). (assumed — measured above)
2. Who it is for: players, who read clues that do no work; and the game screen, which
   Dave reports does not lay out nicely beyond 6 clues. (assumed — Dave 2026-08-08)
3. Why now: the redundancy audit surfaced it, and no puzzle already published changes —
   KV is write-once, so this only affects puzzles generated from the merge date onwards.
   (assumed — archive integrity rule in docs/ARCHITECTURE.md)
4. Scope of the change: the daily puzzle and the random puzzle both, since both call the
   same generator. QUESTION — or dailies only?
   My rec: both. Why: they share `runFilterLoop`, splitting them means two behaviours to
   reason about, and random puzzles are where players see the most puzzles.
5. Success looks like: every clue in a published puzzle is load-bearing, and every puzzle
   has between 4 and 6 clues. QUESTION — is "no clue is redundant" the goal, or "no more
   than 6 clues" the goal?
   My rec: both, with the clue count as the hard rule and no-redundancy as the method.
   Why: Dave's screen-fit problem is a hard constraint; redundancy is a quality one.

   **Answers (Dave, 2026-08-08):** 4 — both daily and random. 5 — both goals, clue count
   as the hard rule.

## 2. Out of scope
Settled: pending · Ack: pending

6. Puzzles already in storage are never rewritten, including the three 7-clue ones
   (#33, #49, #144). (assumed — KV is write-once, docs/ARCHITECTURE.md)
7. No change to clue wording, no new clue types, no change to the six clue families.
   (assumed — separate concern, and §8 covers wording if it comes up)
8. The 15–40% narrowing band that picks each clue stays exactly as it is. The sweep works
   downstream of it. (assumed — retuning the band is its own maths change with its own
   consequences)
9. Not solving the screen-fit problem by changing the game screen layout instead.
   (assumed — Dave's constraint is that puzzles fit the current design)
10. No difficulty levels, no difficulty tuning, no per-day difficulty curve.
    (assumed — much bigger piece of work)
11. The cron pre-generates tomorrow's puzzle the day before (`src/worker/daily-puzzle.ts`,
    #257). So for up to one day after the merge, the live daily puzzle may still be an
    old-style one. QUESTION — accept that one-day lag, or delete the pre-generated entry
    by hand so it regenerates under the new rules?
    My rec: accept the lag. Why: deleting a live storage entry is a manual production step
    for a one-day cosmetic gain, and write-once is the rule that protects the archive.
