# Brief — the stats panel in Tailwind

Date: 2026-08-29 · Branch: `dev/edit-mode-on-stats` · Asked for by: Jamie

Full brief, all 11 sections. Not a small change: it restyles a whole screen.

---

## 1. What it is
Settled: pending · Ack: pending

1. **The problem.** The stats panel on `/solved` is styled with hand-written CSS
   component classes — `stat-block`, `stat-line__value`, `goes-row__fill` and
   about 22 others — living in `@layer base` in `src/tailwind.css`. No utilities,
   no `@apply`. (fact, checked 2026-08-29)
2. **Why that is wrong.** The project brief says the entire UI is rebuilt in
   Tailwind. This screen drifted. Jamie, 2026-08-29: "All tailwind that was
   always the brief idk why things keep drifting". (fact)
3. **What it costs today.** Edit mode cannot design this screen. Its chips are
   real class names but not Tailwind ones, so there is nothing to step with − and
   +, and the tool built specifically for this page is useless on it. (fact)
4. **Who it is for.** Jamie and Dave, designing the stats panel. No player-facing
   change is intended at all. (assumed)
5. **Why now.** The stats redesign is open as PR #311 and the panel is being
   worked on right now. Converting after it merges means doing the same design
   twice. (assumed)
6. **Where the work lands.** The markup is built in `src/completion.ts`; the
   rules are in `src/tailwind.css`. Both are on `dev/stats-tweaks` (PR #311), NOT
   on main. (fact)
7. **Does this go INTO #311, or after it?**
   My rec: into #311, on `dev/stats-tweaks`. Why: the two touch the same markup
   and the same CSS, so doing them separately guarantees a painful conflict and
   a second round of design. The cost is that #311 gets bigger and stays open
   longer.

## 2. Out of scope
Settled: pending · Ack: pending

## 3. How it works
Settled: pending · Ack: pending

## 4. Maths
n/a — presentational only, no puzzle generation or filtering. Awaiting a word back.

## 5. State and persistence
Settled: pending · Ack: pending

## 6. How it fits
Settled: pending · Ack: pending

## 7. How it looks
Settled: pending · Ack: pending

## 8. Copy and wording
Settled: pending · Ack: pending

## 9. Accessibility
Settled: pending · Ack: pending

## 10. Analytics
Settled: pending · Ack: pending

## 11. Done / test plan
Settled: pending · Ack: pending
