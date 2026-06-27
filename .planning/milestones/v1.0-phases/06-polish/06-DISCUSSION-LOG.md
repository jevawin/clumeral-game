# Phase 6: Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 06-polish
**Areas discussed:** Background decorations, Old class cleanup, Regression scope

---

## Background Decorations

| Option | Description | Selected |
|--------|-------------|----------|
| Drop both | Clean, minimal background — just bg colour. Matches Wordle-inspired simplicity. Removes colours.ts canvas code too. | ✓ |
| Keep canvas dots only | Subtle dot-grid texture stays, geometric shapes go. Migrate canvas styles to tailwind.css. | |
| Keep both | Migrate both canvas + shape styles to tailwind.css. Same visual as today, just in Tailwind. | |

**User's choice:** Drop both (Recommended)
**Notes:** Also confirmed deleting colours.ts entirely — only handles canvas dots and colour swatches, both removed in new design.

### Follow-up: colours.ts Deletion

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, delete it | colours.ts only handles canvas dots and colour swatches — both gone. Clean removal. | ✓ |
| Keep colours.ts | Preserve file in case dot-grid wanted later. Dead code, but available. | |

**User's choice:** Yes, delete it

---

## Old Class Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Convert to Tailwind inline | Replace .game, .header, .digit-box etc. with Tailwind utility classes in HTML. Fully utility-first. Bigger HTML diff but consistent. | ✓ |
| Keep names, move styles | Keep .game, .header etc. in HTML, rewrite rules in tailwind.css. Smaller diff, mixed approach. | |
| Semantic data attributes | Replace BEM classes with data-* attributes for JS hooks, Tailwind for styling. | |

**User's choice:** Convert to Tailwind inline (Recommended)

### Follow-up: JS Selectors

| Option | Description | Selected |
|--------|-------------|----------|
| Data attributes | JS uses data-* selectors (already the pattern in newer code). Styling decoupled from behaviour. | ✓ |
| Keep class selectors | JS keeps querying by class name. Simpler migration but couples styling to behaviour. | |

**User's choice:** Data attributes (Recommended)

---

## Regression Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Manual browser check | Walk through each screen in dev server. Both light/dark. Mobile + desktop viewport. User does final sign-off. | ✓ |
| Focused on game screen | Prioritise game screen (most complex), lighter check on welcome/completion. | |
| Screenshot comparison | Before/after screenshots of each screen state for side-by-side diff. | |

**User's choice:** Manual browser check (Recommended)

### Follow-up: Fragile Areas

| Option | Description | Selected |
|--------|-------------|----------|
| Octo animation | Celebration + click-to-replay — complex positioning and keyframes in style.css. | ✓ |
| Clue digit indicators | Small digit boxes in clues showing which positions apply — intricate styling. | ✓ |
| No specific worries | General walkthrough, flag anything off. | |

**User's choice:** Octo animation, Clue digit indicators (multi-select)

---

## Claude's Discretion

- Migration order and intermediate testing approach
- Whether to batch HTML class conversion or do element-by-element

## Deferred Ideas

None — discussion stayed within phase scope.
