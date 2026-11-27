# Plan — Dependabot alert triage (#381)

**Date:** 2026-11-27
**Branch:** `dev/dependabot-alert-triage`. PR into `staging` (docs/GIT-WORKFLOW.md), never `main`.
**Brief:** [2026-11-27-dependabot-alert-triage-brief.md](2026-11-27-dependabot-alert-triage-brief.md) —
closed. Gates met: no `Ack: pending`; `da-brief` passed with fixes (items 31–42); joint
sections carry Jamie's override; §4 and §9 n/a.
**Approval:** pending — Jamie.
**da-plan:** run once on revision 1 (0 High, 2 Medium, 5 Low); all fixed in revision 2.

Read the brief's "da-brief fixes" section (31–42) first: it amends earlier items by number, and
where they differ the later item wins. Item numbers below are brief item numbers.

No `src/` file changes. The work is three files (`package.json`, `package-lock.json`,
`.github/dependabot.yml`), four GitHub alert dismissals, one comment on #331, and a test run.

---

## Facts re-checked for this plan (2026-11-27)

The brief's evidence block still holds. Re-measured today on this branch:

- `npm ls undici ws esbuild sharp` matches the brief's table exactly: root miniflare
  `4.20260401.0` (undici 7.24.4, ws 8.18.0 deduped onto the plugin's direct ws 8.18.0, sharp
  0.34.5); pool miniflare `4.20260730.0` (undici 7.28.0, ws 8.21.0, sharp 0.35.2); jsdom's own
  undici 8.12.3; esbuild 0.27.3 (vite + root wrangler) and 0.28.1 (pool).
- The open alert list is exactly the 27 numbers in the brief, all `scope: development`.
- Highest patched-at across the 22 undici alerts is 7.30.1 (alerts 60, 72–75); ws alert 16 is
  patched at 8.21.0. So 7.30.2 and 8.23.1 clear every one.
- `undici@7.30.2` is the newest 7.x and needs Node `>=20.18.1`; `ws@8.23.1` is the newest 8.x.
  CI (`node-version: "24"`), `.nvmrc` (24) and local (v24.14.0) all satisfy that.
- Pool facts for the stale comment (item 8): `@cloudflare/vitest-pool-workers@0.19.1` is the
  last 0.19.x; it pins `wrangler 4.116.0`, `miniflare 4.20260730.0`, `esbuild 0.28.1`, and
  peers `vitest ^4.1.0`. `0.20.0` is the first release on `miniflare 5.20260730.0-alpha`.
- `.github/dependabot.yml` is read from the default branch, so the comment edits reach the
  file Dependabot reads only at the next release. They are comments, so that changes nothing.

## Decisions this plan makes (how, not what)

- **D1. One `overrides` block with two parents** (items 31, 32, 33):

  ```json
  "overrides": {
    "miniflare": { "undici": "7.30.2", "ws": "8.23.1" },
    "@cloudflare/vite-plugin": { "ws": "8.23.1" }
  }
  ```

  Placed after `devDependencies` in `package.json`. npm applies a parent-keyed override to
  every copy of that parent, so the `miniflare` key covers root and pool. No global `undici`
  or `ws` key, so jsdom keeps undici 8.12.3.
- **D2. The lockfile is regenerated with `npm install`, then checked by diff.** The only
  lockfile entries allowed to change are `node_modules/**/undici` and `node_modules/**/ws`
  (version, `resolved`, `integrity`, and any `engines`/`dependencies` fields those packages
  carry). A nested undici or ws entry being removed is expected: it dedupes onto the hoisted
  copy once both copies agree. npm does not write `overrides` into the lockfile. Any other
  entry changing is a stop: revert the lockfile, report it, do not commit.
