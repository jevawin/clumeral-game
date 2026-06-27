# Phase 6: Add 'Guess the number from 100-999' copy to welcome + play screens - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Add one line of explanatory range copy to two screens — welcome and play (game).
Tells the player the answer is a 3-digit number from 100–999.

Frontend copy + markup only. No backend, no puzzle-logic, no new components.
Two text insertions plus styling. Nothing else is in scope.

</domain>

<decisions>
## Implementation Decisions

### Welcome screen placement
- **D-01:** Add the line **above the Play button** — after the puzzle-number line (`puzzleNumHtml`), before `playButton()`. See `src/welcome.ts:122-132` render order.
- **D-02:** Keep the existing subtitle "A daily number puzzle" unchanged. The new line is additive, not a replacement.

### Welcome screen wording
- **D-03:** Welcome line reads exactly: **`Work out the number from 100–999`** (en-dash).

### Play (game) screen placement
- **D-04:** Add the line **above the clue list** (`[data-clue-list]`), as the first piece of game content / a label introducing the clues. See `index.html:188-221`.
- **D-05:** Static markup — show on **all puzzles**, daily and archive replay alike. No conditional hide logic. (Note: on archive replay the archive banner row at `index.html:192-195` also sits above the clues — planner to confirm visual order, banner vs copy line.)

### Play screen wording
- **D-06:** Play line reads exactly: **`Work out the number from 100–999. Clues:`** — the line doubles as a label heading the clue list (the "Clues:" part introduces the list below it).

### Dash style
- **D-07:** Use an **en-dash** in the range everywhere: `100–999` (matches shipped meta/OG copy at `index.html:11,17,25`). Not a hyphen.

### Styling
- **D-08:** Welcome line matches the existing subtitle style — `text-base text-text text-center` (same classes as "A daily number puzzle" at `src/welcome.ts:126`).
- **D-09:** Play line gets emphasis on the `Clues:` label since it heads the list (e.g. bold the label, keep the range phrase as body text). Exact class choice left to planner to fit game-screen patterns.

### Claude's Discretion
- Exact Tailwind classes for the play-screen emphasis/spacing (D-09) — fit existing game-screen patterns.
- Whether the play copy is one `<p>` with an inline-bold span, or range + label split — planner picks the cleaner markup.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §"Phase 6" — phase goal and GitHub issue #207.

### Copy consistency (the source-of-truth wording already shipped)
- `index.html:11` — meta description: "Work out the number from 100–999. New puzzle every day." (en-dash precedent for D-03, D-06, D-07).
- `index.html:17,25` — og:description / twitter:description repeat the same line.

No external ADRs/specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/welcome.ts` `renderWelcome()` (lines 109-133) — builds the welcome innerHTML template string. New welcome line goes into this template between `puzzleNumHtml` and `playButton()`.
- Existing subtitle markup `<p class="text-base text-text text-center">A daily number puzzle</p>` (`src/welcome.ts:126`) — copy its classes for D-08.

### Established Patterns
- Welcome screen content is rendered in JS via a template literal in `welcome.ts`, NOT in `index.html`. Welcome edit = `welcome.ts`.
- Game screen content is static HTML in `index.html` (`[data-screen="game"]`, lines 188-275). Play edit = `index.html` markup. Clue list is `[data-clue-list]` at line 198; new line goes immediately before it inside the `max-w-[390px]` wrapper.
- En-dash already used for the 100–999 range in shipped meta tags — reuse for consistency.

### Integration Points
- Welcome: `src/welcome.ts` template string (one new `<p>`).
- Play: `index.html` static markup inside `[data-screen="game"] > .max-w-[390px]` wrapper, above `[data-clue-list]`.
- Archive replay reuses the same game-screen markup, so the play line shows automatically (satisfies D-05) — verify it doesn't collide with the archive banner row.

</code_context>

<specifics>
## Specific Ideas

- Two exact strings to ship verbatim:
  - Welcome: `Work out the number from 100–999`
  - Play: `Work out the number from 100–999. Clues:`
- Both use the en-dash character `–` (U+2013), not a hyphen.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-add-guess-the-number-from-100-999-copy-to-welcome-play-scree*
*Context gathered: 2026-05-30*
