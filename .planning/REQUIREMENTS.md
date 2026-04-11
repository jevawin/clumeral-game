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

- [ ] **GAM-01**: Game screen shows clues listed directly on background (no card wrapper)
- [ ] **GAM-02**: Game screen shows digit boxes with number pad input
- [ ] **GAM-03**: Game screen shows submit button
- [ ] **GAM-04**: Digit elimination works exactly as current implementation
- [ ] **GAM-05**: Guess submission and server-side validation works without regression
- [ ] **GAM-06**: Random puzzle and replay modes work through the new screen flow

### Game Menu

- [ ] **MNU-01**: Compact menu accessible from game screen header (hamburger or icon)
- [ ] **MNU-02**: Menu contains light/dark mode toggle
- [ ] **MNU-03**: Menu contains archive link
- [ ] **MNU-04**: Menu contains feedback trigger
- [ ] **MNU-05**: Menu contains how-to-play link

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
| — | — | — |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 0
- Unmapped: 33

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after initial definition*
