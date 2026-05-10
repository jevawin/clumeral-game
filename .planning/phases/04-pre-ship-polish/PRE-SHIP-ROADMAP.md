# Phase 04 — Pre-ship design polish (v1.1)

**Goal:** Address pre-ship feedback round (2026-05-10) before merging `new-design` → `staging` → `main`.
**Branch:** `new-design`
**Workflow:** Do one item at a time. Commit + push after each. Re-test in preview between items.
**Source feedback:** WhatsApp review thread (2026-05-10) — full quote in Appendix A below.

> **PLAN TOGETHER, DON'T JUST DO.** Every item: surface decisions, get sign-off, then implement. No autonomous coding before alignment.

---

## Per-item protocol (run between every item)

Each item is self-contained. After finishing one, do this exact sequence before starting the next:

1. **Resolve decisions** for the item (see "Decision needed" / "Open questions" block).
2. **Implement** on `new-design` (current branch — never commit to `main`/`staging`).
3. **Verify** locally (`npm run dev`) or against Cloudflare preview.
4. **Commit** with focused message referencing the item (e.g. `phase 4 item 1: fix sadOcto offscreen regression`).
5. **Push** to `new-design`.
6. **Tick the box** in this file (edit the `[ ]` → `[x]`). Commit + push that edit.
7. **`/clear`** the conversation.
8. **Resume** with: `/gsd-quick read .planning/phases/04-pre-ship-polish/PRE-SHIP-ROADMAP.md and start the next unchecked item`

This file is the source of truth between sessions. Everything needed to resume after `/clear` is captured here — feedback, decisions, files, acceptance criteria.

---

## Items

### [x] 1. Fix sadOcto offscreen regression

**Type:** Bug fix (regression introduced by new-design octopus relocation).
**Severity:** Visible — friend flagged "what happened to the octopus dying animation?"

**Root cause:**
`[data-octo-wrap]` lives at `class="absolute -left-[9999px]"` ([index.html:82](../../index.html)) as offscreen measurement host. `sadOcto()` ([src/octo.ts:356](../../src/octo.ts)) pins via `getBoundingClientRect()` and animates the fall from there → animation plays into the void at `x ≈ -9972px`.

`celebrateOcto()` works only because its lead-in forces `left: 50%` regardless of origin.

**Fix options:**
- (a) Add a visible anchor element on the game screen (e.g. small octo near header), use it as `octo-slot` source.
- (b) Refactor `sadOcto` to fall from a fixed viewport position (e.g. top-center) — ignore measurement host.
- (c) Move `data-octo-wrap` back into visible flow on game screen.

**Decision needed before coding:** which option? Recommend (b) — minimal churn, no new visual element, friend's expectation is "octo dies" not "octo dies from a specific spot".

**Files:** `src/octo.ts` (sadBounce origin logic).
**Acceptance:** Submit incorrect guess → octo visibly falls + bounces + recovers + face cycles X-eyes → round.

---

### [x] 2. Tune winning animation — colour cycle visibility

**Type:** Polish.
**Source:** Friend "did you make the winning animation longer? feels like it." User: "I think it actually got shorter. Need to put the colours back in."

**Current state:**
Colour keyframes EXIST ([src/tailwind.css:139-148](../../src/tailwind.css)):
```css
@keyframes octo-colours { /* 4s loop, 0.5s delay, infinite */ }
```
Octo `.celebrate` class lives ~2.4s (2s fly + 0.4s return). Cycle barely starts before class removed.

**Fix:** speed cycle to ~1.5s loop, drop delay to 0s. Optionally extend `octo-fly` to 3s to give colours room.

**Decision needed:** speed cycle only (preserves 2s fly), or also extend fly to 3s? Recommend speed cycle to 1.2s + keep fly at 2s — addresses "colours invisible" without making animation feel sluggish.

**Files:** `src/tailwind.css` (`@keyframes octo-colours`, `octo-fly` duration if extending).
**Acceptance:** Solve a puzzle → octo cycles through accent → red → blue → purple → accent at least twice during fly.

---

### [x] 3. Inline inequality emphasis (issue #177)

