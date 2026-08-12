# Brief — stats panel polish, and a standard page margin

Date: 2026-08-12 · Branch: `dev/stats-tweaks` (brief 8) · Author: Claude (clumeral dev bot)

Jamie's tweak list of 2026-08-12, after seeing the redesign on the preview at
https://dev-stats-tweaks-clumeral-game.jevawin.workers.dev/solved?demo=stats

Follows [`2026-08-11-stats-redesign-brief.md`](2026-08-11-stats-redesign-brief.md) and its
plan, both of which are built and on this branch. Item numbers here start again at 1 and are
append-only; where an item reverses a redesign decision it says so.

**Short form: sections 1, 2, 3, 7, 8, 9, 11 — proposed, awaiting Jamie.** Sections 4
(maths), 5 (state) and 10 (analytics) are n/a: nothing here changes a number, stores
anything, or sends an event. Section 6 (how it fits) is folded into section 3, because the
only module question is which files carry the margin.

---

## 1. What it is
Settled: pending · Ack: pending

1. Seven presentational changes, six to the completion panel and one to page margins
   site-wide. Jamie's own list, given after seeing the built redesign. (assumed)
2. **Nothing about what is counted changes.** No figure's arithmetic moves, nothing new is
   stored, no event is sent. Every change is markup, CSS, copy or an icon. (assumed)
3. Why now: the redesign is on the preview and unmerged, so these land in the same pull
   request rather than as a follow-up. (assumed)

## 2. Out of scope
Settled: pending · Ack: pending

4. Dave's alternative design stays parked, as agreed on 2026-08-11. (assumed)
5. The goes chart keeps its shape, its `6+` tail and its wording. (assumed)
6. Nothing about score saving appears on this panel, in any mode — unchanged from the
   redesign. (assumed)

## 3. How it works
Settled: pending · Ack: pending

### The margin

7. `/play` uses 16px side padding (`px-4`) and no maximum width. `/welcome` and `/solved`
   use 24px (`px-6`) inside a container capped at 390px. The Worker pages `/archive` and
   `/stats` already use 16px. So the change is: `/welcome` and `/solved` drop to 16px, and
   nothing else moves. (assumed)
8. **Keep the 390px cap on `/welcome` and `/solved`, or drop it so they run full width like
   `/play`?**
   My rec: keep it. Why: on a phone the cap never bites — a 390px screen at 16px padding
   gives 358px of content on all three screens, which is the match Jamie is asking for. The
   cap only does anything on a tablet or desktop, where a full-width completion panel would
   stretch a two-column layout across 1000px. Dropping it is a different change from the one
   asked for, and a bigger one.

### The panel

9. The Time box's "Best" label becomes **"Fastest"**. The 1-go and Plays boxes' "Best"
   becomes **"Streak"**. The "Current" labels are untouched. (assumed)
10. A Lucide `flame` icon goes in front of the fastest time and both streak numbers — three
    flames, none on the "Current" figures. Same colour as the number it precedes, which is
    `--color-accent-best`. (assumed)
11. Every font on the panel changes from Inconsolata to the body font, Quicksand, numbers
    included. (assumed — but see 24 for how far "every" reaches)
12. The Average block goes, and average time and average goes return as rows inside All
    time. This reverses redesign items 67, 72 and 84. (assumed)
13. The boxes around the three bests lose their background, border and offset shadow. The
    three-column layout, the titles, the icons and the pairs all stay. (assumed)
14. Nothing returns that redesign item 84 removed other than the two averages — the fastest
    first-go win stays deleted, because "Fastest" in the Time box is now the same idea told
    better. (assumed)

## 4. Maths
n/a — no figure's arithmetic changes.

## 5. State & persistence
n/a — nothing is stored or read.

## 6. How it fits
Folded into section 3. Files touched: `index.html` and `src/welcome.ts` for the margin;
`src/completion.ts`, `src/tailwind.css` and `public/sprites.svg` for the panel.

## 7. How it looks
Settled: pending · Ack: pending

*(to be written)*

## 8. Copy & wording
Settled: pending · Ack: pending

*(to be written)*

## 9. Accessibility
Settled: pending · Ack: pending

*(to be written)*

## 10. Analytics
n/a — presentational only, no event of any kind.

## 11. Done / test plan
Settled: pending · Ack: pending

*(to be written)*
