---
name: add-to-roadmap
description: Add an item to the project roadmap as a GitHub issue
user_invocable: true
---

# Add to Roadmap

The user wants to add something to the roadmap. Create a well-structured GitHub issue in `jevawin/clumeral-game`, assigned to `jevawin`, labelled `roadmap`.

## Gather context

If the user gave a brief one-liner, ask these questions before creating the issue (skip any that are already obvious from context):

1. **What problem does this solve or what does it improve?** — helps write a clear description
2. **Acceptance criteria** — "How will we know this is done?" Get at least 2-3 bullets
3. **Priority** — P1 (next up), P2 (soon), P3 (nice to have). Default to P2 if not specified.
4. **Category** — gameplay, UI/UX, infrastructure, content, or bug
5. **Milestone** — should this go in the current milestone, a future one, or just backlog?

If the user already provided enough detail, don't over-ask — just confirm and create.

## Create the issue

First, ensure the `roadmap` label exists:

```
gh label create roadmap --repo jevawin/clumeral-game --color "0E8A16" --description "Roadmap item" 2>/dev/null || true
```

If the user specified a priority, also add the priority label (`P1`, `P2`, or `P3`).
If the user specified a category, also add it as a label.

Use this issue body format:

```
## What
[One or two sentences describing the feature/change]

## Why
[The problem it solves or value it adds]

## Acceptance criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Notes
[Any additional context, constraints, or references. Omit section if empty.]
```

Create with:
```
gh issue create --repo jevawin/clumeral-game \
  --title "<title>" \
  --body "<body>" \
  --assignee jevawin \
  --label roadmap[,priority-label][,category-label]
```

If a milestone was specified and exists, add `--milestone "<name>"`.

## After creation

- Show the user the issue URL
- Give a one-line summary of what was created
