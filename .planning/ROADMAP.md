# Roadmap: David Lark's Lame Number Game

## Overview

Four phases deliver the game in strict dependency order: first the CSV data layer is validated (nothing works without correct data), then the filtering engine is built and stress-tested as a pure function (highest-risk component, no UI entanglement), then the game loop and UI are wired together into a fully playable local experience, and finally the game is validated and deployed to GitHub Pages. Each phase fully unlocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - CSV loads correctly with typed columns, trimmed headers, loading/error states (in progress — 1/2 plans complete)
- [ ] **Phase 2: Filtering Engine** - Pure filter loop reliably produces one answer and readable clues for any input
- [ ] **Phase 3: Game Loop and UI** - Complete playable game with guess input, feedback, history, and dark theme
- [ ] **Phase 4: Deployment** - Game is live on GitHub Pages and verified end-to-end in production

## Phase Details

### Phase 1: Data Foundation
**Goal**: The CSV is reliably loaded, parsed with correct types, and available in memory — all edge cases (trailing spaces, type coercion, fetch errors) are resolved before any other code runs against the data
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. Opening the game in a browser shows a loading indicator while the CSV fetches
  2. After load, all 23 column headers are available in code with no trailing whitespace
  3. Numeric columns contain JavaScript numbers (not strings) after parse — `typeof value === 'number'` returns true
  4. Simulating a failed fetch shows an error message in the UI (not a silent blank page)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — HTML game shell (index.html, style.css) and manual test checklist
- [ ] 01-02-PLAN.md — CSV data loader (app.js) with fetch-then-parse, loading/error states, browser verification

### Phase 2: Filtering Engine
**Goal**: The pure filter loop function accepts typed row data and reliably produces exactly one answer with human-readable clues — including on pathological inputs — with no UI dependencies
**Depends on**: Phase 1
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04, FILT-05, FILT-06, FILT-07, FILT-08, FILT-09, FILT-10
**Success Criteria** (what must be TRUE):
  1. `runFilterLoop(rows)` returns `{ answer, clues }` where `answer` is a number 100–999 and `clues` is a non-empty array
  2. Running the filter loop 50 times in the browser console always terminates and never produces the same answer twice in a row (random)
  3. Calling `runFilterLoop` with a repeated-digit number row (e.g., the row for 111) does not hang — it terminates within the iteration cap and returns a result or a defined escape value
  4. Each clue object contains `{ label, operator, value }` with a human-readable label string (not a raw column index)
**Plans**: TBD

### Phase 3: Game Loop and UI
**Goal**: A fully playable game in the browser — clues display, the player can guess, receives correct/incorrect feedback with guess history, and can start a new puzzle — styled with the dark n8n-inspired theme
**Depends on**: Phase 2
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. On page load (local HTTP server), a puzzle appears automatically with at least one readable clue displayed
  2. Typing a 3-digit number and pressing Enter or clicking Submit shows "Correct!" when the answer matches
  3. A wrong guess shows an "Incorrect" message and adds the guessed number to a visible guess history below the input
  4. Clicking "New Puzzle" clears clues, resets the input, clears guess history, and shows a fresh puzzle with a different answer
  5. The page visually matches the n8n dark theme: near-black background, orange/coral accents, frosted glass card panels
**Plans**: TBD

### Phase 4: Deployment
**Goal**: The game is live on GitHub Pages and works end-to-end in production — all asset paths resolve correctly under the repo subdirectory and the game is playable by anyone with the URL
**Depends on**: Phase 3
**Requirements**: UI-04
**Success Criteria** (what must be TRUE):
  1. Navigating to the GitHub Pages URL in a fresh browser (no localhost) shows the loading state and then a puzzle — no 404 errors, no blank page
  2. `data.csv` loads correctly from the GitHub Pages URL (relative path resolves under the repo subdirectory, not the account root)
  3. The frosted glass effect renders correctly in Chrome, Firefox, and Safari on the GitHub Pages URL
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 2/2 | Complete   | 2026-03-07 |
| 2. Filtering Engine | 0/TBD | Not started | - |
| 3. Game Loop and UI | 0/TBD | Not started | - |
| 4. Deployment | 0/TBD | Not started | - |
