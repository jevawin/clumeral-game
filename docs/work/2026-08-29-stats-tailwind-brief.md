# Brief — the stats panel in Tailwind

Date: 2026-08-29 · Branch: `dev/edit-mode-on-stats` · Asked for by: Jamie

Full brief, all 11 sections. Not a small change: it restyles a whole screen.

**Sign-off on this brief is Jamie alone.** Jamie, 2026-08-29: "Dave doesn't care
about this bit stop asking him." So every section reads `Ack: n/a` rather than
waiting on Dave.

---

## 1. What it is
Settled: Jamie 2026-08-29 (item 7: into #311) · Ack: n/a

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
Settled: Jamie 2026-08-29 (item 13 answered) · Ack: n/a

8. **Not a redesign.** The panel looks the same when this is finished. Any
   change to how it looks is a separate decision, made afterwards in edit mode.
   (assumed — one change at a time, or nobody can tell what broke it)
9. **Only the stats panel on `/solved`.** Those 22 classes are used in
   `src/completion.ts` and nowhere else in `src/`, so nothing else moves.
   (fact, checked 2026-08-29)
10. **Not `/stats`.** That is the analytics dashboard, rendered by the worker
    with its own inline stylesheet. Different thing, same word. (assumed)
11. **Not edit mode's own panel CSS.** It is deliberately sealed off from the
    app's stylesheet and stays that way. (assumed)
12. **No change to the numbers** or how they are worked out. `player-stats.ts` is
    not touched. (assumed)
13. **Do the four section accent colours and the container query have to become
    utilities too?**
    The panel currently sets `--section-accent` per section off a
    `data-stat-block` attribute, and the goes chart uses a container query.
    My rec: yes, all of it, using Tailwind's arbitrary-property syntax on the
    element — e.g. `[--section-accent:var(--color-accent-2)]` and `@container`.
    Why: "all Tailwind" should mean no stylesheet rules left for this panel at
    all, and anything left behind is invisible to edit mode, which is the whole
    reason we are doing this. The cost is a few ugly-looking class names.

## 3. How it works
Settled: Jamie 2026-08-29 (item 18: nearest step) · Ack: n/a

14. **Every state the panel has today survives.** The reveal gate before enough
    games, absent values, an outlier time shown on its own, dark mode, and the
    four coloured sections. (assumed — item 8 says this is not a redesign)
15. **Dark mode needs no thought.** The colour tokens already flip, so a utility
    built on a token flips with it. (assumed)
16. **The goes chart bar keeps its inline width.** It is a computed percentage,
    so it cannot be a class. (assumed — `style="inline-size: N%"` stays)
17. **`data-stat-block` stays as a hook, stops being a styling mechanism.** The
    e2e tests select on it. (assumed)
18. **Exact match, or nearest step on the scale?**
    Some rules use values off Tailwind's scale — `font-size: 1.75rem` is not
    `text-3xl`. Two ways to go:
    (a) arbitrary values, `text-[1.75rem]`, pixel-identical but the class does
        not sit on a scale, so edit mode's − and + cannot step it;
    (b) nearest scale value, `text-3xl`, so every class steps properly, at the
        cost of the panel shifting very slightly.
    My rec: (b), nearest scale value. Why: the whole point is to make the panel
    designable, and a class that cannot be stepped is only half-converted. The
    shifts are small and you are about to redesign it in edit mode anyway. I
    would list every value that moves, in the plan, so nothing changes silently.

    **Answered, Jamie 2026-08-29:** "Nearest". Option (b). Every class must sit
    on a scale so edit mode can step it. The plan lists every value that moves.

## 4. Maths
n/a — confirmed Jamie 2026-08-29. Presentational only. No puzzle generation, no
filtering, and `player-stats.ts` is not touched (item 12).

## 5. State and persistence
n/a — confirmed Jamie 2026-08-29 · Ack: n/a

19. **Nothing new is stored, anywhere.** The panel still reads the player's
    history from `localStorage` through `player-stats.ts`, unchanged. No new
    preference, no URL parameter, no server call. A styling conversion has
    nothing to persist. (confirmed, Jamie 2026-08-29)

## 6. How it fits
Settled: pending · Ack: n/a

20. **Two files carry the work.** The markup is built as template strings in
    `src/completion.ts`; the rules live in `src/tailwind.css`, roughly lines
    500-790, inside `@layer base`. Nothing else in `src/` references those
    classes. (fact, checked 2026-08-29)
21. **The rules are deleted, not left dangling.** Once the utilities are on the
    markup the old rules have no user, and leaving dead CSS is how a stylesheet
    grows to 5 MB. (assumed)
22. **`player-stats.ts`, `screens.ts` and the router are untouched.** This is
    presentation only. (assumed)
23. **The colour tokens in `@theme` are untouched.** All four accents already
    exist; item 13 only stops the `--section-accent` indirection. (assumed)
24. **Four test files select on the class names that are about to disappear.**
    `tests/completion-stats.spec.ts` (29 references), `tests/accent-rotation.spec.ts`,
    `e2e/pages/completion.page.ts` and `e2e/specs/player-stats.spec.ts`.
    So they must select on something else. Two ways:
    (a) give every element the tests need a `data-` attribute, and select on
        that;
    (b) let the tests select on utility classes instead.
    My rec: (a), `data-` attributes. Why: a test that looks for `text-3xl`
    breaks the instant you step that size in edit mode — which is precisely the
    thing this work exists to enable. A `data-` hook says "this is the fastest
    time" and survives any amount of restyling. `data-stat-block` and
    `data-goes-row` already work this way (item 17), so it is the pattern the
    panel already uses, not a new idea.

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
