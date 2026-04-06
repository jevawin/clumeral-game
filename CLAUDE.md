# Clumeral — Claude operating rules

Clumeral is a daily number puzzle at [clumeral.com](https://clumeral.com). Project overview and dev setup are in [README.md](README.md).

---

## Rules (non-negotiables)

- **Never commit to `main` or `staging`** — both are protected. Work branches only.
- **Never merge to `main`** — the user does it on GitHub. No exceptions unless explicitly granted with a reason.
- **Never run `wrangler deploy` or `npm run deploy`** — deployment is automatic on merge to `main`.
- **Follow the review gates** on non-trivial changes — DA review first (fresh-context subagent), then self-review, then PR.
- **After merging `staging → main`**, run the post-merge sync (below). Skipping this causes divergence.
- **After any PR merge**, run post-merge cleanup: `git remote prune origin` and delete the local branch.

## Workflow

1. **Ask → Plan → Build** for new issues or tasks. Small tweaks inside an ongoing task can skip straight to building.
2. Work on `issue/NUM` or `dev/name` branches off `staging`. Ignore the `claude/*` branch the harness auto-assigns.
3. Push the branch and share the Cloudflare preview URL: `https://{branch}-clumeral-game.jevawin.workers.dev`.
4. Run review gates on non-trivial changes (see [docs/DA-REVIEW.md](docs/DA-REVIEW.md) and [docs/SELF-REVIEW.md](docs/SELF-REVIEW.md)).
5. On user approval, squash-merge the work branch into `staging` via `gh pr merge --squash`.
6. When staging is ready, open a PR from `staging → main`. The user merges it.
7. After the user confirms the main merge, run post-merge sync + cleanup.

See [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) for the full workflow, branch table, and recovery paths.

## Post-merge sync

After the user merges `staging → main`, run locally:

```bash
git checkout staging
git fetch origin main
git reset --hard origin/main
git push --force-with-lease origin staging
```

Then clean up:

```bash
git remote prune origin
git branch -d <merged-work-branch>
```

## Context hygiene

Long conversations cause me to miss details, repeat myself, and skip rules. To prevent this, **proactively suggest clearing context** at these trigger points:

- **Before starting a new issue or task** — ask: *"Want to `/clear` before we start? Then say 'pick up issue X' to begin fresh."*
- **After shipping a PR to main** — natural milestone; mention that clearing is a good idea before the next piece of work.
- **After a big refactor or debugging session** — context is crowded with intermediate state.

User can also `/clear` any time they notice me getting sloppy.

## When working in specific areas, read the relevant doc first

| Working on | Read |
|------------|------|
| Puzzle logic, seeding, storage | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| CSS, theming, clue display | [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) |
| Code patterns, accessibility, DOM | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| Git workflow, branch strategy, recovery | [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) |
| Pre-PR architecture review | [docs/DA-REVIEW.md](docs/DA-REVIEW.md) |
| Pre-PR line-level review | [docs/SELF-REVIEW.md](docs/SELF-REVIEW.md) |

The review docs are **living documents** — when a review catches something the checklist should have spotted, add the check immediately.

## Skills

- `/add-to-roadmap` — create a structured GitHub issue labelled `roadmap`, assigned to `jevawin`.
