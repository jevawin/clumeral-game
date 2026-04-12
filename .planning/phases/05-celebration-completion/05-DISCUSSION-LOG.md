# Phase 5: Celebration + Completion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 05-celebration-completion
**Areas discussed:** Celebration flow, Stats content, Completion layout, Reduced motion

---

## Celebration Flow

### Duration

| Option | Description | Selected |
|--------|-------------|----------|
| Shorten to ~3s (Recommended) | Cut the fly animation duration — keep the same visual but faster | ✓ |
| Keep current ~5.5s | Update the requirement to match what's already built | |
| You decide | Claude picks the right duration | |

**User's choice:** Shorten to ~3s
**Notes:** None

### Transition to Completion

| Option | Description | Selected |
|--------|-------------|----------|
| Octo returns to header, then cross-fade (Recommended) | Celebration ends, octo settles back, standard cross-fade | ✓ |
| Celebration fades out, completion fades in | No return-to-header step, direct overlay | |
| Overlay completion on game screen | Slides up over game screen | |

**User's choice:** Octo returns to header, then cross-fade
**Notes:** Consistent with all other screen transitions

### Skippable

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, tap anywhere to skip (Recommended) | Tapping cuts it short, octo snaps back | ✓ |
| No, let it play | 3s is short enough | |
| You decide | Claude decides based on final timing | |

**User's choice:** Yes, tap anywhere to skip
**Notes:** None

---

## Stats Content

### Win % Replacement

| Option | Description | Selected |
|--------|-------------|----------|
| Avg tries (Recommended) | Already computed, shows skill progression | ✓ |
| Best (fewest) tries | Personal best, motivating | |
| Drop it entirely | Three stats is enough | |

**User's choice:** Avg tries
**Notes:** Win % is always 100% in Clumeral — meaningless metric

### Streak Computation

| Option | Description | Selected |
|--------|-------------|----------|
| Compute from history (Recommended) | Walk history array, check consecutive dates | ✓ |
| Store streaks separately | Add new localStorage fields | |
| Skip streaks for now | Just played + avg tries | |

**User's choice:** Compute from history
**Notes:** No storage changes needed

### Last 5 Games

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, keep them | Four stat boxes plus last-5 row | |
| No, just the four stats (Recommended) | Clean grid, no visual noise | ✓ |
| You decide | Claude picks based on layout feel | |

**User's choice:** No, just the four stats
**Notes:** None

---

## Completion Layout

### Content

| Option | Description | Selected |
|--------|-------------|----------|
| "You got it!" heading with puzzle number | Celebratory heading with context | ✓ |
| Next puzzle countdown | Timer until next daily puzzle (ENH-01 from v2) | ✓ |
| Play random puzzle button | Link to /random | |
| Just stats + feedback | Minimal — nothing else | |

**User's choice:** Heading + countdown (multiselect)
**Notes:** Countdown pulled from v2 requirements into this phase

### Vertical Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Centred stack (Recommended) | Heading → stats → countdown → feedback, all centred | ✓ |
| Top-anchored with breathing room | Content from upper third, feedback at bottom | |

**User's choice:** Centred stack
**Notes:** Consistent with welcome screen's centred layout

### Header Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, keep header (Recommended) | Consistent with game screen, menu accessible | ✓ |
| No, full-screen completion | Cleaner focus but loses menu | |

**User's choice:** Yes, keep header
**Notes:** None

---

## Reduced Motion

### Celebration Behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Skip celebration, go straight to completion (Recommended) | No octo fly, no bubbles, direct cross-fade | ✓ |
| Brief fade instead of fly | Octo fades green briefly (0.5s) | |
| You decide | Claude picks most accessible approach | |

**User's choice:** Skip celebration entirely
**Notes:** None

### Cross-fade Under Reduced Motion

| Option | Description | Selected |
|--------|-------------|----------|
| Keep cross-fade (Recommended) | Opacity transitions aren't "motion" | ✓ |
| Instant swap | Strictest interpretation | |
| You decide | Best accessibility practice | |

**User's choice:** Keep cross-fade
**Notes:** Opacity transitions fine under reduced-motion

---

## Claude's Discretion

- Exact timing breakdown within ~3s celebration
- Stats grid visual styling
- Countdown timer format
- Heading copy and tone
- Feedback button styling
- Skip tap listener implementation
- Bubble count/speed for shorter animation

## Deferred Ideas

None — discussion stayed within phase scope.
