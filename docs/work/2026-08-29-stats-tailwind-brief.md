# Brief — the stats panel in Tailwind

Date: 2026-08-29 · Branch: `dev/edit-mode-on-stats` · Asked for by: Jamie

Full brief, all 11 sections. Not a small change: it restyles a whole screen.

**Sign-off on this brief is Jamie alone. `Override: Jamie 2026-08-29`** —
"Dave doesn't care about this bit stop asking him." Recorded as an override, not
as consent: Dave was never asked and has not agreed to anything here. That
includes §4, which is nominally Dave's section and was closed by Jamie. No maths
is involved, so the substance is safe, but the record should say what happened.

---

## 1. What it is
Settled: Jamie 2026-08-29 (item 7: into #311) · Override: Jamie 2026-08-29

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
Settled: Jamie 2026-08-29 (item 13 answered) · Override: Jamie 2026-08-29

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
Settled: Jamie 2026-08-29 (item 18: nearest step) · Override: Jamie 2026-08-29

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
n/a — confirmed Jamie 2026-08-29 · Override: Jamie 2026-08-29

19. **Nothing new is stored, anywhere.** The panel still reads the player's
    history from `localStorage` through `player-stats.ts`, unchanged. No new
    preference, no URL parameter, no server call. A styling conversion has
    nothing to persist. (confirmed, Jamie 2026-08-29)

## 6. How it fits
Settled: Jamie 2026-08-29 (item 24: data labels) · Override: Jamie 2026-08-29

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
Settled: Jamie 2026-08-29, RE-SETTLED after review (item 56: one fixed
`text-3xl`; item 27's answer is void) · Override: Jamie 2026-08-29

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
n/a — confirmed Jamie 2026-08-29 · Override: Jamie 2026-08-29

28. **Not one word changes.** Every heading, label, unit and screen-reader
    phrase in `src/completion.ts` is left exactly as it is. This is a styling
    conversion; the copy was settled in the stats briefs of 11 and 12 August.
    (confirmed, Jamie 2026-08-29)

## 9. Accessibility
Settled: Jamie 2026-08-29 (accepted all recommendations) · Override: Jamie 2026-08-29

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
n/a — confirmed Jamie 2026-08-29 · Override: Jamie 2026-08-29

35. **No events added, and none removed.** Nothing about the panel's behaviour
    changes, so there is nothing new to count, and the events already fired
    around `/solved` are untouched. Adding an event here would only pollute a
    baseline. (confirmed, Jamie 2026-08-29)
## 11. Done / test plan
Settled: Jamie 2026-08-29 (item 41: one-off) · Override: Jamie 2026-08-29

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


---

## da-brief review — 2026-08-29

Fresh-context review, verdict **not ready for planning**. Six High and seven
Medium findings. The serious ones are that items 13 and 27 rest on claims about
the code that are **wrong**, and Jamie settled §7 on that basis. Every claim
below was re-checked by hand before being written down.

### Confirmed true, and the brief was wrong

42. **`sm:` variants do not exist in edit mode's catalogue.** The generated class
    list has 23,183 entries and **not one contains a colon**. `text-xl` and
    `text-3xl` are both there; `sm:text-3xl` is not. So item 27's whole reason
    for choosing option (b) — "everything stays steppable" — is false: a
    responsive variant is exactly as unsteppable as the arbitrary value it was
    chosen over. Worse, `families.ts` treats an unknown class as fighting with
    nothing, so on a wide screen stepping the base size would leave `sm:text-3xl`
    winning and the tap would appear to do nothing.
43. **The container query is not on the stats panel.** `container-type` and
    `16cqw` appear once each, at `src/tailwind.css:734` and `:769`, and both
    belong to **`.digit-box`** — the clue boxes on `/play` and the how-to-play
    demo on `/welcome`. Items 13 and 27 said the goes chart used them. A planner
    acting on that would have restyled two player-facing screens, breaking items
    8 and 9. `.digit-box` is explicitly OUT OF SCOPE.
44. **There are two fluid sizes on the panel, not three.**
    `clamp(1.375rem, 7vw, 1.75rem)` and `clamp(1.25rem, 6.5vw, 1.75rem)`.
45. **Item 33's sizes shrink the hero figure by about a quarter on every real
    phone.** The `sm` breakpoint is Tailwind's default 640px and the page column
    is capped at 480px, so `sm:` never fires on a phone. Today the hero is 7vw
    capped at 28px — about 27px on a 390px iPhone. Item 33 would make it
    `text-xl`, 20px. Item 8 promised the panel would look the same and item 25
    called the shifts "a fraction of a millimetre". This one is not.
46. **The panel already has its own breakpoint, and the brief never mentioned
    it.** `@media (min-width: 22.5rem)` at `src/tailwind.css:622` stacks the
    streak columns below 360px. Tailwind's `sm` is 640px, so using it there
    would leave those columns stacked on every phone — a visible layout change.
47. **Three test assertions read the stylesheet as text, so `data-` labels do
    not save them.** `accent-rotation.spec.ts` matches the
    `[data-stat-block]` accent rules and `.stat-col__label` by regex;
    `completion-stats.spec.ts` does the same at lines 317 and 562, and line 318
    uses a non-null assertion, so deleting `.stat-line` makes it **throw**
    rather than fail. Item 37 also directly contradicts those tests, which
    require some of the same rules to be present.
48. **The panel's text colour is set once, on the container, to fix a shipped
    dark-mode bug.** `[data-completion-panel] { color: var(--color-text) }` at
    `src/tailwind.css:527`. The comment records that seven elements were once
    coloured individually, the eighth was missed, and it vanished on the dark
    background. Item 15's "dark mode needs no thought" is wrong: moving to
    per-element utilities re-opens exactly that bug, invisibly in light mode.
49. **Edit mode is not on `dev/stats-tweaks`.** `src/edit-mode/` exists only on
    `dev/edit-mode-roundtrip` and on this branch. So item 39's acceptance test
    cannot be run on the branch item 7 nominates, and this brief file is not on
    that branch either.
50. **`opacity-12` is not in the catalogue** (`opacity-10` and `opacity-15`
    are), and the goes bar's radius is exactly half its height — a pill, so
    `rounded-full` is exact and item 25's `rounded-sm` would square the ends.
51. **`.stat-col`'s 1.5px border deliberately matches the play screen's undo and
    reset controls** (`src/tailwind.css:626`). Rounding it to 1px or 2px breaks
    a match the comment says is intentional, and the other users are out of
    scope.
52. **Item 1 overstated the case.** `goesChart()` already ships
    `class="list-none p-0 m-0"`, and `src/tailwind.css`'s own header documents
    component classes for "dense markup where utilities would balloon HTML" as
    a deliberate exception. Converting is still a fair call — Jamie's call — but
    it is re-taking a documented decision, not correcting an oversight.
53. **The 22 class names are still not listed anywhere**, and the markup carries
    24: `stat-block` and `stat-note` appear in `src/completion.ts` with no CSS
    rule at all. Item 37's test would assert the absence of names that were
    never in the stylesheet.
54. **`docs/DESIGN-SYSTEM.md` documents these class names** and is already stale.
    It needs updating; item 40 only covers `CLAUDE.md`.
55. **The Dave override is recorded in the wrong form.** Every section reads
    `Override: Jamie 2026-08-29`; the gate wants `Override: Jamie 2026-08-29`. §4 is Dave's
    section and was closed by Jamie alone. No maths is involved, so the
    substance is fine, but the record should say what happened.

### Reopened, and needing Jamie

56. **§7 REOPENED — how do the two fluid figures get their size?** Item 27's
    answer is void: finding 42 kills its reasoning and finding 45 prices it
    honestly at 27px → 20px on a normal phone. Real options now:
    (a) one fixed step, no variant — `text-3xl` (30px) everywhere. Steppable in
        edit mode, within 2px of today on a phone, but bigger than today on a
        320px screen, where overflow is the risk;
    (b) keep the two `clamp()` values as arbitrary classes — pixel-identical,
        not steppable, and item 27 already rejected arbitrary values;
    (c) add a named type token to `@theme`, e.g. `--text-hero`, giving
        `text-hero` — one word to change, in the catalogue, but a scale of one,
        so − and + still have nowhere to go.
    My rec: (a). Why: it is the only one edit mode can actually step, which is
    the entire purpose of this work, and 30px against today's 27px is a change
    Jamie will see and can then tune with the tool in minutes. On a 320px phone
    it is 3px larger than today's floor, so the plan must check the longest
    figure still fits.

    **Answered, Jamie 2026-08-29:** "30". Option (a). `text-3xl` on both fluid
    figures, no responsive variant, no arbitrary value. §7 is settled again on
    this basis; item 27's answer is void and replaced by this one. The plan must
    check the longest figure still fits a 320px screen.
57. **§1 item 7 REOPENED — which branch?** Finding 49. Options: build on
    `dev/edit-mode-on-stats` and cherry-pick the conversion into #311 without
    edit mode; or land edit mode's own pull request first and rebase. Needs a
    decision before planning.
58. **§3 NEW QUESTION — where does the panel's text colour live?** Finding 48.
    My rec: keep one colour class on the panel container and let it inherit,
    exactly as the CSS does now, rather than colouring each element. It is one
    utility on one element and it preserves the guard that stopped the bug.
59. **Item 25's rounding list is reopened** and must be completed in the plan,
    covering at least: the pill radius (finding 50), the 1.5px border (51),
    `opacity-12` (50), the `1.25rem 1fr 2.25rem` grid, and the 22.5rem
    breakpoint (46).

### Settled after the review

60. **§1 item 7 RE-SETTLED — build here, copy the conversion into #311.**
    Jamie, 2026-08-29: "Your rec." The work happens on
    `dev/edit-mode-on-stats`, which is the only branch with both the stats panel
    and edit mode, so item 39's acceptance test can actually be run. The
    conversion commits are then cherry-picked onto `dev/stats-tweaks` for #311,
    carrying this brief file with them. Edit mode never enters #311, so that
    pull request stays a stats change rather than dragging 61 files of tooling.
    The plan must keep the conversion commits clean and separate from any
    edit-mode commit, or the cherry-pick will not be possible.
61. **§3 item 58 SETTLED on the recommendation — the panel keeps ONE colour
    class on its container**, and everything inherits from it, exactly as
    `[data-completion-panel] { color: var(--color-text) }` does today. Not one
    colour utility per element. This preserves the guard that fixed the shipped
    dark-mode bug at finding 48. Stated back to Jamie 2026-08-29 for objection;
    it changes no behaviour, so it is settled unless he says otherwise.

### The 22 class names, listed (finding 53)

Rules in `src/tailwind.css` lines 509-730:

`goes-chart` `goes-row` `goes-row__count` `goes-row__fill` `goes-row__track`
`stat-block__head` `stat-block__icon` `stat-col` `stat-col__label`
`stat-col__mark` `stat-cols` `stat-cols--two` `stat-col__value` `stat-figure`
`stat-figure__icon` `stat-figure__value` `stat-hero` `stat-line`
`stat-line__label` `stat-lines` `stat-line__value` `stat-today`

Plus `[data-stat-block="..."]` accent rules and
`[data-completion-panel] { color }`.

**Two more names appear in the markup with NO rule at all** — `stat-block` and
`stat-note` — so item 37's test must not assert their absence from the
stylesheet, because they were never in it. `completion-stats.spec.ts` selects on
both, so they need `data-` labels like everything else.

### Added to §11 from the review

62. **Three stylesheet-source assertions must be REWRITTEN, not re-selected**
    (finding 47): the two `[data-stat-block]` accent regexes and the
    `.stat-col__label` colour regex in `tests/accent-rotation.spec.ts`, and the
    `.stat-line` and panel-colour slices in `tests/completion-stats.spec.ts`.
    They become assertions about the markup in `src/completion.ts`. Note that
    `.stat-line`'s test uses a non-null assertion and will THROW, not fail
    cleanly, if the rule simply disappears.
63. **Item 37 is narrowed:** the "no dead CSS" test asserts the 22 names above
    are absent from `src/tailwind.css`, read as source like the existing tests
    do — not from the built stylesheet, and not including the two names that
    never had rules.
64. **`docs/DESIGN-SYSTEM.md` is updated too** (finding 54). It documents these
    class names and is already stale, listing several that no longer exist.
