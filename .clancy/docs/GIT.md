# Git Workflow

## Branches

- `main` — primary branch; push to main triggers Cloudflare Pages auto-deploy
- Feature branches: short-lived, created per ticket (e.g. `claude/add-footer-with-heart-fkqu5`, `dev`)

## Commit Convention

Format: `type(scope): description` or `type(#issue): description`

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructure, no behaviour change |
| `ci` | CI/CD config changes |
| `docs` | Documentation only |
| `chore` | Maintenance, tooling |

**Examples from git log:**
```
feat(#8): Add a line to the footer (#9)
fix: increase footer font size to 16px
fix: halve tech row item gap, increase inter-row spacing
```

## PR Workflow

1. Create feature branch from `main`
2. Implement changes
3. Open PR against `main`
4. Approval via PR comment or review
5. Squash merge to `main`
6. Include `Closes #N` in PR body for auto-issue closure

## Merge Strategy

Squash merge — keeps `main` history clean with one commit per feature.

## Hooks

No active git hooks (`.git/hooks/` contains only sample templates).

## Remote

`origin` → `git@github.com:jevawin/clumeral-game.git`

## Deploy Trigger

Push to `main` → GitHub → Cloudflare Pages auto-deploys. No manual deploy step needed.
