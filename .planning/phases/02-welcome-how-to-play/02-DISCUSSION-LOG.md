# Phase 2: Welcome + How-to-Play - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 02-welcome-how-to-play
**Areas discussed:** Welcome screen layout, How-to-play content, First-visit detection, Play button behaviour

---

## Welcome Screen Layout

### Vertical structure

| Option | Description | Selected |
|--------|-------------|----------|
| Centred stack | Everything vertically centred like Wordle's landing | |
| Top-weighted | Logo/octopus pinned near top, content flows down, play button in bottom third | ✓ |
| You decide | Claude picks best layout | |

**User's choice:** Top-weighted
**Notes:** Preferred for more breathing room on larger screens.

### Octopus presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Larger standalone | Scale up SVG to 80–120px as visual centrepiece | ✓ |
| Same size, beside title | Keep at ~53px next to the heading | |
| You decide | Claude decides | |

**User's choice:** Larger standalone

### Logo treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Styled text | Keep as `<h1>` in DM Sans or Inconsolata | ✓ |
| Custom wordmark/SVG | Design a proper SVG wordmark | |
| You decide | Claude decides | |

**User's choice:** Styled text

### Subtitle text

| Option | Description | Selected |
|--------|-------------|----------|
| "A daily number puzzle" | Straightforward description | ✓ |
| "Crack the 3-digit code" | More playful/intriguing | |
| You decide | Claude decides | |

**User's choice:** "A daily number puzzle"

### Puzzle number format

| Option | Description | Selected |
|--------|-------------|----------|
| "Puzzle #142" | Simple label with number | ✓ |
| "#142 - 11 April 2026" | Number plus date | |
| You decide | Claude decides | |

**User's choice:** "Puzzle #142"

### Footer on welcome screen

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, on all screens | Consistent with Phase 1 FTR-01 | ✓ |
| Skip on welcome | Keep welcome minimal | |
| You decide | Claude decides | |

**User's choice:** Yes, on all screens

---

## How-to-Play Content

### Content depth

| Option | Description | Selected |
|--------|-------------|----------|
| Condensed 3-step summary | One line per step, no example clue | ✓ |
| Full walkthrough with example | Port entire modal content inline | |
| You decide | Claude decides | |

**User's choice:** Condensed 3-step summary

### Return-visit placement

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible below button | 3 steps below play button, visible but secondary | ✓ |
| Collapsed below button | Toggle to expand steps | |
| Hidden, menu-only | No HTP on welcome for return visitors | |

**User's choice:** Always visible below button

### Visual treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Numbered plain text | Simple list in muted text | ✓ |
| Subtle cards or dividers | Steps in surface cards | |
| You decide | Claude decides | |

**User's choice:** Numbered plain text

---

## First-Visit Detection

### Detection method

| Option | Description | Selected |
|--------|-------------|----------|
| Check dlng_history | Use existing isNewUser pattern | ✓ |
| Check any localStorage key | Scan for any Clumeral-prefixed key | |
| Dedicated first-visit flag | New 'cw-welcomed' key | |

**User's choice:** Check dlng_history
**Notes:** Matches existing pattern in app.ts:25. Simple and proven.

---

## Play Button Behaviour

### Button style

| Option | Description | Selected |
|--------|-------------|----------|
| Filled accent button | Solid green background, white text, rounded | ✓ |
| Outlined accent button | Green border, green text, transparent background | |
| You decide | Claude decides | |

**User's choice:** Filled accent button

### Fetch timing

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fetch on page load | Puzzle loads immediately, ready when user taps Play | ✓ |
| Fetch on Play tap | Only fetch when user taps, shows loading state | |
| You decide | Claude decides | |

**User's choice:** Pre-fetch on page load
**Notes:** Existing behaviour already pre-fetches. No loading state needed.

### Button text

| Option | Description | Selected |
|--------|-------------|----------|
| "Play" | Single word | ✓ |
| "Play Puzzle #142" | Includes puzzle number | |
| You decide | Claude decides | |

**User's choice:** "Play"

---

## Claude's Discretion

- Font choice for logo heading (DM Sans vs Inconsolata)
- Exact octopus size within 80–120px range
- Spacing/padding between elements
- Responsive adjustments for mobile vs desktop
- Exact how-to-play step wording

## Deferred Ideas

None — discussion stayed within phase scope.