- **D3. Dismissals use `gh api` PATCH with `dismissed_reason=not_used`** (items 13, 16, 42):

  ```bash
  gh api -X PATCH repos/jevawin/clumeral-game/dependabot/alerts/<N> \
    -f state=dismissed -f dismissed_reason=not_used -f dismissed_comment='<comment>'
  ```

  GitHub caps `dismissed_comment` at 280 characters; both comments below fit.
- **D4. Baseline hashes live in the scratchpad, not the repo.** The result (match, or the
  file-list fallback) goes in the PR body.
- **D5. The post-release check (items 14, 30, 37) is owed in two places**: an unticked item in
  the PR body, and #381 stays open until it is done. Work PRs target `staging`, so the PR
  will not close #381 by itself. CLAUDE.md does not change (item 22).
- **D6. The #331 removal step says "remove only when the new tree resolves patched versions
  without them"** (item 21). Reason: #331 moves the plugin and wrangler, not the pool. If the
  `miniflare` override were dropped while the pool still pins `miniflare 4.20260730.0`, the
  pool's undici would fall back to 7.28.0 and reopen alerts. So the step names the check
  (`npm ls undici ws`) rather than an unconditional delete.

### Readings to confirm (Jamie)

- **R1 (item 25).** The item 25 pattern does not fit two of the four alerts word for word.
  esbuild does not come through miniflare: it comes from `wrangler`'s exact pin and `vite`.
  And the pool's sharp 0.35.2 is pinned by `@cloudflare/vitest-pool-workers`, which #331 does
  not touch. The comments below keep the pattern's shape and correct those facts. Reply
  "R1 yes" to take them, or name the wording you want.

## The dismissal list (items 35, 42) — Jamie approves this

`dismissed_reason=not_used` on all four. Done in Task 1, before the PR (item 35).

| Alert | Package | Comment |
|---|---|---|
| 29, 43, 64 | sharp | `Dev-only, transitive via miniflare (pinned by @cloudflare/vite-plugin/wrangler, see #331, and by @cloudflare/vitest-pool-workers). Reaches us only through miniflare's local Images binding, which this project does not use. Removed with #331 and the vitest-plugin move.` |
| 15 | esbuild | `Dev-only, transitive via wrangler's exact pin and vite (see #331). Needs the esbuild dev server running on Windows; we never run that server, and vite 8 does not serve through esbuild. Removed with #331.` |

"Pinned by" in the sharp comment means the miniflare version is pinned; miniflare itself takes
sharp as a range (`^0.34.5`). The comment stays true; R1 is where to tighten it.

Both comments are under 280 characters (checked with `${#s}` before sending; Task 1 step 2).

---

## Task 0 — Baseline, before any change

Items 28, 38, 41. Nothing is committed.

0. Set the scratch folder for every later command: `SCRATCH=<this session's scratchpad directory>; mkdir -p "$SCRATCH"`.
1. `git status` clean. `rm -rf node_modules dist && npm ci`.
2. Record the before-tree: `npm ls undici ws esbuild sharp > $SCRATCH/ls-before.txt`.
3. Prove the build is deterministic (item 38):
   ```bash
   rm -rf dist && npm run build && (cd dist && find . -type f -print0 | sort -z | xargs -0 shasum -a 256) > $SCRATCH/hash-a.txt
   rm -rf dist && npm run build && (cd dist && find . -type f -print0 | sort -z | xargs -0 shasum -a 256) > $SCRATCH/hash-b.txt
   diff $SCRATCH/hash-a.txt $SCRATCH/hash-b.txt
   ```
   - No diff: `hash-a.txt` is the baseline; Task 3 compares hashes.
   - Diff: record which files differ. Write `(cd dist && find . -type f -exec stat -f '%z %N' {} + | sort -k2) > $SCRATCH/size-a.txt` as the baseline instead, and say so in the PR body.

## Task 1 — Dismiss the sharp and esbuild alerts

Items 11, 12, 13, 16, 25, 35, 39, 42. Starts only after Jamie approves this plan, including R1.

