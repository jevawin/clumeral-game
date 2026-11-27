# Dependabot alert triage — brief

Issue: #381 · Branch: `dev/dependabot-alert-triage` · Started 2026-11-27 · Brief as a whole: Jamie 2026-11-27 · da-brief: pending

Status: **settled, awaiting da-brief.** Jamie 2026-11-27: "1 yes" (all recommendations
accepted), "2 override" (Jamie overrides Dave's ack as dev lead on every joint section —
dev tooling, no maths or player impact; recorded as override, not ack), "3 yes" (§4 and §9 n/a).

Proposed short form: none. All 11 sections are kept; the ones that do not apply say so in
one line and still need a word back.

## Evidence (gathered 2026-11-27, `main` = `staging` = `e552fda`)

This block is the record of what was measured, so Plan does not have to measure it again.

**The 27 alerts.** Every one is `scope: development`, `relationship: transitive`, in
`package-lock.json`. None is in a package that ships to the browser or to the Worker.

| Package | Alerts | High / Mod / Low | Installed | Patched at | Pulled in by |
|---|---|---|---|---|---|
| undici | 22 | 8 / 9 / 5 | 7.24.4 (root), 7.28.0 (pool) | 7.30.1 covers all | `miniflare` exact pin `undici: 7.24.4` / `7.28.0` |
| sharp | 3 | 3 / 0 / 0 | 0.34.5 (root), 0.35.2 (pool) | 0.35.5 covers all | `miniflare` `sharp: ^0.34.5` / `0.35.2` |
| ws | 1 | 1 / 0 / 0 | 8.18.0 (root), 8.21.0 (pool, already safe) | 8.21.0 | `@cloudflare/vite-plugin` and `miniflare` exact pin `ws: 8.18.0` |
| esbuild | 1 | 0 / 0 / 1 | 0.27.3 (root), 0.28.1 (pool, already safe) | 0.28.1 | `wrangler@4.80.0` exact pin `esbuild: 0.27.3`; vite allows `^0.27 \|\| ^0.28` |

Root `miniflare@4.20260401.0` comes from `@cloudflare/vite-plugin@1.31.0` and
`wrangler@4.80.0`. The pool's `miniflare@4.20260730.0` comes from
`@cloudflare/vitest-pool-workers@0.19.1`. Both are behind the deliberate pins in
`.github/dependabot.yml` and #331. `jsdom`'s `undici@8.12.3` is outside every alert range.

The one esbuild advisory needs the esbuild dev server running **on Windows**. Nobody runs
it here: dev is macOS, CI and the Pi are Linux, and vite 8 does not serve through esbuild.

