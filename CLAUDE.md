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

## How work happens here

Brief → Plan → Build, each closed by a fresh-context devil's-advocate review, with context
cleared between stages.

1. **Brief** — `.claude/skills/briefing/`. 11 sections, one at a time, every item carrying
   a recommendation. Writes `docs/work/<date>-<slug>-brief.md`.
2. `da-brief` review → clear context.
3. **Plan** — `.claude/skills/planning/`, working from the brief file. Writes
   `docs/work/<date>-<slug>-plan.md`. Jamie approves it.
4. `da-plan` review → clear context.
5. **Build** — from the plan file. Then human review, then `da-build`, then push and PR.

The brief and plan files are committed on the feature branch and merge with the PR. They
are the memory across the context clears: **anything agreed only in chat is lost.**

Ownership: Jamie owns types, accessibility, plan approval and merges. Dave owns maths.
Everything else is joint and needs both — blocking sign-off on owned sections, a
non-blocking ack on joint ones.

## Workflow

The cycle below is the general shape; **Brief → Plan → Build above is how it is actually
run**, and where the two differ, the stages above win.

Every roadmap item follows at least a minimal **discuss → plan → execute → review** cycle:

1. **Discuss** — confirm scope, surface assumptions and gray areas, and **agree the QA level** the change warrants, before building. Small tweaks inside an ongoing task can skip this.
2. **Plan** — break the work into steps proportional to size (a sentence for small items, a written plan for big ones) and **state the QA scope** the plan will deliver.
3. **Execute** — build it with atomic commits.
4. **Review** — the review gates above (DA review → self-review) before any PR.

**Tooling is your discretion.** Run it yourself following this cycle, or use superpowers skills (`brainstorming`, `writing-plans`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `requesting-code-review`) — whichever fits the item.

**QA is proportional and decided up front.** The level of automated QA (Playwright e2e against the production build) is set during discuss/plan, matched to the change — a header tweak warrants little or none; a long or logic-heavy task warrants the full suite. Don't run a 40-minute QA battering on a trivial change. Suite design: [QA regression spec](docs/superpowers/specs/2026-05-31-playwright-qa-regression-design.md).

When starting work, committing, pushing, or merging, follow [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) — branches, preview URLs, staging/main flow, and recovery paths.

## Environments and database migrations

**One Worker, two environments.** Pre-prod is not a second Worker — it is the same
`clumeral-game` Worker, and pre-prod builds are *versions* of it, uploaded but
never deployed. That is why preview URLs are unchanged and why `HMAC_SECRET` (a
per-Worker secret) is available in both.

- **production** — the `main` branch. `clumeral-feedback`, `clumeral-analytics`,
  the daily cron. Served on `clumeral.com`.
- **preprod** — every other branch, sharing one environment.
  `clumeral-feedback-preprod`, `clumeral-analytics-preprod`. Served on
  `<branch>-clumeral-game.jevawin.workers.dev`.

**Pre-prod stays on `workers.dev`, and there is no `staging.clumeral.com`.** This was
asked for and rejected on 2026-08-05, so it does not need re-deciding:

> "You cannot currently configure Preview URLs to run on a subdomain other than
> workers.dev."
> — https://developers.cloudflare.com/workers/configuration/previews/

A custom domain attaches to a **deployment**; pre-prod builds are **versions**, uploaded and
never deployed. So a custom hostname cannot reach a pre-prod build at all. Getting one would
mean a **second, separately deployed Worker** — which is what the environment split
deliberately avoided, because `HMAC_SECRET` is a per-Worker secret whose absence fails
*silently*: `TextEncoder.encode(undefined)` yields `""`, making the signing key
`SHA-256("")` and every random-puzzle token forgeable.

**`dev.clumeral.com` is unrelated to this.** Edit mode's read-only view is served
from the Pi over a `cloudflared` tunnel, and a named tunnel can create a
`dev.clumeral.com` record on the production zone. That is a record pointing at a
home machine, not a Worker hostname, so it neither contradicts nor reopens the
decision below. See [docs/EDIT-MODE.md](docs/EDIT-MODE.md).

Jamie's call, 2026-08-05: keep `workers.dev` for pre-prod. Isolation was the point and it is
already delivered by `env.preprod`; the hostname was only ever cosmetic. Closed #260. The one
real cost is that service-worker and PWA behaviour is exercised on a different origin shape
than production — if that ever bites, *that* is the reason to revisit, not the aesthetics.