1. Re-read each alert's state (`gh api repos/jevawin/clumeral-game/dependabot/alerts/<N> --jq .state`).
   Only `open` alerts are dismissed. Any other state: stop and report.
2. Put each comment in a shell variable, print `${#var}`, and stop if it is over 280.
3. Run D3 for 29, 43, 64 with the sharp comment, and for 15 with the esbuild comment.
4. Verify: `gh api 'repos/jevawin/clumeral-game/dependabot/alerts?state=dismissed&per_page=100' --jq '.[] | "\(.number) \(.dismissed_reason)"'`
   lists 15, 29, 43, 64 as `not_used`.

No commit. Record the four numbers and the time in the PR body.

## Task 2 — The overrides

Items 9, 10, 31, 32, 33.

Test first. These four checks decide the result by their output, not by eye. Before the
change, check 2 prints lines (7.24.4, 7.28.0, 8.18.0, 8.21.0) and check 3 prints 0, so they fail.

```bash
# 1. Tree is valid: must print "exit 0"
npm ls undici ws --all; echo "exit $?"
# 2. No old copy anywhere: must print nothing
npm ls undici ws --all | grep -E 'undici@7\.(24\.4|28\.0)|ws@8\.(18|21)\.0'
# 3. miniflare copies on 7.30.2: must print 2 or more (deduped lines may fold)
npm ls undici --all | grep -c 'undici@7.30.2'
# 4. jsdom untouched: must exit 0
npm ls undici --all | grep -q 'undici@8.12.3'; echo "exit $?"
```

Also, `npm ls ws --all | grep -c 'ws@8.23.1'` prints 2 or more, and no other `ws@` version
appears.

Then:
1. Add the D1 block to `package.json`.
2. `npm install`.
3. Run the check above. It must pass.
4. Apply D2: `git diff package-lock.json` touches only undici/ws entries and the overrides
   mirror. Anything else: stop.
5. Commit `package.json` and `package-lock.json`:
   `fix(deps): override undici and ws under miniflare to patched versions (#381)`.

## Task 3 — Full QA against the change

Items 23, 28, 29, 34, 38, 41. Nothing is committed unless a fallback fires.

1. `rm -rf node_modules dist && npm ci`. Must exit 0 with no `ERESOLVE`.
2. Re-run the Task 2 checks 1–4 on the clean install.
3. `npm test`. Pass condition: 41 test files, all passing. The test count is build-dependent
   (memory: 826 locally vs 822 in CI); use the file count.
4. `rm -rf dist && npm run build`, then hash as in Task 0 and `diff` against the baseline.
   Pass: no diff (or, on the fallback, an identical file list and sizes).
5. Full e2e: `npm run test:e2e`. Port 4173 must be free first (`lsof -i :4173` empty), because
   the exit code can be 0 when Playwright never ran. Read the tail. Pass condition: every
   project that ran reports all passed; Firefox projects report skipped locally (they cannot
   launch here) and that is expected. Count passes per project and record them.
6. Fallback (item 34). If step 3 or 5 fails and the cause is not clear from the output within
   this task:
   - Find which override fails: remove the `ws` override (both keys), `npm install`, re-run
     the failing step. Then restore it, remove the `undici` key instead, and re-run.
     - Only one passes on its own: keep that one, drop the other.
     - Both fail on their own: drop both.
     - Both pass on their own but fail together: drop both. Do not dig further.
   - Dropping the ws override removes `ws` from the `miniflare` key and the whole
     `@cloudflare/vite-plugin` key. Dropping undici removes `undici` from the `miniflare` key.
     An empty `miniflare` key or `overrides` block is removed too.
   - `npm install`, re-run the Task 2 checks for what remains, commit
     `revert(deps): drop <pkg> override, fails <suite> (#381)`.
   - Remove the dropped package's words from the Task 4a note and its mention from the Task 5
     comment. If both are dropped, Task 4a and Task 5 are not done at all.
   - The dropped package's alerts go on a second dismissal list as `tolerable_risk`, comment:
     `Dev-only, transitive via miniflare (pinned by @cloudflare/vite-plugin/wrangler, see #331). Override to <version> broke <suite>; not debugged here. Removed with #331.`
     Jamie approves that exact list in chat. It is sent after the release reaches `main`
     (item 17; item 35 brought forward only sharp and esbuild), and checked in Task 7.
   - Do not patch or debug miniflare.

