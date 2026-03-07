# Feature Research

**Domain:** Browser-based number/logic puzzle guessing game (single-page, static)
**Researched:** 2026-03-07
**Confidence:** MEDIUM — Wordle-genre conventions are well-established; specific clue-filter pattern is novel, so some extrapolation applied.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clue display — all clues visible at once | Players need to hold context; hiding clues creates confusion | LOW | Project already mandates showing 1–N clues after puzzle generation |
| Clear correct/incorrect answer feedback | Core game loop payoff; ambiguous result = broken feeling | LOW | Visual differentiation required (color + text, not color alone) |
| Inline validation on guess input | Users type 3-digit numbers; reject non-numeric or out-of-range silently = rage quit | LOW | Constrain input to `100–999`; show hint text |
| "New puzzle" / reset button | Single-puzzle dead-end is a hard stop; reset is minimum replayability | LOW | Already in project requirements |
| Loading state on CSV fetch | `fetch()` has latency; blank screen with no indicator reads as broken | LOW | Spinner or "Loading…" text before puzzle renders |
| Keyboard-accessible input | Text/number inputs must be focusable and submittable with Enter key | LOW | Native `<input type="number">` + `<form>` gives this nearly free |
| Readable clue language | Clues like "AbsoluteDifference col11 >= 42" are unreadable; must be human-readable labels | MEDIUM | Requires mapping column IDs to plain-English labels |
| Visible game state | Player must always know: "Am I mid-guess? Did I win? Did something fail?" | LOW | Three explicit states: loading, playing, result |
| Error state when CSV fails | `fetch()` can fail (wrong path, CORS on file://); silent failure is catastrophic | LOW | Show explicit "Could not load puzzle data" message |
| Sufficient color contrast | Dark-themed UI (as specified) is prone to low-contrast text | LOW | WCAG AA contrast for all text — especially clue cards on dark bg |

### Differentiators (Competitive Advantage)

Features that set this product apart. Not required, but add real value for this specific puzzle type.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Progressive clue reveal (optional mode) | Shows clues one at a time as player guesses incorrectly — adds tension and deduction depth | MEDIUM | Requires tracking guess count and revealing next clue on each wrong guess; conflicts with current "all clues at once" default |
| Clue explanation on hover/tap | Players unfamiliar with filter categories (SpecialNumbers, Products, etc.) can get a plain-English explanation | LOW | Tooltip or expand-on-click on each clue label; high payoff for minimal work |
| Wrong-guess history | Shows previous incorrect guesses during the current puzzle — reinforces deduction | LOW | Maintain an array of past guesses, render below input |
| Animated clue appearance | Clues fading in or staggering on load creates polish and "game feel" | LOW | CSS `animation` + `animation-delay`; zero JS needed |
| Puzzle difficulty indicator | Tell the player up front: "This took 4 filters" vs "This took 9 filters" — sets expectation | LOW | Count of clues is already known; just render it |
| Share result text | "I got it in 2 guesses" copy-to-clipboard output for social sharing | LOW | Plain text generation + `navigator.clipboard`; no backend needed |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this project at v1.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Score tracking / leaderboard | Adds competition and retention | Requires backend or persistent storage; out of scope; invites cheating concerns | Show per-session guess count only; no persistence |
| Multiple difficulty modes | Seems like added value | Requires separate filtering parameter sets; doubles QA scope; PROJECT.md explicitly defers this | Single mode; difficulty emerges naturally from filter count variance |
| Timer / countdown | Pressure mechanic, popular in genre | This is a deduction puzzle, not a speed game; timer punishes careful reasoning; mismatches the "lame" low-stakes tone | No timer; player goes at their own pace |
| Animated number keyboard (on-screen) | Mobile-friendly input pattern (Wordle does this) | Desktop-first project; adds significant layout complexity; native `<input type="number">` is simpler and correct | Native browser number input with good label and placeholder |
| Daily puzzle mode | High engagement mechanic (Wordle model) | Requires date-seeded RNG and a fixed puzzle-per-day contract; complicates CSV data management | Unlimited on-demand new games; "daily" can be v2 if validated |
| Sound effects | Polish and game feel | Autoplay audio is blocked by browsers by default; implementation without user gesture is broken; scope creep | Visual feedback only for v1 |
| Dark/light mode toggle | Accessibility expectation in 2025 | Project specifies a fixed dark theme matching n8n design reference; toggle adds CSS variable complexity for no stated user need | Fixed dark theme; ensure it meets contrast requirements |
| Mobile-optimised layout | Expands audience | PROJECT.md explicitly defers this; responsive layout adds CSS complexity that can be retrofitted | Desktop-first; don't actively break on mobile, just don't optimize |

---

## Feature Dependencies

```
[CSV Parse & Load]
    └──requires──> [Filtering Algorithm]
                       └──requires──> [Clue Display]
                                          └──requires──> [Guess Input]
                                                             └──requires──> [Correct/Incorrect Feedback]

[Loading State] ──wraps──> [CSV Parse & Load]

[Error State] ──wraps──> [CSV Parse & Load]

[New Puzzle Button] ──requires──> [Full state reset of Filtering Algorithm + Clue Display + Guess Input]

[Wrong-guess History] ──enhances──> [Guess Input + Feedback]
    └──requires──> [Guess Input]

[Clue Explanation Tooltip] ──enhances──> [Clue Display]
    └──requires──> [Clue Display]

[Progressive Clue Reveal] ──conflicts──> [All-clues-at-once display]
```

### Dependency Notes

- **CSV Parse requires Filtering Algorithm:** The filtering loop runs on the parsed in-memory dataset; nothing works until parsing succeeds.
- **Clue Display requires Filtering Algorithm:** Clues are the output of the filtering loop; display cannot happen before the loop completes.
- **New Puzzle Button requires full state reset:** Must clear candidates array, clue list, guess history, and feedback state simultaneously — a partial reset is a bug surface.
- **Progressive Clue Reveal conflicts with All-clues-at-once:** These are mutually exclusive display strategies. The project currently specifies all-at-once; progressive reveal is a v2 mode choice.
- **Wrong-guess History requires Guess Input:** It is purely additive — only makes sense once a guess pathway exists.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] CSV load with loading state and error state — without data, there is no game
- [ ] Filtering algorithm produces exactly one answer row — the core mechanic
- [ ] All clues displayed with human-readable labels — unreadable clues break the puzzle
- [ ] 3-digit guess input with Enter-to-submit — the primary interaction
- [ ] Correct / incorrect feedback — the game loop payoff
- [ ] New Puzzle button — minimum replayability
- [ ] Keyboard accessibility for input and submit — accessible by default with native elements