**Type:** UX clarity. Multi-person feedback that `>` `<` `=` symbols are easy to miss.
**Issue:** [#177](https://github.com/jevawin/clumeral-game/issues/177)

**Approach (agreed):**
Inline format with bold + accent colour on operator+value:

> The sum of 1 and 2 is **> 3**

Special-type clues (e.g. "is prime", "is a square") stay as-is — no operator to emphasise.

**Open questions:**
- Use Quicksand 700 (bold) for the operator span, or 600 (semibold) — test which reads cleaner?
- Wrap pattern: append ` <span class="clue-op">> 3</span>` or restructure clue template?
- Check `renderClues` in `src/app.ts` for current clue-type branching.

**Files:** `src/app.ts` (renderClues), `src/tailwind.css` (`.clue-op` utility — accent + bold).
**Acceptance:** Numeric/comparison clues render operator inline + bold + accent. Special clues unchanged. Visual A/B against current style.

---

### [ ] 4. Archive back-link from `/archive/<date>`

**Type:** Navigation gap. Friend: "if you click an archived puzzle, there's no button to go back to stats or archive without completing the puzzle."

**Current state:**
`/archive/<date>` loads game state via router ([src/router.ts:115](../../src/router.ts)). `[data-archive-banner]` shows "Replaying puzzle from <date>" but no back affordance.

**Fix:**
Add back-link inside or beside `[data-archive-banner]`: `← Archive` (or `← Back to archive`). Clicking calls `navigate('/archive')` (or `history.back()` if previous route was archive — pick simpler: always go to `/archive`).

**Files:** `src/app.ts` (renderClues archive-banner section), `index.html` if banner template moves there, `src/tailwind.css` (link style — already exists via `.link`).
**Acceptance:** Land on `/archive/<date>` mid-puzzle → tap back-link → arrive at `/archive` listing. Banner remains visible while puzzle in progress.

---

### [ ] 5. Restore accent-colour picker in top-corner menu

**Type:** Restore feature removed in v1.1.
**Source:** Friend asked from start; user originally removed; multiple people asked → restore for ship.

**Current state:**
Menu has only theme toggle + feedback + how-to-play ([index.html:155-167](../../index.html)). v1.0 had accent colour picker (in `src/colours.ts`).

**Fix:**
Re-add colour picker entry in menu. Likely a sub-row of swatches or a "Theme colour" item that opens a small palette. Match v1.0 mechanism if it still works (`src/colours.ts` likely intact — confirm).

**Open questions:**
- Same colour set as v1.0, or refreshed palette to match new design system?
- Inline swatches in menu, or push into separate modal/sheet?
- Project constraint in CLAUDE.md says "green accent only" — that constraint is now relaxed by this decision. Update PROJECT.md / CLAUDE.md accordingly.

**Files:** `index.html` (menu markup), `src/colours.ts` (verify still functional), `src/app.ts` (menu wiring), `src/tailwind.css` (swatch styles), `CLAUDE.md` + `.planning/PROJECT.md` (relax single-accent constraint).
**Acceptance:** Open menu → see colour picker → tap swatch → accent updates everywhere (octo, links, buttons, focus rings) → preference persists across reload.

---

### [ ] 6. Footer hidden behind iOS Safari bottom toolbar

**Type:** Mobile layout bug. Tested on iPhone Safari (2026-05-10).
**Severity:** "Made with ❤ by Jamie & Dave" footer sits under the URL/search bar at the bottom of the screen — invisible until the bar collapses on scroll.

**Likely cause:**
Layout uses `100vh` / `min-h-screen` somewhere. On iOS Safari, `100vh` = the *largest* viewport (toolbar collapsed), not the currently visible area. Bottom-pinned footer ends up behind the toolbar.

**Fix options:**
- (a) Replace `100vh` / `min-h-screen` with `100dvh` (dynamic — resizes as toolbar shows/hides) or `100svh` (small — always visible).
- (b) Add `padding-bottom: env(safe-area-inset-bottom)` to the wrapper that contains the footer.
- (c) Both — `100dvh` for the layout height, `env(safe-area-inset-bottom)` padding belt-and-braces.

**Decision needed:** confirm fix approach. Recommend (c) — Tailwind has `min-h-dvh` (Tailwind 4) and `pb-[env(safe-area-inset-bottom)]` works inline. Cheap insurance.

**Files:** `index.html` (root wrapper height class), possibly `src/tailwind.css` if utility needs adding.
**Acceptance:** On iPhone Safari with toolbar visible, footer fully on screen above the URL bar. No regression on desktop or Android Chrome.

---

## Out of scope (next milestone)

Tracked separately:
- Definitions amend — issue #155
- Add Fibonacci — issue #81
- Remove cube — needs new issue
- Highlight violated clues — issue #196
- Remove redundant clues — issue #193
- Archive in top-corner menu (under consideration) — issue #199
- Wider menu redesign — implicit in #199 discussion

---

## Ship checklist (after items 1–6)

- [ ] All 6 items committed + pushed
- [ ] Cloudflare preview smoke-tested on mobile + desktop
- [ ] DA review (per `docs/DA-REVIEW.md`)
- [ ] Self-review (per `docs/SELF-REVIEW.md`)
- [ ] Open PR `new-design` → `staging`
- [ ] Verify on staging preview
- [ ] User merges `staging` → `main` on GitHub
- [ ] Post-merge sync + cleanup (per `docs/GIT-WORKFLOW.md`)
- [ ] Run `/gsd-complete-milestone` to archive v1.1

---

## Appendix A — WhatsApp feedback verbatim (2026-05-10)

**Friend:**
> I like that you can switch between stats and the puzzle and that the inequality and equal signs are big. Did you make the winning animation longer? It feels like it, which is good.
>
> What happened to the octopus dying animation? If possible I would like the options to change colour in the top corner menu with the other options.
>
> Could you perhaps indent the inequality/equals line, so users are less likely to miss the symbols?
>
> If you click on an archived puzzle, there's no button to go back to the stats or archive without completing the puzzle. Could an archive option in the top corner menu, as well as it being at the end solve this?
>
> Other things like definitions, removing cube and adding Fibonacci, highlighting violated clues, removing redundant clues, etc. I'm gathering they will be a different update? This one is getting the main thing done.

**User reply:**
> Winning animation: I think it actually got shorter. Need to put the colours back in.
> Octopus dying: should still be there, I'll throw it back in.
> Indent inequality: maybe with a border, or bolder font. Test both.
> Archive back: should go back to where you were before.
> Archive in menu: I took it out because it felt like an "after you played" thing. Tweak menu first.

**Friend follow-up:**
> Multiple feedback that inequality signs are easy to miss. Don't change to words. If indenting isn't a good look, could they be on the same line as the text? Special-type clues stay as they are.

**User:**
> Same line, still green/theme colour and bold? "The sum of 1 and 2 is **> 3**"

**Friend:**
> Yes, if you think that would be better or more noticeable than indenting.

---

## Appendix B — Resume cheatsheet

After `/clear`, paste:

```
Read .planning/phases/04-pre-ship-polish/PRE-SHIP-ROADMAP.md.
Start the next unchecked item. Surface its decisions for sign-off, then implement.
Branch: new-design. Commit + push after, tick the box.
```

Branch state expected: `new-design`, working tree clean (or only this roadmap file modified).
