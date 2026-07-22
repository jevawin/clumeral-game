# Git workflow

## Branches

| Branch | Purpose | Commits |
|---|---|---|
| `main` | Production | PRs from `staging` only, merged with a **merge commit** (not squash). User merges on GitHub. |
| `staging` | Pre-prod review | Merges from approved work branches only. **Protected. Never commit directly.** |
| `dev/name` | Work without a GitHub issue | Direct commits OK. Off `staging`. |
| `issue/NUM` | Work linked to GitHub issue | Direct commits OK. Off `staging`. |
| `release/thing` | Recovery branch (rare) | Direct off `main`. See recovery section. |

Harness auto-assigns `claude/*` — ignore it.

## Flow

1. Create `issue/NUM` or `dev/name` off `staging`, commit, push
2. Share preview: `https://{branch}-clumeral-game.jevawin.workers.dev`
3. Review gates for non-trivial changes: DA review (fresh subagent) → self-review
4. On user approval: `gh pr merge --squash` into `staging` (work branches are short-lived → squash)
5. Repeat for other work branches
6. When staging ready: open PR `staging → main`, share staging URL + PR link — **list a `Closes #NUM` line for every issue in the bundle** (see below)
7. User merges on GitHub with a **merge commit** ("Create a merge commit" — NOT squash; see Post-merge sync for why)
8. Run post-merge sync + cleanup (below)

## Closing references on release PRs

Every `staging → main` PR body must carry one `Closes #NUM` line per issue it ships. GitHub only
auto-closes on merge to the default branch, and only from the PR body or a commit message — naming
the issue in prose does nothing.

Skipping this is not cosmetic. The 2026-07-22 sweep found **8 issues that had shipped weeks earlier
and were still open** (#81, #155, #194, #199, #202, #228, #249, #255), because #254, #258 and #261
each described their issues in prose without a single closing reference. The roadmap and the issue
list drifted apart until someone read the code to work out what was actually done.

Squash-merging a work branch into `staging` does **not** close anything — `staging` is not the
default branch. The closing reference has to be on the `staging → main` PR.

## Preview URLs

- Work: `https://{branch}-clumeral-game.jevawin.workers.dev`
- Staging: `https://staging-clumeral-game.jevawin.workers.dev`
- Prod: `https://clumeral.com`

## Post-merge sync

The `staging → main` PR is merged with a **merge commit**, not squash. That keeps `staging` an ancestor of `main`, so realigning staging is a plain fast-forward — no force-push, no history rewrite.

(Why not squash here: squashing `staging → main` creates a new commit on `main` that `staging` lacks, so the two permanent branches diverge and the only way back is `reset --hard` + force-push. Squash is right for short-lived work branches into `staging`, not between two long-lived branches.)

After the user confirms the main merge:

```bash
git checkout staging
git fetch origin
git merge --ff-only origin/main   # fast-forwards staging up to main; fails loudly if it can't
git push origin staging
```

No `--force` needed. If `--ff-only` refuses, `staging` and `main` have diverged (e.g. the release got squash-merged by mistake) — use the recovery path below.

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
6. After merge, staging is still diverged, so realign it once with a hard reset (the fast-forward sync can't bridge a divergence):
   ```bash
   git checkout staging
   git fetch origin
   git reset --hard origin/main
   git push --force-with-lease origin staging
   ```
   From the next release on, merge-commit + fast-forward keeps them aligned.

Workaround, not regular pattern. Fix is to merge releases with a merge commit (not squash) and run the fast-forward sync each time.