**Why the runs fail.** Both 2026-11-24 runs (`ws` #45498002955, `esbuild` #45498001553) end
in `security_update_not_possible`. Dependabot's own words: "A patched version exists … but
the available update path still resolves it to 8.18.0" (and 0.27.3 for esbuild). The exact
pins above leave it no legal version to move to. The same error killed the `undici` and
`sharp` runs on 2026-11-01. It is not a config fault and not a broken token. Security
updates run against `main` regardless of `target-branch: staging`, and the job definitions
show `"ignore-conditions": []`, so our `ignore` entries did not apply to them.

**#369 closes none of them.** Its lockfile moves root `miniflare` to 4.20260409.0, which still
pins `undici 7.24.4`, `ws 8.18.0`, `sharp ^0.34.5`, and its `wrangler 4.81.1` still pins
esbuild 0.27.3.

## 1. What it is
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

1. The problem: GitHub shows 27 open security alerts on `main` and Dependabot keeps
   failing to fix them, so the alert list and the Actions tab both read as broken. Nobody has
   said which alerts matter. (assumed — #381)
2. Who it is for: Jamie and Dave, as maintainers. Players are not exposed: every alert is in
   dev-only tooling (evidence above). (assumed)
3. Why now: the failing runs repeat each time an advisory is updated, and an alert list
   nobody reads hides the next real one. (assumed)
4. Done means every one of the 27 alerts is closed by a fix or dismissed with a written
   reason, and the `ws` and `esbuild` runs stop failing. (assumed — #381 acceptance criteria)

## 2. Out of scope
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

5. #331 is not done here: no bump of `@cloudflare/vite-plugin`, `wrangler` or
   `@cloudflare/workers-types`, and none of their `ignore` entries is lifted. (assumed —
   documented gate not met)
6. The `@cloudflare/vitest-pool-workers` pin at 0.19.1 and the vitest ignores stay. The
   `@cloudflare/vitest-plugin` migration is not started. (assumed — CLAUDE.md outstanding
   actions; gate is a stable miniflare)
7. #369 is not merged or changed here. It is a separate Dependabot PR that Jamie merges or
   not on its own merits. (assumed — it closes no alerts, so nothing here waits on it)
8. Should we fix the stale pool comment in `.github/dependabot.yml` while we are in the file?
   It still says the pool is pinned at 0.12.21, "the LAST 0.12.x release", but #332 moved it
   to 0.19.1.
   My rec: yes, correct the facts in that one entry, nothing more. Why: we are editing this
   file anyway, and a wrong comment on a pin is how a pin gets lifted by mistake. Anything
   wider is maintenance, which stays out.

## 3. How it works
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

9. What do we do about the 22 `undici` alerts (8 high)?
   My rec: an npm `overrides` entry that forces `undici` to the newest 7.x (7.30.2 today)
   under both `miniflare` copies. Why: 7.24 → 7.30 is minor-level inside one major, so the
   risk is low, and it closes 22 alerts outright instead of explaining them away. The cost:
   it overrides an exact pin Cloudflare chose, and the override must be removed in #331. The
   worker tests (pool miniflare) and e2e (root miniflare) exercise both copies.
   Alternative: dismiss all 22 as dev-only, "tolerable risk", tracked by #331.
10. What do we do about the `ws` alert (1 high)?
    My rec: same as 9 — override root `ws` to the newest 8.x (8.23.1 today). Why: a patch-
    level move inside 8.x on the local dev server; the pool copy already runs 8.21.0.
11. What do we do about the 3 `sharp` alerts (3 high)?
    My rec: dismiss as "vulnerable code not used", naming #331. Why: `sharp` reaches us only
    through miniflare's local Images binding, which this project does not use, so the
    libvips/libheif/librsvg parsers never see an image. Forcing 0.34 → 0.35 is a 0.x minor
    in a native package, which risks the install on the Pi's arm64 for no real gain.
    Alternative: override to 0.35.5 as well, and test the Pi install.
12. The `esbuild` alert (1 low) is dismissed as "vulnerable code not used": it needs the
    esbuild dev server on Windows, and we run neither. We do not override it, because
    `wrangler` bundles the Worker with this esbuild and the build path is the one place a
    dev tool touches shipped code. (assumed — evidence above)
13. Every dismissal goes through GitHub's dismiss action with a comment that names the
    reason and #331, so the reason lives on the alert itself. (assumed)
14. Once the overrides land on `main` (at the next release), GitHub closes the `undici` and
    `ws` alerts itself. Dismissed alerts stop Dependabot retrying `sharp` and `esbuild`, so
    the failing runs stop. (assumed — to be confirmed on `main` after the release, item 30)
15. Every override gets a comment beside it in `package.json` docs or `dependabot.yml` that
    says why it exists and that #331 removes it. (assumed — npm `overrides` cannot carry
    comments in `package.json`, so the note goes in the `dependabot.yml` header and in #331)
16. Who dismisses the alerts on GitHub?
    My rec: Claude, with `gh api` after Jamie approves the exact list in the plan. Why: it is
    an outward-facing change to the repo's security record, so Jamie sees the list first;
    after that it is 4 mechanical calls. Alternative: Jamie dismisses them in the UI.
17. When are dismissals done?
    My rec: after the PR merges to `main`, not before. Why: until then the alerts are
    accurate, and dismissing early hides them if the PR stalls.

## 4. Maths
Settled: n/a agreed by Jamie 2026-11-27 · Dave sign-off: Override: Jamie 2026-11-27 (no maths touched) · Ack: n/a

18. n/a — no puzzle generation, filtering or answer logic is touched.

## 5. State & persistence
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

19. n/a — no player storage, no `dlng_` key, no D1, no KV. P1 and P7 are untouched.
    (assumed)

## 6. How it fits
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

20. Files touched: `package.json` (`overrides`), `package-lock.json`, `.github/dependabot.yml`
    (comment only), and #331's body or a comment (the override-removal step). No `src/`
    change. (assumed)
21. #331's checklist gains one step: remove the `undici` and `ws` overrides once the
    toolchain moves together. (assumed — otherwise the overrides outlive their reason)
22. The CLAUDE.md "Outstanding actions" section does not change. (assumed — the overrides
    are tracked in #331, which is already the place for the Cloudflare toolchain)
23. Invariant check: P2 (playable) is the one at risk, because a bad `undici` under miniflare
    could break `vite preview` and so e2e. No shipped bundle changes. (assumed — confirmed by
    item 27)

## 7. How it looks
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

24. n/a — nothing a player sees changes. (assumed)

## 8. Copy & wording
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

25. Dismissal comments follow one pattern: "Dev-only, transitive via miniflare (pinned by
    `@cloudflare/vite-plugin`/`wrangler`, see #331). <one-line reason>. Removed with #331."
    (assumed)

## 9. Accessibility
Settled: Jamie 2026-11-27 (n/a agreed) · Ack: n/a (Jamie owns)

26. n/a — no UI change.

## 10. Analytics
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

27. n/a — no player-facing behaviour, nothing to count. (assumed)

## 11. Done / test plan
Settled: Jamie 2026-11-27 (accepted all recommendations) · Ack: Override: Jamie 2026-11-27

28. Which QA level?
    My rec: `npm ci` from clean, the full unit suite (41 files; the worker tests run on the
    pool's miniflare), `npm run build`, and the full e2e suite against the production build
    (it starts `vite preview` on the root miniflare). Plus `npm ls undici ws` showing only
    patched versions. Why: the overrides change the runtime under both test harnesses, and
    #325 showed a miniflare fault only surfaces in e2e. Firefox is skipped locally, so count
    passes per project.
29. The built `dist/` Worker and client bundles are byte-identical before and after. Why:
    proves nothing shipped changed. (assumed — cheap to check with a hash)
30. After the release reaches `main`: the open alert count is 0, and no new failing
    Dependabot run appears for these four packages. Checked by hand, since nothing reminds
    anyone. (assumed)
