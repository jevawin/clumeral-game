# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 01-foundation
**Areas discussed:** Colour token palette, Screen transition feel, CSS coexistence, Font & typography

---

## Colour Token Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal 6 | bg, text, muted, accent, surface, border — shadows/tints via Tailwind opacity modifiers | ✓ |
| Standard 8 | Adds card-bg and modal-bg for layered surfaces | |
| Compact 5 | Drops muted entirely, uses text/60 opacity | |

**User's choice:** Minimal 6
**Notes:** None — clean pick.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current greens | #0A850A light, #1EAD52 dark | |
| You decide | Claude picks WCAG AA-passing values | ✓ |

**User's choice:** Claude's discretion on exact accent green values
**Notes:** Must pass WCAG AA on #FAFAFA and #121213 backgrounds. Current values are a good starting point.

---

## Screen Transition Feel

| Option | Description | Selected |
|--------|-------------|----------|
| Snappy (150ms) | Quick dissolve, feels instant | |
| Smooth (250ms) | Noticeable but not slow, good middle ground | ✓ |
| Relaxed (400ms) | Leisurely fade, can feel sluggish | |

**User's choice:** Smooth (250ms)
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| CSS opacity transition | Fade out/in via CSS transitions, works everywhere | ✓ |
| Instant swap | Skip animation on unsupported browsers | |
| You decide | Claude picks best fallback | |

**User's choice:** CSS opacity transition as View Transition API fallback
**Notes:** None.

---

## CSS Coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind in new file | Separate CSS entry point, old style.css untouched | ✓ |
| Gradually replace in style.css | Add Tailwind into existing file, replace sections | |
| You decide | Claude picks coexistence strategy | |

**User's choice:** Tailwind in new file
**Notes:** Both files load in parallel. New screens use Tailwind classes, old markup keeps old classes.

---

## Font & Typography

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both | DM Sans body + Inconsolata digits, already loaded | ✓ |
| Keep DM Sans, drop Inconsolata | One font, tabular-nums for digits | |
| Change fonts | New fonts for the redesign | |

**User's choice:** Keep both fonts
**Notes:** None — redesign is about layout, not branding.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Trim to what's used | DM Sans 400+600, Inconsolata 400+700 | ✓ |
| Keep full range | DM Sans 300-700, Inconsolata variable | |
| You decide | Claude audits and trims | |

**User's choice:** Trim to weights actually used
**Notes:** DM Sans 400+600, Inconsolata 400+700.

---

## Claude's Discretion

- Exact accent green hex values (light and dark mode) — WCAG AA required

## Deferred Ideas

None — discussion stayed within phase scope.