### Add After Validation (v1.x)

Features to add once core is working and players are engaging.

- [ ] Clue explanation tooltips — add when users express confusion about filter category names
- [ ] Wrong-guess history — add when players request it or testing shows they lose track of guesses
- [ ] Share result copy-to-clipboard — add when social sharing behavior is observed
- [ ] Puzzle difficulty indicator (clue count) — add if playtesters report uncertainty about puzzle length

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Progressive clue reveal mode — substantial UX redesign; validate base game first
- [ ] Daily puzzle mode — requires date-seeded RNG and a data management contract
- [ ] Mobile layout optimization — explicit v1 deferral in PROJECT.md
- [ ] Multiple difficulty modes — requires parameter tuning and extended QA

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CSV load + error/loading states | HIGH | LOW | P1 |
| Filtering algorithm | HIGH | MEDIUM | P1 |
| Human-readable clue display | HIGH | LOW | P1 |
| Guess input (number, Enter to submit) | HIGH | LOW | P1 |
| Correct/incorrect feedback | HIGH | LOW | P1 |
| New Puzzle button | HIGH | LOW | P1 |
| Keyboard accessibility | MEDIUM | LOW | P1 |
| Clue explanation tooltips | MEDIUM | LOW | P2 |
| Wrong-guess history | MEDIUM | LOW | P2 |
| Share result text | MEDIUM | LOW | P2 |
| Puzzle difficulty indicator | LOW | LOW | P2 |
| Progressive clue reveal | HIGH | MEDIUM | P3 |
| Daily puzzle mode | HIGH | MEDIUM | P3 |
| Mobile layout | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

The closest genre comparisons are Wordle-style daily deduction games and simple number-guessing demos.

| Feature | Wordle | Simple Number Guesser | Our Approach |
|---------|--------|----------------------|--------------|
| Clue display | Per-guess color tile feedback | "Too high / Too low" after each guess | All filter-derived clues shown upfront; player deduces from them |
| Guess input | Letter-by-letter keyboard (on-screen) | Numeric text input | Native `<input type="number">` with label; desktop-first |
| Wrong-guess feedback | Inline tile coloring | Text message below input | Explicit correct/incorrect message with visual styling |
| New game flow | Daily reset only | Instant restart button | Instant New Puzzle button; no daily constraint |
| Loading state | N/A (hardcoded word list) | N/A (random in JS) | Required — CSV fetched via network |
| Error handling | N/A | N/A | Required — CSV can fail |
| Accessibility | WCAG AA contrast; keyboard input | Minimal | Keyboard-first; WCAG AA contrast required by dark theme |
| Social sharing | Share result text/emoji grid | None | Copy-to-clipboard text (v1.x) |

---

## Sources

- [Gamedle — daily puzzle game with classic/characters modes](https://gamedle.my/) — example of table-stakes browser puzzle UX
- [Wordle — Wikipedia](https://en.wikipedia.org/wiki/Wordle) — genre reference for clue/feedback conventions
- [Game-Ace: The Complete Game UX Guide 2025](https://game-ace.com/blog/the-complete-game-ux-guide/) — immediate feedback, state communication principles
- [Building a Number Guessing Game 2025 — DEV Community](https://dev.to/safdarali25/building-the-fun-a-number-guessing-game-in-2025-10k3) — baseline number game feature reference
- [Game Accessibility Guidelines — full list](https://gameaccessibilityguidelines.com/full-list/) — minimum accessible game features
- [Accessibility in Student Projects: Minimum Viable Accessibility Checklist](https://gamedesigning.org/beyond/accessibility-in-student-projects-minimum-viable-accessibility-checklist/) — readable UI, keyboard control, feedback legibility
- [Crosswordle Blog: Daily Logic Word Games](https://crosswordle.com/blog/daily-logic-word-games) — genre conventions for browser deduction games

---
*Feature research for: browser number/logic puzzle guessing game (David Lark's Lame Number Game)*
*Researched: 2026-03-07*