## Task 4 — `.github/dependabot.yml` comments

Items 8, 15, 36. Comment-only; no key or value changes. Commit:
`docs(dependabot): record miniflare overrides, correct pool pin facts (#381)`.

Test: no changed line is anything but a comment or a blank line. This prints nothing:

```bash
git diff -U0 .github/dependabot.yml | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-][[:space:]]*(#|$)'
```

### 4a. Header note (item 36)

Add after the existing header paragraph, before `version: 2`:

```yaml
#
# package.json also carries npm `overrides` that force undici 7.30.2 and ws 8.23.1
# under miniflare and @cloudflare/vite-plugin (#381). They exist because the pinned
# Cloudflare toolchain (see the ignore entries below and #331) exact-pins vulnerable
# versions, so Dependabot cannot move them. #331 removes them once the new tree
# resolves patched versions without them. npm overrides cannot carry comments,
# which is why this note is here.
```

### 4b. The `@cloudflare/vitest-pool-workers` entry (item 8)

Replace the comment block above that entry (from `# 0.12.21 -> 0.13.0 is a *minor*` to the
line before `- dependency-name: "@cloudflare/vitest-pool-workers"`) with:

```yaml
      # The pool is held at 0.19.1 (#332). Minor has to be ignored here, not only
      # major: Dependabot reads a 0.x minor as a minor — proven, #326 put a
      # 0.12 -> 0.22 jump inside the minor-and-patch group. That mattered first
      # because 0.13.0 is where the vitest 4 peer begins (before #332, the pin
      # was 0.12.21). It matters now because every release from 0.20.0 on ships
      # a miniflare 5 alpha, the prerelease runtime under tests/worker/** that
      # caused #325.
      #
      # Be clear what that costs. 0.19.1 is the LAST 0.19.x release, so patch is
      # allowed in principle but none will ever come: this is a permanent pin,
      # security patches included. The pool hard-depends on wrangler 4.116.0 and
      # miniflare 4.20260730.0, so tests/worker/** runs on a different workerd
      # from dev, build and deploy (root wrangler 4.80.0 / miniflare
      # 4.20260401.0). Taken deliberately: an ageing test runtime beats a
      # permanently red CI. The package is deprecated; the pin ends with the move
      # to @cloudflare/vitest-plugin (see "Outstanding actions" in CLAUDE.md).
```

Only this entry changes. The block is rewritten, not only its numbers, so the PR body says
so. The vitest entry above it also carries stale lines (the 0.12.x peer
range, "Lifting these three entries is part of the vitest 4 task"); item 8 limits the fix to
the pool entry, so those are listed as a follow-up in the PR body, not fixed.

## Task 5 — The #331 removal step

Item 21, D6. Done when the PR is opened (outward-facing, so it waits until Jamie asks for the
push). Posted as a comment, not a body edit, so the original issue text is untouched:

```bash
gh issue comment 331 --repo jevawin/clumeral-game --body-file $SCRATCH/331-comment.md
```

Body:

> One more step for this PR, from #381. `package.json` now carries npm `overrides` that force
> `undici` 7.30.2 and `ws` 8.23.1 under `miniflare` and `@cloudflare/vite-plugin`, because
> the pinned toolchain exact-pins vulnerable versions.
>
> - [ ] After the bump, remove each override only if `npm ls undici ws --all` still shows
>   patched versions without it (undici ≥ 7.30.1, ws ≥ 8.21.0). The pool keeps its own
>   miniflare, so the `miniflare` override may still be needed for that copy; if so, keep it
>   and say why.
> - [ ] Remove the matching note in the `.github/dependabot.yml` header.

