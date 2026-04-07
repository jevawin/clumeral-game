# Clumeral — Claude operating rules

Clumeral is a daily number puzzle at [clumeral.com](https://clumeral.com). Project overview and dev setup are in [README.md](README.md).

---

## Rules (non-negotiables)

- **Never commit to `main` or `staging`** — both are protected. Work branches only.
- **Never merge to `main`** — the user does it on GitHub. No exceptions unless explicitly granted with a reason.
- **Never run `wrangler deploy` or `npm run deploy`** — deployment is automatic on merge to `main`.
- **Follow the review gates** — DA review first (fresh-context subagent), then self-review, then PR. Required when a change touches more than one file, adds/removes >30 lines, changes puzzle logic, CSS/theming, or accessibility. Skip only for single-file typo/copy fixes. See [docs/DA-REVIEW.md](docs/DA-REVIEW.md) and [docs/SELF-REVIEW.md](docs/SELF-REVIEW.md).
- **After merging `staging → main`**, run the post-merge sync (below). Skipping this causes divergence.
- **After any PR merge**, run post-merge cleanup: `git remote prune origin` and delete the local branch.

## Workflow

1. **Ask → Plan → Build** for new issues or tasks. Small tweaks inside an ongoing task can skip straight to building.
2. When starting work, committing, pushing, or merging, follow [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) — branches, preview URLs, staging/main flow, and recovery paths.

## Context hygiene

Prompt the user to run `/clear` at these trigger points:

- Before starting a new issue or task
- After shipping a PR to main
- After a big refactor or debugging session

## When working in specific areas, read the relevant doc first

| Working on | Read |
|------------|------|
| Puzzle logic, seeding, storage | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| CSS, theming, clue display | [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) |
| Code patterns, accessibility, DOM | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| Git workflow, branch strategy, recovery | [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) |
| Pre-PR architecture review | [docs/DA-REVIEW.md](docs/DA-REVIEW.md) |
| Pre-PR line-level review | [docs/SELF-REVIEW.md](docs/SELF-REVIEW.md) |
| Adding a roadmap item as a GitHub issue | [docs/ROADMAP-ISSUES.md](docs/ROADMAP-ISSUES.md) |

Update the respective doc if it's incorrect or your work makes it outdated.
