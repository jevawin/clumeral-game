# Phase 6: Add 'Guess the number from 100-999' copy to welcome + play screens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 06-add-guess-the-number-from-100-999-copy-to-welcome-play-scree
**Areas discussed:** Welcome placement, Play placement, Exact wording, Dash + styling

---

## Welcome placement

| Option | Description | Selected |
|--------|-------------|----------|
| Replace subtitle | Swap 'A daily number puzzle' for the new line | |
| Add below subtitle | Keep subtitle, add new line beneath it | |
| Merge into one | Combine both into a single subtitle | |

**User's choice:** Free text — "above the play button"
**Notes:** Keep existing subtitle. New line sits after the puzzle-number line, immediately above the Play button.

---

## Play placement

| Option | Description | Selected |
|--------|-------------|----------|
| Above clue list | Intro line at top of game content, before clues | ✓ |
| Below digit boxes | Hint near the input area | |

**User's choice:** Above clue list
**Notes:** —

### Archive replay

| Option | Description | Selected |
|--------|-------------|----------|
| Show on all | Static markup, daily + archive replay | ✓ |
| Daily only | Hide on replay, needs conditional logic | |

**User's choice:** Show on all

---

## Exact wording

| Option | Description | Selected |
|--------|-------------|----------|
| Guess the number... | Matches issue title verb | |
| Work out the number... | Matches shipped meta/OG copy | ✓ |

**User's choice:** Work out the number...

### Same on both screens?

| Option | Description | Selected |
|--------|-------------|----------|
| Same on both | Identical line both screens | |
| Different | Tailor each | ✓ |

**User's choice:** Different — then specified each line.

### Welcome line text

| Option | Description | Selected |
|--------|-------------|----------|
| Work out the number from 100–999 | Plain, matches meta | ✓ |
| Work out today's number from 100–999 | Adds 'today's' | |

**User's choice:** Work out the number from 100–999

### Play line text

| Option | Description | Selected |
|--------|-------------|----------|
| Work out the number from 100–999 | Same full line as welcome | |
| The number is between 100 and 999 | Terser hint | |
| Work out the number (100–999) | Range in parens | |

**User's choice:** Free text — "Work out the number from 100-999. Clues:" (line doubles as a label heading the clue list)

---

## Dash + styling

| Option | Description | Selected |
|--------|-------------|----------|
| En-dash 100–999 | Matches shipped meta copy | ✓ |
| Hyphen 100-999 | Matches issue title | |

**User's choice:** En-dash 100–999

### Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Match subtitle | Reuse subtitle classes both screens | |
| Welcome subtitle / Play bolder | Welcome matches subtitle; play 'Clues:' emphasised | ✓ |
| You decide | Planner picks | |

**User's choice:** Welcome subtitle / Play bolder

---

## Claude's Discretion

- Exact Tailwind classes for play-screen emphasis and spacing.
- Markup shape of the play line (single `<p>` with inline-bold span vs split).

## Deferred Ideas

None — discussion stayed within phase scope.