`PUZZLES` KV and the Analytics Engine dataset are **shared** by both, and are
restated in `env.preprod` because wrangler does not inherit them. Sharing PUZZLES
is safe only because pre-prod versions are never deployed and so never run
`scheduled()`, and the cron is the sole writer (`src/worker/daily-puzzle.ts`,
#257).

**To add a table or column:** drop a `.sql` file into `migrations/feedback/` or
`migrations/analytics/` — the directory chooses the database, via `migrations_dir`
in `wrangler.jsonc`. Number it after the highest existing migration, across both
directories. `wrangler d1 migrations apply` applies it automatically: to pre-prod
when your branch builds, to production when the pull request merges. Nobody runs
a command.

**Rules:**
- **Never run wrangler against a remote database.** The guard hook blocks
  `wrangler d1 … --remote` and that is correct. Use `--local`.
- **Never deploy the preprod environment.** Both environments share the Worker
  name, so `--env preprod` on a deploy would overwrite production. Pre-prod is
  reached only by `versions upload`.
- **Migrations are additive only.** They run before the new version is live, so
  they must leave the currently-deployed code working. Add columns and tables;
  never drop or rename in the same pull request as the code that stops using them.
- **Destructive SQL is refused** by `npm run lint:migrations` unless the file is
  named `*.destructive.sql`. Only Jamie adds one. `UPDATE … SET` is allowed —
  backfilling a new column is additive.
- **Adding a new wrangler binding?** It must be added to `env.preprod` too.
  `d1_databases`, `kv_namespaces`, `analytics_engine_datasets` and `vars` are
  **not inherited** by an env block, and omitting one is only a warning — the
  deploy succeeds and the Worker throws at runtime.
- Creating a new *database* is still a human step. Declare the binding and say so
  in the pull request.

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
| Edit mode — the dev-only design tool, the session file `/fold` reads, Dave's read-only link | [docs/EDIT-MODE.md](docs/EDIT-MODE.md) |
| Feedback — storage (D1), reading it, triage process | [docs/FEEDBACK.md](docs/FEEDBACK.md) |
| Analytics — event storage (D1), `/stats`, the chart, the Analytics Engine migration | [docs/ANALYTICS.md](docs/ANALYTICS.md) |

Update the respective doc if it's incorrect or your work makes it outdated.

## Outstanding actions

Things owed that no test or CI job will remind anyone about. Surfaced when the topic comes
up in conversation — **there is no scheduled reminder and Claude cannot send one unprompted.**

- **2026-09-02 — the accessibility pass on the finished stats panel is still owed
  (stats-Tailwind brief item 34).** The Tailwind conversion was signed off on the basis
  that it changes nothing a screen reader hears: same DOM order, same `aria-` attributes,
  same visually hidden spoken labels. The full pass — contrast at the new sizes, focus
  order, the whole panel with a real screen reader — was deliberately deferred until the
  redesign that follows the conversion lands. Jamie owns accessibility, so it is his call
  when to run it.
- **2026-08-08 — did the shorter puzzles make the game too hard? (#193).** Watch
  `incorrect_guess` divided by `puzzle_complete` on production for a fortnight after the merge.
  Baseline for the 30 days to 2026-08-08: 285 / 466 = **0.61**. If it holds at **0.85 or above
  for a week**, reopen the 4–6 clue range with Jamie and Dave. Read it from `/stats` or
  `clumeral-analytics`; the caveats on that ratio are in [docs/ANALYTICS.md](docs/ANALYTICS.md).
- **2026-08-04 — compare D1 analytics against Analytics Engine before retiring AE.** Jamie:
  "we'll look at d1, ask you to compare vs ae in a few days." Run
  `node scripts/compare-ae-d1.mjs`; the pass condition and the PR 3 removal checklist are in
  [docs/ANALYTICS.md](docs/ANALYTICS.md).

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

## Workflow enforcement (superpowers)

Before making non-trivial changes, invoke the matching superpowers skill so planning artifacts and review gates stay in sync:

- **`brainstorming`** — new features, before writing any code
- **`writing-plans`** — multi-step work after brainstorming
- **`systematic-debugging`** — bugs, test failures, unexpected behaviour
- **`test-driven-development`** — writing implementation
- **`verification-before-completion`** — before claiming work is done or committing
- **`requesting-code-review`** / **`receiving-code-review`** — the review gates before opening a PR

Single-file typo/copy fixes, or tweaks inside an active planned task, can skip this.
