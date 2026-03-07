# Requirements: David Lark's Lame Number Game

**Defined:** 2026-03-07
**Core Value:** The filtering logic must always converge to exactly one answer row and present clear, readable clues — if the puzzle breaks or gives no answer, the game is broken.

## v1 Requirements

### Data Loading

- [x] **DATA-01**: App fetches `data.csv` from the project root using a relative path on page load
- [x] **DATA-02**: CSV is parsed with PapaParse using `dynamicTyping: true` so numeric columns are numbers, not strings
- [x] **DATA-03**: All column headers are trimmed of leading/trailing whitespace before use (4 headers in data.csv have trailing spaces)
- [x] **DATA-04**: Row 0 of the CSV is treated as labels; rows 1+ are data rows
- [x] **DATA-05**: A loading state is shown while the CSV is fetching
- [x] **DATA-06**: An error state is shown if the CSV fetch fails

### Filtering Engine

- [x] **FILT-01**: Six named filter ranges are defined matching the Apps Script: SpecialNumbers (cols 4–6), Sums (cols 7–10), AbsoluteDifference (cols 11–13), Products (cols 14–17), Means (cols 18–21), Range (col 22)
- [x] **FILT-02**: Filter loop starts with all data rows as candidates
- [x] **FILT-03**: Each iteration picks a random untried range, a random column within that range, and a random value from that column among current candidates
- [x] **FILT-04**: Numeric columns use operators: `<=`, `=`, `!=`, `>=` (chosen at random); text columns use `=`, `!=`
- [x] **FILT-05**: A filter is skipped if it would eliminate all remaining candidates
- [x] **FILT-06**: A filter is skipped if all current candidate values in the chosen column are identical (uniform — filter would be meaningless)
- [x] **FILT-07**: The loop terminates when 1 candidate remains or all 6 ranges have been tried
- [x] **FILT-08**: An iteration cap prevents infinite loops on edge-case rows (e.g., repeated-digit numbers like 111, 222)
- [x] **FILT-09**: Each applied filter records a clue: { label, operator, value }
- [x] **FILT-10**: Column 0 (Number) of the surviving row is the answer

### Game Loop

- [ ] **GAME-01**: After CSV load, a puzzle is automatically generated and clues are displayed
- [ ] **GAME-02**: Each clue is displayed as a readable row: "[column label] [operator] [value]"
- [ ] **GAME-03**: Player can enter a 3-digit number guess via a text input
- [ ] **GAME-04**: Guess can be submitted by pressing Enter or clicking a submit button
- [ ] **GAME-05**: If the guess matches the answer, a "Correct!" message is shown
- [ ] **GAME-06**: If the guess is wrong, an "Incorrect" message is shown and the wrong guess is added to a visible guess history list
- [ ] **GAME-07**: A "New Puzzle" button resets all state and generates a fresh puzzle from the full dataset

### UI & Deployment

- [ ] **UI-01**: Dark n8n-inspired theme: deep charcoal/near-black background, orange/coral accent colours
- [ ] **UI-02**: Frosted glass card panels using `backdrop-filter: blur()` with `-webkit-` prefix for Safari
- [ ] **UI-03**: Clean sans-serif typography (Inter via CDN or system font stack)
- [ ] **UI-04**: Fully static — no server required; GitHub Pages compatible (relative paths only)

## v2 Requirements

### Enhancements

- **ENH-01**: "Too high / too low" hint on wrong guesses
- **ENH-02**: Share button to copy clues as text (Wordle-style)
- **ENH-03**: Tooltips explaining what each filter category means
- **ENH-04**: Daily puzzle mode (date-seeded RNG for consistent daily answer)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend/server | Fully static — CSV stays in browser |
| Score tracking / leaderboard | Not requested; adds complexity |
| Mobile-optimised layout | Desktop-first for v1 |
| On-screen number keyboard | Desktop — native input is correct |
| Timer mechanics | Mismatch with low-stakes deduction tone |
| Multiple difficulty modes | Single mode only for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| FILT-01 | Phase 2 | Complete |
| FILT-02 | Phase 2 | Complete |
| FILT-03 | Phase 2 | Complete |
| FILT-04 | Phase 2 | Complete |
| FILT-05 | Phase 2 | Complete |
| FILT-06 | Phase 2 | Complete |
| FILT-07 | Phase 2 | Complete |
| FILT-08 | Phase 2 | Complete |
| FILT-09 | Phase 2 | Complete |
| FILT-10 | Phase 2 | Complete |
| GAME-01 | Phase 3 | Pending |
| GAME-02 | Phase 3 | Pending |
| GAME-03 | Phase 3 | Pending |
| GAME-04 | Phase 3 | Pending |
| GAME-05 | Phase 3 | Pending |
| GAME-06 | Phase 3 | Pending |
| GAME-07 | Phase 3 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
