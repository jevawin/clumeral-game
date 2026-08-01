# DA Review

The devil's-advocate checklists are skills, so the bot loads them at the right stage:

- `.claude/skills/da-brief/` — reviews the brief before planning
- `.claude/skills/da-plan/` — reviews the plan before building
- `.claude/skills/da-build/` — reviews the code after human review, before pushing

`da-build` carries the code checklist that used to live in this file, unchanged, plus a
first pass checking the diff against the agreed brief.
