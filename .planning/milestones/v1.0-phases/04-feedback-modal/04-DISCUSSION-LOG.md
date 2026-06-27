# Phase 4: Feedback Modal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 04-feedback-modal
**Areas discussed:** Modal visual style, Toast / success feedback, Markup migration

---

## Modal Visual Style

### Category Pills

| Option | Description | Selected |
|--------|-------------|----------|
| Rounded pills (Recommended) | Rounded-full capsule buttons with accent fill on selected, border-only when unselected | ✓ |
| Segmented control | Connected button group like iOS segment picker | |
| Minimal text tabs | Plain text labels with underline accent on selected | |

**User's choice:** Rounded pills
**Notes:** None

### Card & Backdrop

| Option | Description | Selected |
|--------|-------------|----------|
| Surface card + dimmed backdrop (Recommended) | White/dark card with rounded corners and subtle shadow, semi-transparent dark backdrop | ✓ |
| Borderless overlay | No card border or shadow, heavily blurred backdrop | |
| Full-screen sheet | Slides up to fill screen on mobile, card on desktop | |

**User's choice:** Surface card + dimmed backdrop
**Notes:** None

### Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Fade + slight scale (Recommended) | Fades in with subtle scale-up (95% to 100%), ~200ms | ✓ |
| Slide up from bottom | Slides up into view, slides back down on close | |
| No animation | Instant show/hide | |

**User's choice:** Fade + slight scale
**Notes:** None

---

## Toast / Success Feedback

### Feedback Method

| Option | Description | Selected |
|--------|-------------|----------|
| Keep toast pattern (Recommended) | Restyle showToast() in Tailwind, small notification auto-dismisses | ✓ |
| Inline in modal | Show success/error inside modal before closing | |
| You decide | Claude picks best approach | |

**User's choice:** Keep toast pattern
**Notes:** None

### Toast Position

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom centre (Recommended) | Standard mobile pattern, above bottom edge, centred | ✓ |
| Top centre | Drops down from top, more desktop-conventional | |
| You decide | Claude picks based on layout | |

**User's choice:** Bottom centre
**Notes:** None

---

## Markup Migration

### Migration Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Replace classes in-place (Recommended) | Keep same HTML structure, swap CSS classes for Tailwind | |
| Full markup rewrite | Rebuild dialog HTML from scratch, cleaner markup | ✓ |

**User's choice:** Full markup rewrite
**Notes:** None

### Data Attribute Names

| Option | Description | Selected |
|--------|-------------|----------|
| Keep data-fb-* names (Recommended) | Same attribute names, minimises JS changes | ✓ |
| Rename to match new conventions | Cleaner names, JS selectors updated to match | |

**User's choice:** Keep data-fb-* names
**Notes:** None

---

## Claude's Discretion

- Exact spacing and padding values
- Responsive modal sizing
- Toast styling details and auto-dismiss timing
- Backdrop opacity
- Close button style (X icon vs text)

## Deferred Ideas

None — discussion stayed within phase scope.
