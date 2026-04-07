# Roadmap issues

When the user wants to add a roadmap item, create a GitHub issue in `jevawin/clumeral-game`.

## Required on every issue

1. **Assignee**: `jevawin` (always)
2. **`roadmap` label**
3. **Priority label**: `P1` (next up) / `P2` (soon) / `P3` (nice to have). Default `P2`.
4. **Thematic label**: one or more from the existing set. New label only if theme will recur — confirm with user first.
5. **Structured body** (template below)

## Thematic labels in use

- `UI/UX` — visual design, layout, interaction
- `gameplay` — puzzle logic, game modes, mechanics
- `accessibility` — WCAG, screen readers, keyboard nav
- `hygiene` — housekeeping, refactors, tooling, tests, code quality
- `SEO` — search appearance, meta, indexing
- `analytics` — tracking, metrics
- `bug` — something broken

## Body template

Adapt — not every section applies. Bug fix might only need What / Why / Acceptance criteria. Bigger feature wants the full set.

```markdown
## What
[One or two sentences. Plain English.]

## Why
[Problem solved or player value. For bigger items, user-story framing works: "As a player, I want X so that Y."]

## Must have
- [Core requirement]

## Nice to have
- [Optional enhancement]

## Details
[Approach, constraints, options. Sub-headings OK for big items.]

## Open questions
- [Pending decision]

## Acceptance criteria
- [ ] [Specific, testable outcome]
```

### Section notes

- **What** — always
- **Why** — always, except trivial fixes
- **Must/Nice** — when scope is fuzzy or tiered. Skip for small well-defined changes.
- **Details** — when approach matters
- **Open questions** — only if decisions are pending. Don't invent them.
- **Acceptance criteria** — always for features. Checkboxes. Each must be tickable in review.

## Gather context

Ask only what you can't infer from the user's request:

1. What problem does this solve?
2. Acceptance criteria — how will we know it's done?
3. Priority — P1/P2/P3?
4. Theme — existing label or new?
5. Must-have vs nice-to-have if scope is fuzzy

Don't over-ask. If the user gave enough detail, confirm and create.

## Create

Ensure label exists (idempotent):

```
gh label create roadmap --repo jevawin/clumeral-game --color "0E8A16" --description "Roadmap item" 2>/dev/null || true
```

```
gh issue create --repo jevawin/clumeral-game \
  --title "<title>" \
  --body "<body>" \
  --assignee jevawin \
  --label roadmap,<priority>,<theme>
```

Add `--milestone "<name>"` if specified and existing.

## After

- Show issue URL
- One-line summary of what was created
