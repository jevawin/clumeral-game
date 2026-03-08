# Phase 3: Game Loop and UI - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up the interactive game loop (clue display on load, guess input, correct/incorrect feedback, guess history, New Puzzle reset) and apply all visual styling via style.css using the n8n dark theme. HTML structure and DOM element IDs are already locked from Phase 1 — no restructuring allowed. Phase 3 owns all of style.css (left empty intentionally).

</domain>

<decisions>
## Implementation Decisions

### Page layout & card structure
- Single centered frosted-glass card holds all game content (clues, input, feedback, history)
- Game title ("David Lark's Lame Number Game") floats above the card, outside the glass panel
- `#status` lives at the top of the card as a small, muted subtitle (shows loading/ready state)
- Input and submit button are inline on desktop; stacked (button below input, full width) below a responsive breakpoint

### Clue formatting
- Column labels displayed as-is from CSV headers — no transformation
- Operators rendered as mathematical symbols: ≤ ≥ = ≠ (not raw `<=`, `>=`, `=`, `!=`)
- Clue values displayed plain — no quotes around string values, no special formatting for numbers
- Each clue row has a subtle left border or background tint in the orange/coral accent color to make the list scannable

### Feedback placement & post-correct state
- Feedback ("Correct!" / "Incorrect") appears inline below the input row
- Color-coded: green for correct, red/orange for incorrect
- Correct message includes the answer: "Correct! The answer was 347."
- After a correct guess: input and submit button are disabled (grayed out) but remain visible — player must click New Puzzle to continue

### Guess history
- Each wrong guess shows just the number (e.g. "347") — no extra label or count
- Guess history list appears below the feedback message, inside the card
- "Previous guesses:" label shown above the list, hidden when list is empty
- Wrong guess numbers styled in muted/dimmed color — clearly past, not the current focus

### Claude's Discretion
- Exact breakpoint value for stacked input layout
- Loading/error state visual treatment (spinner vs text, error icon)
- New Puzzle button placement within card (likely bottom of card)
- Exact frosted glass values (blur radius, background-color opacity)
- Typography sizing and spacing within the card

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runFilterLoop(rows)` in app.js: returns `{ answer, clues }` — Phase 3 calls this to generate a puzzle and render clues
- `loadData()` in app.js: already enables #guess, #submit, #new-puzzle on successful load — Phase 3 adds event listeners to these elements
- DOM IDs locked: `#status`, `#clues`, `#guess`, `#submit`, `#history`, `#new-puzzle` — no restructuring

### Established Patterns
- Vanilla JS, no framework, no bundler — all Phase 3 code appended to app.js or in a new inline `<script>` in index.html (app.js preferred to keep files organized)
- PapaParse loaded via CDN (already in index.html) — no additional dependencies
- style.css is currently empty — Phase 3 writes all styles here

### Integration Points
- Phase 3 calls `runFilterLoop(gameRows)` after `loadData()` completes — `gameRows` is module-scoped in app.js, accessible to Phase 3 code in the same file
- `#clues` is a `<ul>` — Phase 3 appends `<li>` elements per clue
- `#history` is a `<ul>` — Phase 3 appends `<li>` elements per wrong guess
- Event listeners attach to: `#submit` (click), `#guess` (keydown Enter), `#new-puzzle` (click)

</code_context>

<specifics>
## Specific Ideas

- n8n.io is the design reference: `#1a1a2e`-range dark background, `#ff6d5a` / `#ff914d` orange/coral accents, `backdrop-filter: blur()` frosted glass, Inter font (CDN) or system sans-serif
- Frosted glass: `-webkit-backdrop-filter` prefix required for Safari (per UI-02)
- Clue row accent: a left border or subtle tint using the orange/coral accent — not a full background fill

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-game-loop-and-ui*
*Context gathered: 2026-03-08*
