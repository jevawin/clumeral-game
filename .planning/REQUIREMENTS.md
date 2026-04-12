# Requirements: Clumeral Redesign

**Defined:** 2026-04-11
**Core Value:** The game screen must work flawlessly — clues, digit elimination, guess submission, and answer validation must all function exactly as they do today, just in a cleaner layout.

## v1 Requirements

### Screen Structure

- [ ] **SCR-01**: App shows three distinct screens: welcome, game, completion
- [ ] **SCR-02**: Screens are state-driven on a single page (no URL routes)
- [ ] **SCR-03**: Smooth cross-fade transitions between screens using View Transition API with fallback

### Welcome Screen

- [ ] **WEL-01**: Welcome screen shows logo and octopus mascot
- [ ] **WEL-02**: Welcome screen shows subtitle and puzzle number
- [ ] **WEL-03**: Welcome screen shows play button that transitions to game screen
- [ ] **WEL-04**: Welcome screen shows every visit (like Wordle)

### How-to-Play

- [ ] **HTP-01**: How-to-play content displayed inline on the welcome screen (not a modal)
- [ ] **HTP-02**: How-to-play appears above play button on first visit
- [ ] **HTP-03**: How-to-play appears below play button on return visits
- [ ] **HTP-04**: First-visit detection based on whether any Clumeral localStorage keys exist

### Game Screen

- [x] **GAM-01**: Game screen shows clues listed directly on background (no card wrapper)
- [x] **GAM-02**: Game screen shows digit boxes with number pad input
- [x] **GAM-03**: Game screen shows submit button
- [x] **GAM-04**: Digit elimination works exactly as current implementation
- [x] **GAM-05**: Guess submission and server-side validation works without regression
- [x] **GAM-06**: Random puzzle and replay modes work through the new screen flow

### Game Menu

- [x] **MNU-01**: Compact menu accessible from game screen header (hamburger or icon)
- [x] **MNU-02**: Menu contains light/dark mode toggle
- [x] **MNU-03**: Menu contains archive link
- [x] **MNU-04**: Menu contains feedback trigger
- [x] **MNU-05**: Menu contains how-to-play link

### Celebration

- [ ] **CEL-01**: Octopus swims up from bottom with bubbles on correct answer (~3s)
- [ ] **CEL-02**: Celebration animation completes, then completion screen appears
- [ ] **CEL-03**: Celebration respects prefers-reduced-motion

### Completion Screen

- [ ] **CMP-01**: Completion screen shows basic stats: games played, win %, current streak, max streak
- [ ] **CMP-02**: Completion screen shows feedback prompt (button opens feedback modal)
- [ ] **CMP-03**: Stats read from existing localStorage game history

### Feedback Modal

- [ ] **FBK-01**: Feedback modal accessible from both completion screen and game menu
- [ ] **FBK-02**: Feedback modal has category pills (General, Bug, Idea, Praise)
- [ ] **FBK-03**: Feedback modal has textarea with character counter (warns at 400/500)
- [ ] **FBK-04**: Feedback modal shows metadata line (puzzle number, date, device, browser)
- [ ] **FBK-05**: Feedback submits to existing Google Apps Script endpoint with retry logic

### Styling

- [ ] **STY-01**: Built from scratch with Tailwind CSS v4
- [ ] **STY-02**: Semantic colour tokens defined in CSS @theme (~7 tokens with light/dark variants)
- [ ] **STY-03**: Dark mode uses near-black background (#121213), light mode uses off-white (#FAFAFA)
- [ ] **STY-04**: Dark mode via Tailwind dark: variants, not light-dark() or color-mix()
- [ ] **STY-05**: Green accent only — no colour theme picker
- [ ] **STY-06**: Old CSS fully removed once replacement is complete

### Footer

- [ ] **FTR-01**: Simplified footer on all screens: "Made with heart by Jamie & Dave. (c) 2026."
- [ ] **FTR-02**: No GitHub link, no "AI experiment" copy

## v2 Requirements

### Share

- **SHR-01**: User can share results via a share button on the completion screen
- **SHR-02**: Share format is accessible (not just an emoji grid)

### Enhancements

- **ENH-01**: Countdown timer to next puzzle on completion screen
- **ENH-02**: Tap-to-skip celebration animation
- **ENH-03**: Subtle entrance animations for clues and digit boxes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple colour themes | Deliberately removed to simplify UI and codebase |
| Toast notification system | How-to-play is inline; toasts add complexity for little value |
| Guess distribution chart | Single-guess game — distribution chart doesn't apply |
| Leaderboard / social comparison | Requires auth and backend; out of scope |
| Cross-device sync | Requires accounts; localStorage is fine for daily single-device play |
| Share button placeholder | Cleaner to add when the feature ships — no greyed-out button |
| Worker/API changes | Backend stays untouched; this is purely a frontend rebuild |
| Component library | Only ~3 real components; library adds dependency weight for no value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCR-01 | Phase 1 | Pending |
| SCR-02 | Phase 1 | Pending |
| SCR-03 | Phase 1 | Pending |
| STY-01 | Phase 1 | Pending |
| STY-02 | Phase 1 | Pending |
| STY-03 | Phase 1 | Pending |
| STY-04 | Phase 1 | Pending |
| STY-05 | Phase 1 | Pending |
| FTR-01 | Phase 1 | Pending |
| FTR-02 | Phase 1 | Pending |
| WEL-01 | Phase 2 | Pending |
| WEL-02 | Phase 2 | Pending |
| WEL-03 | Phase 2 | Pending |
| WEL-04 | Phase 2 | Pending |
| HTP-01 | Phase 2 | Pending |
| HTP-02 | Phase 2 | Pending |
| HTP-03 | Phase 2 | Pending |
| HTP-04 | Phase 2 | Pending |
| GAM-01 | Phase 3 | Complete |
| GAM-02 | Phase 3 | Complete |
| GAM-03 | Phase 3 | Complete |
| GAM-04 | Phase 3 | Complete |
| GAM-05 | Phase 3 | Complete |
| GAM-06 | Phase 3 | Complete |
| MNU-01 | Phase 3 | Complete |
| MNU-02 | Phase 3 | Complete |
| MNU-03 | Phase 3 | Complete |
| MNU-04 | Phase 3 | Complete |
| MNU-05 | Phase 3 | Complete |
| FBK-01 | Phase 4 | Pending |
| FBK-02 | Phase 4 | Pending |
| FBK-03 | Phase 4 | Pending |
| FBK-04 | Phase 4 | Pending |
| FBK-05 | Phase 4 | Pending |
| CEL-01 | Phase 5 | Pending |
| CEL-02 | Phase 5 | Pending |
| CEL-03 | Phase 5 | Pending |
| CMP-01 | Phase 5 | Pending |
| CMP-02 | Phase 5 | Pending |
| CMP-03 | Phase 5 | Pending |
| STY-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after roadmap creation*