## Task 6 — Review gates and PR

Per CLAUDE.md: human review → `da-build` (fresh-context subagent) → self-review
(docs/SELF-REVIEW.md) → push and PR into `staging`, only when Jamie asks. The PR body lists:
the Task 3 results (file count, per-project e2e passes, build comparison), the four
dismissals with time, the vitest-entry follow-up, and the unticked post-release check (D5).

## Task 7 — After the release reaches `main` (owed, by hand)

Items 14, 30, 37. Not part of the PR.

1. Per alert, not by count: each of the 27 numbers is `fixed` (the 22 undici and 1 ws) or
   `dismissed` (the 4 in Task 1):
   ```bash
   gh api 'repos/jevawin/clumeral-game/dependabot/alerts?per_page=100' --jq '.[] | select([.number] | inside([15,16,22,23,24,25,27,28,29,33,34,35,36,37,43,45,46,47,48,51,52,60,64,72,73,74,75])) | "\(.number) \(.state)"'
   ```
2. No new failed Dependabot security run for undici, ws, sharp or esbuild after that date.
3. A new advisory landing later is a new task (item 37).
4. Tick the PR-body item and close #381.

---

## Traceability

| Item | Where |
|---|---|
| 1–4 | Context; done-condition is Task 7 |
| 5, 6, 7 | No code: nothing in Tasks 0–7 touches those pins or #369 |
| 8 | Task 4b |
| 9, 10 | Task 2 (as amended by 31–33) |
| 11 | Task 1 |
| 12 | Task 1; no esbuild override in D1 |
| 13 | D3, Task 1 |
| 14 | Task 7 |
| 15 | Task 4a (as amended by 36) |
| 16 | D3, Task 1, gated on approval |
| 17 | Superseded by 35 |
| 18, 19, 24, 26, 27 | n/a, no code |
| 20 | File set of Tasks 2, 4, 5 (as amended by 36) |
| 21 | Task 5, D6 |
| 22 | D5: CLAUDE.md unchanged |
| 23 | Task 3 step 5 |
| 25 | Task 1 comments, R1 |
| 28 | Tasks 0, 3 |
| 29 | Task 0 step 3, Task 3 step 4 (as amended by 38) |
| 30 | Task 7 |
| 31, 32, 33 | D1, Task 2 |
| 34 | Task 3 step 6 |
| 35 | Task 1 timing; Task 7 |
| 36 | Task 4a; `package.json` gets no comment |
| 37 | Task 7 step 1, 3 |
| 38 | Task 0 step 3, Task 3 step 4 |
| 39 | Task 1 esbuild comment; no esbuild override |
| 40 | n/a, no code |
| 41 | Tasks 0, 2, 3 |
| 42 | The dismissal list |

## Sequencing

Task 0 → Task 1 (needs plan approval) → Task 2 → Task 3 → Task 4 → human review →
`da-build` → self-review → Task 5 and push/PR (when Jamie asks) → Task 7 after release.
Task 4 is independent of Task 2 and may go first; it is kept after Task 3 so a fallback in
Task 3 can adjust the header note in the same pass.

## Revision log

- Revision 1, 2026-11-27: first draft.
- Revision 2, 2026-11-27: da-plan fixes (0 High, 2 Medium, 5 Low; all fixed).
  M1: Task 3 fallback covers both-fail and fail-together, removes dropped overrides from 4a
  and Task 5, and times `tolerable_risk` dismissals after release (item 17). M2: Task 2's
  test is four commands with fixed expected output. L1: D2 drops the lockfile overrides
  mirror and expects removed nested entries. L2: Task 0 sets `$SCRATCH`. L3: note under the
  dismissal list. L4: esbuild comment wording. L5: 4b keeps the 0.13.0 history and the PR
  body says the block is rewritten.
