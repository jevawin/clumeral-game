## Summary

<!-- What does this PR do and why? One paragraph. -->

## Changes

<!-- Bullet list of what changed. Group by file or concern. -->

-

## Type of change

- [ ] Feature — new functionality
- [ ] Fix — bug fix
- [ ] UI/UX — visual or interaction change
- [ ] Hygiene — refactor, config, docs, cleanup

## Checklist

### Code quality

- [ ] No `console.log` left in production code
- [ ] No hardcoded colours — uses CSS custom properties
- [ ] Both light and dark themes checked
- [ ] Fluid layout preserved (no fixed breakpoints)

### Accessibility

- [ ] Colour contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Keyboard navigable (Tab, Enter, Escape)
- [ ] Semantic HTML and ARIA attributes where needed

### Architecture

- [ ] `puzzle.ts` has no UI code; `app.ts` has no filter/compute logic
- [ ] No new DOM IDs without updating CLAUDE.md locked list
- [ ] No PII collected or transmitted

### Review

- [ ] DA review completed (for non-trivial changes)
- [ ] Self-review checklist completed ([SELF-REVIEW.md](../docs/SELF-REVIEW.md))

## How was this tested?

<!-- What did you verify? Dev server, both themes, mobile viewport, etc. -->

## Related issues

<!-- Closes #N, Fixes #N, or "None" -->
