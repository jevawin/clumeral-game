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
Settled: Jamie 2026-08-29 (item 24: data labels) · Ack: n/a

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

    **Answered, Jamie 2026-08-29:** "data labels". Option (a). Every element the
    tests need gets a `data-` attribute and the four test files select on those.

## 7. How it looks
Settled: Jamie 2026-08-29 (item 27: option b) · Ack: n/a

25. **Identical, apart from the small shifts item 18 already allows.** Off-scale
    values round to the nearest step: `border-radius: 0.3125rem` becomes
    `rounded-sm` (0.25rem), `padding-block: 0.1875rem` becomes `py-0.5`
    (0.125rem). Each one is a fraction of a millimetre. (assumed)
26. **Every one of those roundings is listed in the plan** before any code is
    written, so nothing moves without being seen first. (assumed — item 18)
27. **Three font sizes are FLUID, and that is a real decision.**
    The two big figures use `clamp(1.375rem, 7vw, 1.75rem)` and
    `clamp(1.25rem, 6.5vw, 1.75rem)`; the goes chart uses
    `clamp(0.75rem, 16cqw, 1rem)`, which scales with its container rather than
    the screen. These grow and shrink smoothly with the display, which is why a
    big number fits a small phone and still looks big on a tablet. Tailwind has
    no scale step for a clamp. Three ways:
    (a) keep them as arbitrary values, `text-[clamp(1.375rem,7vw,1.75rem)]` —
        looks exactly the same, but the class sits on no scale, so − and + do
        nothing to it, which is the half-converted outcome item 18 rejected;
    (b) fixed steps with responsive variants, e.g. `text-2xl sm:text-3xl` —
        every class steps, it is the ordinary Tailwind mechanic, and the size
        jumps at one breakpoint instead of gliding;
    (c) add named type tokens to `@theme` (`--text-hero`), giving `text-hero` as
        a real utility — a variable, like the colours, but a scale of one, so
        − and + still have nowhere to go.
    My rec: (b). Why: Jamie's own steer on item 13 was "use the same mechanic as
    the rest of the site", and responsive steps are that mechanic. Everything
    stays steppable in edit mode. The cost is that the hero number changes size
    in one jump rather than gliding, and on a very narrow phone it may want a
    smaller base step than the current floor.

    **Answered, Jamie 2026-08-29:** "use tailwind native don't pin exact".
    Option (b). No arbitrary values anywhere on this panel. The three fluid
    sizes become fixed steps with responsive variants, and the container query
    goes with them if nothing else needs it.

## 8. Copy and wording
n/a — confirmed Jamie 2026-08-29 · Ack: n/a

28. **Not one word changes.** Every heading, label, unit and screen-reader
    phrase in `src/completion.ts` is left exactly as it is. This is a styling
    conversion; the copy was settled in the stats briefs of 11 and 12 August.
    (confirmed, Jamie 2026-08-29)

## 9. Accessibility
Settled: Jamie 2026-08-29 (accepted all recommendations) · Ack: n/a

29. **The screen-reader wiring is untouched.** Seventeen `aria-` attributes and
    two `sr-only` spans in `src/completion.ts` stay exactly as they are. Only
    the presentation classes change. (assumed)
30. **`sr-only` is already a Tailwind utility**, so it survives the conversion
    unchanged. (fact)
31. **Contrast is unaffected.** The four accents keep their existing tokens, all
    at the same lightness, and `tests/palette-contrast.spec.ts` already covers
    all four. Item 13 removes an indirection, not a colour. (assumed)
32. **Text still respects the reader's own font size.** Everything is in `rem`
    today and Tailwind's `text-*` steps are `rem` too, so a larger system font
    still scales the panel. (fact)
33. **The narrow-phone size of the big figures needs a decision.**
    Today the hero figure never goes below 1.375rem (22px) and never above
    1.75rem (28px), gliding between them with the screen width. On fixed steps
    the nearest choices are `text-2xl` (1.5rem / 24px) and `text-xl`
    (1.25rem / 20px).
    My rec: `text-xl` on the smallest screens, stepping to `text-3xl`
    (1.875rem / 30px) from the `sm` breakpoint up. Why: it is never smaller than
    today's floor by enough to matter for reading, and going the other way —
    starting at 24px — is WIDER than today's floor on a 320px phone, which is
    where a long figure would overflow its box. Overflow is the accessibility
    risk here, not size.
    The alternative is `text-2xl` at the base, which is closer to today's look
    on a mid-size phone but tighter on a small one.

    **Answered, Jamie 2026-08-29:** "fine, we'll check accessibility once we
    have a final design". `text-xl` at the base, `text-3xl` from `sm` up.
34. **A full accessibility pass is DEFERRED, on purpose, and is still owed.**
    Jamie, 2026-08-29, as above. This conversion is signed off on the basis that
    it changes nothing about the screen-reader experience and only moves type
    sizes slightly. It is NOT an accessibility review of the finished stats
    panel, which cannot happen until the redesign that follows it is done.
    Carried into §11 as a deliverable so it is not quietly forgotten.

## 10. Analytics
n/a — confirmed Jamie 2026-08-29 · Ack: n/a

35. **No events added, and none removed.** Nothing about the panel's behaviour
    changes, so there is nothing new to count, and the events already fired
    around `/solved` are untouched. Adding an event here would only pollute a
    baseline. (confirmed, Jamie 2026-08-29)
## 11. Done / test plan
Settled: Jamie 2026-08-29 (item 41: one-off) · Ack: n/a

36. **The four test files move to `data-` labels** and keep passing:
    `tests/completion-stats.spec.ts`, `tests/accent-rotation.spec.ts`,
    `e2e/pages/completion.page.ts`, `e2e/specs/player-stats.spec.ts`. (item 24)
37. **The old rules are gone.** A test asserts that none of the 22 class names
    appears in the built stylesheet, so dead CSS cannot creep back. (assumed)
38. **The plan lists every value that moves** before code is written, and the
    pull request repeats the list. (items 18, 26)
39. **Jamie looks at it on the phone**, at `/solved?demo=stats`, with edit mode
    open — which is the acceptance test that matters, because the point is that
    the panel becomes designable. (assumed)
40. **The deferred accessibility pass is written into `CLAUDE.md`'s Outstanding
    actions**, naming item 34, so it surfaces when the redesign lands. (assumed)
41. **How do we PROVE it still looks the same?**
    (a) a one-off comparison: record every element's computed styles before the
        change and again after, and put the differences in the pull request —
        no new test infrastructure, throwaway, proves it once;
    (b) a permanent visual snapshot test in Playwright, comparing screenshots of
        `/solved?demo=stats` on every run;
    (c) a permanent computed-style test, asserting the panel's final styles
        against a committed fixture.
    My rec: (a). Why: the panel is about to be redesigned in edit mode, so any
    permanent baseline would be obsolete within days and would fail on every
    deliberate change — noise, not safety. Screenshot tests also need a baseline
    per browser and per platform, and this box is arm64 while CI is not.
    The cost: after the one-off run, nothing stops a later change drifting the
    styles again.

    **Answered, Jamie 2026-08-29:** "One off". Option (a). No permanent visual
    or computed-style baseline. The comparison is run once and reported in the
    pull request.

