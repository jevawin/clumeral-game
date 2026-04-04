# Clumeral — Claude Instructions

**Clumeral** (clumeral.com) is a daily browser word puzzle game. A seeded random algorithm filters numbers 100–999 down to one answer using column-based clues. The player reads the clues and guesses the hidden number. New puzzle every day, same answer for everyone.

## Key docs

Read the relevant doc **before** working in that area:

| Working on | Read |
|------------|------|
| Puzzle logic, seeding, localStorage | `docs/ARCHITECTURE.md` |
| CSS, theming, clue display | `docs/DESIGN-SYSTEM.md` |
| Code patterns, accessibility, DOM | `docs/CONVENTIONS.md` |
| Pre-PR review (architecture) | `docs/DA-REVIEW.md` |
| Pre-PR review (line-level) | `docs/SELF-REVIEW.md` |

## Dev server

```bash
npm run dev
# Vite dev server with Worker running in Cloudflare Workers runtime
# PUZZLE_DATA is injected by the Worker, same as production
```

## Git workflow

**Both `main` and `staging` are protected — never commit or push to them directly.**

### Branches

| Branch | Purpose | Commits |
|--------|---------|---------|
| `main` | Production | PRs from `staging` only (the user merges in GitHub) |
| `staging` | Pre-production review | Merges from approved work branches only — **protected, never commit directly** |
| `dev/thing` | General work (no GitHub issue) | Direct commits OK |
| `issue/NUM` | Work linked to a GitHub issue | Direct commits OK |

Create work branches off `staging`. Legacy branches (`dev`, `colours`) are being retired — leave them as-is.

### Harness branch workaround

The Claude Code harness auto-assigns a `claude/*` branch name per session. **Ignore it.** Create `issue/NUM` or `dev/name` off `staging` instead. After merging into `staging`, switch back to the work branch.

Orphan `claude/*` branches and leftover remote work branches can't be deleted by Claude. **The repo owner must prune these** via the GitHub UI or `git push origin --delete <branch>`.

### Workflow

1. **Build** — Claude creates `issue/NUM` or `dev/name` branches off `staging`, commits work, pushes, and provides the Cloudflare preview URL for each branch
2. **Branch review** — the user tests each branch via its preview URL as work progresses
3. **Merge to staging** — Claude waits for the user's explicit approval, then merges approved branches into `staging`, creates a PR from `staging` → `main`, and provides both the staging preview URL and the PR link
4. **Final review** — the user tests staging with all branches combined
5. **Ship** — the user merges the PR to `main` from GitHub

**Key rules:**
- **Never merge to `main`** — the user does this from GitHub. No exceptions unless the user explicitly grants override permission with a stated reason.
- **Never merge to `staging` without approval** — wait for the user to confirm each branch
- After merging to `staging`, switch back to the work branch — never commit directly to `staging`
- **Never run `wrangler deploy` or `npm run deploy`** — deployment is automatic via Cloudflare Git integration on merge to `main`

### Cloudflare preview URLs

Provide these as clickable markdown links after pushing:
- **Feature branches**: `https://{branch}-clumeral-game.jevawin.workers.dev` (e.g. [https://issue-109-clumeral-game.jevawin.workers.dev](https://issue-109-clumeral-game.jevawin.workers.dev))
- **Staging**: [https://staging-clumeral-game.jevawin.workers.dev](https://staging-clumeral-game.jevawin.workers.dev)

No need to link PRs for branch → staging — just the Cloudflare branch URL. When approved and merged, provide the staging URL **and** the `staging` → `main` PR URL.

## Deployment

Push to `main` → GitHub → Cloudflare Pages builds with `npm run build` → auto-deploys from `dist/client`.

- **Production**: [https://clumeral.com](https://clumeral.com)
- **Merge method**: squash only (merge commits disabled on the repo)
- **Build command**: `npm run build`
- **Output directory**: `dist/client`

## Skills

- `/add-to-roadmap` — when the user says "add to roadmap" or similar, invoke this skill to create a structured GitHub issue labelled `roadmap`, assigned to `jevawin`

## Process directives

### Session management

- **Hand off after 3 PRs** or when context compression is detected (responses get vaguer, repeat themselves, miss things)
- **Handoff summary**: update `PROGRESS.md` with what was completed, what's next, decisions made, blockers, and current branch state
- `PROGRESS.md` is the living document — the next session reads it to pick up where the last left off

### Review gates

For non-trivial changes (new features, changed logic, refactored modules), run the full review gate before creating a PR. Trivial changes (typos, formatting, config tweaks) can skip DA but should still get a self-review pass.

**Review order matters — never skip or reorder:**

1. **DA Review** — spin up a subagent in fresh context to review all changed files. Follow `docs/DA-REVIEW.md` checklist item by item. Medium+ findings must be fixed before proceeding.
2. **Self-Review** — read every changed file (`git diff staging...HEAD`) and run through `docs/SELF-REVIEW.md`. Catches line-level accuracy issues the DA misses.
3. **Create PR** — only after both reviews pass.

### Living checklists

`docs/DA-REVIEW.md` and `docs/SELF-REVIEW.md` are living documents. When a review (or the user) catches something the checklist should have spotted, add the specific check immediately.

### Context management

- Use subagents for exploration and DA reviews (protect main context window)
- DA reviews must run in fresh context — the agent that wrote the code should not be the same context that reviews it
