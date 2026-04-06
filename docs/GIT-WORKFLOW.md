# Git workflow

The core rules and workflow summary live in [CLAUDE.md](../CLAUDE.md). This doc covers branch strategy, the full step-by-step, and recovery paths.

## Branches

| Branch | Purpose | Commits |
|--------|---------|---------|
| `main` | Production | PRs from `staging` only (the user merges in GitHub) |
| `staging` | Pre-production review | Merges from approved work branches only — **protected, never commit directly** |
| `dev/thing` | General work without a GitHub issue | Direct commits OK |
| `issue/NUM` | Work linked to a GitHub issue | Direct commits OK |
| `release/thing` | Recovery branch (rare, see below) | Direct off `main` |

Work branches are created off `staging`. The Claude Code harness auto-assigns a `claude/*` branch name per session — ignore it.

## Full workflow

1. **Build** — create `issue/NUM` or `dev/name` off `staging`, commit work, push.
2. **Preview** — share the Cloudflare branch URL: `https://{branch}-clumeral-game.jevawin.workers.dev`.
3. **Review gates** — for non-trivial changes, run DA review (fresh-context subagent, see [DA-REVIEW.md](DA-REVIEW.md)) then self-review ([SELF-REVIEW.md](SELF-REVIEW.md)).
4. **Merge to staging** — on user approval, squash-merge the work branch via `gh pr merge --squash`.
5. **Repeat** for any other work branches ready to ship.
6. **PR to main** — when staging is ready, open a PR from `staging → main`. Provide the staging preview URL and PR link.
7. **Ship** — the user merges the PR on GitHub.
8. **Post-merge sync** — reset staging to match main (commands below).
9. **Post-merge cleanup** — prune remote refs, delete local branch.

## Post-merge sync

`main` uses squash merges, so every `staging → main` merge creates a new commit on `main` with a hash that doesn't exist in `staging`. Without syncing, the two branches drift and the next release PR will conflict on any line that was touched in both branches.

**After the user confirms the main merge, run:**

```bash
git checkout staging
git fetch origin main
git reset --hard origin/main
git push --force-with-lease origin staging
```

This requires force-push to be allowed on `staging`. If it's blocked, the fallback is a PR from a fresh branch that takes main's state and squash-merges into staging — works within protection rules but is messier.

## Post-merge cleanup

```bash
git remote prune origin
git branch -d <merged-work-branch>
```

GitHub auto-deletes merged remote branches. Pruning and deleting locally keeps the working copy clean and prevents branch-list bloat over time.

## Cloudflare preview URLs

- **Work branches**: `https://{branch}-clumeral-game.jevawin.workers.dev`
  (e.g. [https://issue-160-clumeral-game.jevawin.workers.dev](https://issue-160-clumeral-game.jevawin.workers.dev))
- **Staging**: [https://staging-clumeral-game.jevawin.workers.dev](https://staging-clumeral-game.jevawin.workers.dev)
- **Production**: [https://clumeral.com](https://clumeral.com)

When presenting a branch for approval, share the work-branch URL. When staging is ready to ship, share the staging URL and the `staging → main` PR link.

## Recovery: fixing diverged branches

If post-merge sync gets skipped and `staging` drifts from `main`, the next `staging → main` PR will conflict on any lines touched in both branches. Because staging is protected (no merge commits, no force-push through Claude's normal path), the usual merge resolution doesn't work.

**Recovery path:**

1. Create a new branch directly off `main`: `git checkout origin/main -b release/sync-<description>`
2. Overlay staging's working tree onto it: `git checkout origin/staging -- .`
3. Commit as a single "release" commit with a message explaining what's bundled.
4. Push and open a PR from `release/sync-*` → `main`. This PR will be conflict-free because the branch descends directly from main.
5. Close the original stuck `staging → main` PR.
6. Once the release PR is merged, run the post-merge sync to bring staging back into line.

This is a workaround, not a regular pattern. The proper fix is to never skip the post-merge sync in the first place.
