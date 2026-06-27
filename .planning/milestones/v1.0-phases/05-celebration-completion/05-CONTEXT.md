# Phase 5: Celebration + Completion - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

After a correct answer, play a shortened octopus celebration animation (~3s), then cross-fade to a completion screen showing stats and a feedback prompt. The celebration must be skippable and respect `prefers-reduced-motion`. The completion screen shows four stats (played, avg tries, current streak, max streak) computed from existing localStorage history, a next-puzzle countdown timer, and a feedback button that opens the Phase 4 modal.

</domain>

<decisions>
## Implementation Decisions

### Celebration Flow
- **D-01:** Shorten `celebrateOcto()` from ~5.5s to ~3s total. Same visual (octo flies, bubbles rise) but compressed timing.
- **D-02:** After celebration ends, octo returns to header slot, then standard cross-fade transition to completion screen. Consistent with all other screen transitions.
- **D-03:** Celebration is skippable — tap anywhere during animation cuts it short. Octo snaps back to header, cross-fade to completion.
- **D-04:** `launchBubbles()` duration should match the shortened celebration (~3s).

### Stats Content
- **D-05:** Four stats in a 2×2 grid: games played, avg tries, current streak, max streak. No "win %" (always 100% in Clumeral — meaningless).
- **D-06:** Streaks computed from existing `loadHistory()` data by walking consecutive dates. No new localStorage fields.
- **D-07:** No "last 5 games" dots — just the four stat boxes. Keeps completion screen clean.

### Completion Layout
- **D-08:** Centred vertical stack: heading → stats grid (2×2) → next-puzzle countdown → feedback button.
- **D-09:** Heading shows puzzle number and tries: "Puzzle #142 solved!" / "You got it in 2 tries".
- **D-10:** Next puzzle countdown timer (hours/minutes until midnight reset). This pulls ENH-01 from v2 into this phase.
- **D-11:** Game header (logo, puzzle number, menu) stays visible on completion screen. Octopus in header slot after celebration.
- **D-12:** Feedback button opens the Phase 4 modal via existing `[data-fb-header-btn]` trigger.

### Reduced Motion
- **D-13:** When `prefers-reduced-motion` is active, skip celebration entirely — cross-fade directly from game screen to completion.
- **D-14:** Cross-fade transitions are kept under reduced motion (opacity transitions aren't "motion").

### Claude's Discretion
- Exact timing breakdown within the ~3s celebration (lead-in, fly, return durations)
- Stats grid visual styling (font sizes, spacing, labels)
- Countdown timer format (e.g., "Next puzzle in 4h 23m" vs "04:23:15")
- Heading copy and tone
- Feedback button styling (accent fill, outline, text-only)
- How the "skip" tap listener is registered and cleaned up
- Bubble count and speed adjustments for shorter animation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Celebration Animation (being modified)
- `src/octo.ts` — Full octopus animation module. `celebrateOcto()` (line 243) is the main target — needs timing compression. Also contains `sadOcto()`, eye tracking, idle bob. DOM refs: `[data-octo]`, `[data-octo-wrap]`, `[data-octo-slot]`.
- `src/bubbles.ts` — Canvas-based rising bubbles. `launchBubbles()` called on correct answer. Duration constant `TOTAL_MS` needs shortening to match celebration.
- `src/style.css` — Contains `octo-fly` keyframe, `octo-colours` keyframe, and `.celebrating` class. These CSS animations need duration adjustments.

### Game Flow (triggers celebration)
- `src/app.ts` (lines 645-684) — Correct answer handler. Calls `celebrateOcto()` and `launchBubbles()`. Needs to trigger completion screen after celebration ends.
- `src/app.ts` (lines 317-336) — Current `renderStats()` function. Being replaced with new stats for completion screen (different metrics).

### Screen State Machine
- `src/screens.ts` — `showScreen()` manages transitions. Completion screen shell already exists at `[data-screen="completion"]`.

### Stats & Storage
- `src/storage.ts` — `loadHistory()` returns array of `{date, tries}`. Streak computation will walk this data.

### Design & Styling
- `docs/DESIGN-SYSTEM.md` — Token definitions, theming approach.
- `src/tailwind.css` — Tailwind v4 entry point with @theme tokens.

### Markup
- `index.html` (line 352) — Empty `[data-screen="completion"]` section. Gets populated with completion content.
- `index.html` (line 336) — `[data-stats]` element currently in game screen. Completion screen gets its own stats rendering.

### Architecture & Conventions
- `docs/ARCHITECTURE.md` — App structure, module boundaries.
- `docs/CONVENTIONS.md` — Code patterns, DOM cache pattern with data attributes, accessibility.

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — Directory layout and file purposes.
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, module design.

### Phase 4 Integration
- `src/modals.ts` — Feedback modal. `[data-fb-header-btn]` is the completion screen trigger (wired in Phase 4).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `celebrateOcto()` in `src/octo.ts` — Existing celebration. Needs timing changes, not a rewrite. Add skip support and completion-screen callback.
- `launchBubbles()` in `src/bubbles.ts` — Canvas bubbles. Adjust `TOTAL_MS` constant.
- `showScreen()` in `src/screens.ts` — Cross-fade transition. Use directly for game→completion transition.
- `loadHistory()` in `src/storage.ts` — Returns game history. Streak computation builds on this.
- `[data-fb-header-btn]` — Already wired to open feedback modal (Phase 4).

### Established Patterns
- DOM cache with `querySelector('[data-*]')` at module init — completion screen elements follow this pattern.
- `renderStats()` builds HTML via template literal and sets `innerHTML` — completion stats can follow the same pattern.
- Screen transitions via `showScreen(id)` with cross-fade — completion screen uses the same mechanism.

### Integration Points
- `app.ts` correct-answer handler (line 647) — Where celebration triggers. Needs callback/promise to know when celebration ends, then call `showScreen('completion')`.
- `index.html` `[data-screen="completion"]` — Empty shell to populate with markup.
- `window.matchMedia('(prefers-reduced-motion: reduce)')` — Check before launching celebration.

</code_context>

<specifics>
## Specific Ideas

- Next-puzzle countdown pulled from v2 (ENH-01) into this phase — user wants it on the completion screen.
- Stats grid follows Wordle's pattern: four boxes in a 2×2 grid with big numbers and small labels beneath.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-celebration-completion*
*Context gathered: 2026-04-12*
