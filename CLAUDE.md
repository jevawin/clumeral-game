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

Every roadmap item follows at least a minimal **discuss → plan → execute → review** cycle:

1. **Discuss** — confirm scope, surface assumptions and gray areas, and **agree the QA level** the change warrants, before building. Small tweaks inside an ongoing task can skip this.
2. **Plan** — break the work into steps proportional to size (a sentence for small items, a written plan for big ones) and **state the QA scope** the plan will deliver.
3. **Execute** — build it with atomic commits.
4. **Review** — the review gates above (DA review → self-review) before any PR.

**Tooling is your discretion.** Run it yourself following this cycle, use GSD (`/gsd-*`), or use superpowers skills — whichever fits the item.

**QA is proportional and decided up front.** The level of automated QA (Playwright e2e against the production build) is set during discuss/plan, matched to the change — a header tweak warrants little or none; a long or logic-heavy task warrants the full suite. Don't run a 40-minute QA battering on a trivial change. Suite design: [QA regression spec](docs/superpowers/specs/2026-05-31-playwright-qa-regression-design.md).

When starting work, committing, pushing, or merging, follow [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) — branches, preview URLs, staging/main flow, and recovery paths.

## Context hygiene

Prompt the user to start a new chat at these trigger points (the user keeps old chats to revisit, so don't suggest `/clear`):

- Before starting a new issue or task
- After merging a PR (to staging or main)
- After a big refactor or debugging session

## When working in specific areas, read the relevant doc first

| Working on | Read |
|------------|------|
| Starting any task — current priorities, what's next | [Clumeral Roadmap board](https://github.com/users/jevawin/projects/3) — top of _Now_, then _Next_. How to manage it: [docs/ROADMAP.md](docs/ROADMAP.md) |
| Puzzle logic, seeding, KV storage, **archive integrity** (puzzles are KV write-once — generator changes don't rewrite history) | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Routing, URL rules, screen transitions | [docs/URL-ARCHITECTURE.md](docs/URL-ARCHITECTURE.md) |
| CSS, theming, clue display | [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) |
| Code patterns, accessibility, DOM | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| Git workflow, branch strategy, recovery | [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) |
| Pre-PR architecture review | [docs/DA-REVIEW.md](docs/DA-REVIEW.md) |
| Pre-PR line-level review | [docs/SELF-REVIEW.md](docs/SELF-REVIEW.md) |
| Adding a roadmap item as a GitHub issue | [docs/ROADMAP-ISSUES.md](docs/ROADMAP-ISSUES.md) |
| Feedback — storage (D1), reading it, triage process | [docs/FEEDBACK.md](docs/FEEDBACK.md) |

Update the respective doc if it's incorrect or your work makes it outdated.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Clumeral Redesign**

Clumeral is a daily number puzzle at clumeral.com. Players get clues about a 3-digit number and eliminate possibilities to find the answer. This project restructures the app from a single busy page into three clean, focused screens — welcome, game, completion — inspired by Wordle's simplicity. The entire UI gets rebuilt from scratch in Tailwind CSS with a minimal colour palette.

**Core Value:** The game screen must work flawlessly — clues, digit elimination, guess submission, and answer validation must all function exactly as they do today, just in a cleaner layout.

### Constraints

- **Tech stack**: Tailwind CSS, existing Vite + Cloudflare Workers setup stays
- **Backend**: No worker/API changes — frontend-only rebuild
- **Compatibility**: Must work on all current browsers (ES2022 target)
- **Performance**: Celebration animation must be skippable and under 3s
- **Design**: Under 15 semantic colour tokens in tailwind.config.ts
<!-- GSD:project-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
