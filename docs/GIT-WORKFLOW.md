# Git workflow

## Branches

| Branch | Purpose | Commits |
|---|---|---|
| `main` | Production | PRs from `staging` only. User merges on GitHub. |
| `staging` | Pre-prod review | Merges from approved work branches only. **Protected. Never commit directly.** |
| `dev/name` | Work without a GitHub issue | Direct commits OK. Off `staging`. |
| `issue/NUM` | Work linked to GitHub issue | Direct commits OK. Off `staging`. |
| `release/thing` | Recovery branch (rare) | Direct off `main`. See recovery section. |

Harness auto-assigns `claude/*` — ignore it.

## Flow

1. Create `issue/NUM` or `dev/name` off `staging`, commit, push
2. Share preview: `https://{branch}-clumeral-game.jevawin.workers.dev`
3. Review gates for non-trivial changes: DA review (fresh subagent) → self-review
4. On user approval: `gh pr merge --squash` into `staging`
5. Repeat for other work branches
6. When staging ready: open PR `staging → main`, share staging URL + PR link
7. User merges on GitHub
8. Run post-merge sync + cleanup (below)

## Preview URLs

- Work: `https://{branch}-clumeral-game.jevawin.workers.dev`
- Staging: `https://staging-clumeral-game.jevawin.workers.dev`
- Prod: `https://clumeral.com`

## Post-merge sync

`main` uses squash merges → new commit hash not in `staging`. Without sync, branches drift and next release PR conflicts.

After user confirms main merge:

```bash
git checkout staging
git fetch origin main
git reset --hard origin/main
git push --force-with-lease origin staging
```

Requires force-push allowed on `staging`. If blocked, use recovery path below.

## Post-merge cleanup

```bash
git remote prune origin
git branch -d <merged-work-branch>
```

## Recovery: diverged staging/main

If sync was skipped and `staging → main` PR conflicts:

1. `git checkout origin/main -b release/sync-<desc>`
2. `git checkout origin/staging -- .` (overlay staging tree)
3. Commit as single "release" commit explaining what's bundled
4. Push, open PR `release/sync-* → main` — conflict-free (descends from main)
5. Close the stuck `staging → main` PR
6. After merge, run post-merge sync to bring staging back in line

Workaround, not regular pattern. Fix is to never skip post-merge sync.
