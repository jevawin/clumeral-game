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
| 2. Out of scope | settled Dave 2026-08-08 · Ack: Jamie pending |
| 3. How it works | asked 2026-08-08 |
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
Settled: Dave 2026-08-08 (accepted all recommendations, incl. 11 accept the lag) · Ack: Jamie pending

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

    **Answer (Dave, 2026-08-08):** 11 — accept the lag.

## 3. How it works
Settled: pending · Ack: pending

Second simulation, 3,000 puzzles, running the full proposed algorithm (trim, then reject
and regenerate until the count is in range). Results referenced by the items below:

- Both drop orders converge once the reject-and-regenerate loop is in place:
  earliest-first gives 4 clues 59.6% / 5 clues 34.4% / 6 clues 6.0%; latest-first gives
  59.0% / 35.0% / 6.0%.
- Clue mix after: "is exactly" 46% (41% today), prime/square/cube family 26% (21% today).
- Regenerations: 68% of puzzles pass on the first attempt, average 0.46 extra attempts,
  worst case seen 5. No puzzle failed to produce a result within 50 attempts.

12. The sweep: after the generator produces its clues, walk them and drop any clue whose
    removal still leaves exactly one possible answer. Repeat until nothing more can be
    dropped. (assumed — this is the mechanism, and it is what was measured)
13. Drop order does not matter and is not worth a rule. Earliest-first and latest-first
    give the same distribution and the same clue mix, to within noise. (assumed — measured
    above)
14. If the trimmed puzzle falls outside the allowed clue range, discard it and generate
    again from a deterministically derived next seed, then trim again. (assumed — the only
    way to make the range a guarantee rather than a statistic)
15. Retry cap: 50 attempts. If every attempt somehow fell outside the range, publish the
    trimmed candidate closest to the range rather than failing. (assumed — the daily cron
    must always produce a puzzle; never hit in 3,000 simulated puzzles, worst case was 5)
16. QUESTION — what is the allowed clue range? Jamie proposed 4, 5 or 6. Dave said 2-clue
    puzzles could be good for variation, depending how many happen. Measured: with no
    minimum, 4.9% come out at 2 clues and 26.3% at 3.
    My rec: 4 to 6, as Jamie proposed. Why: 2-clue puzzles at 1-in-20 would be a novelty,
    but 3-clue at 1-in-4 is every fourth day, and both take away the sense of working
    through a body of evidence. **Tie-break if they disagree: Dave, this is gameplay maths.**
17. Consequence to accept knowingly: puzzles get shorter and therefore harder. Today's
    daily is 5 clues 62% / 6 clues 34%; after this it is 4 clues 60% / 5 clues 34% /
    6 clues 6%. Every clue will be load-bearing, so there is no slack for a player who
    misreads one. (assumed — flagged, not hidden)
18. The generator stays deterministic: the same seed always produces the same puzzle,
    retries included. (assumed — the random-puzzle token stores only the seed and re-runs
    the generator to check a guess, and the daily puzzle is seeded from its date)
19. QUESTION — the deploy-moment wrinkle. A random puzzle's token holds only the seed;
    when the player guesses, the worker re-runs the generator from that seed to work out
    the answer. If the new version goes live while someone has a random puzzle open, their
    clues came from the old code but their guess is checked against the new code's answer,
    so a correct guess can be marked wrong. Daily puzzles are unaffected — their answer is
    stored with the clues.
    My rec: accept it. Why: the window is the few minutes around a deploy, it affects only
    random puzzles in progress, and the fixes (versioning the token, or putting the answer
    inside it) are permanent complexity plus a new way to leak the answer, for a one-off.
