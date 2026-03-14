# Git Conventions

## Branch Naming

- `main` — production branch, auto-deploys to Cloudflare Pages
- `dev` — general development (observed in git history)
- `claude/<ticket-slug>` — clancy implementation branches (e.g. `claude/add-footer-with-heart-fkqu5`)

Clancy uses `claude/<slug>` pattern automatically when implementing tickets.

## Commit Format

`<type>: <description>` — lowercase type, colon, space, imperative description.

Types in use: `feat`, `fix`, `refactor`, `chore`, `ci`, `docs`

Examples from history:
```
fix: increase footer font size to 16px
fix: halve tech row item gap, increase inter-row spacing
fix: tighten gap between footer logos and entity names
fix: swap footer rows — tech credits above credits
chore(clancy): initialise — scaffold docs, config, commands, and hooks
```

Scopes in parentheses where relevant: `chore(clancy):`, `docs(clancy):`.

## Merge Strategy

Merge commits via pull request (observed: `Merge pull request #4 from jevawin/dev`).

Clancy squash-merges its implementation branches into the base branch.

## Pull Request Process

1. Branch from `main` (or `dev` for manual work)
2. Implement changes
3. Open PR on GitHub
4. Review
5. Merge → Cloudflare Pages auto-deploys

## Versioning

No semantic versioning. Puzzle versioning is date-based:
- Epoch date: `2026-03-08` = Puzzle #1
- Puzzle number computed from days since epoch (see `puzzle.js`)
