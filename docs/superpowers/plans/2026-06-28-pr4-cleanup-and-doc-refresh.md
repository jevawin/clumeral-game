# PR 4 — Cleanup + Doc Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the post-redesign stabilisation program — remove the orphaned old-completion markup + dead code, refresh the docs the redesign and `/migrate` left stale, and prune merged branches.

**Architecture:** One PR to `staging` from a fresh `dev/` branch. One small code change (markup + dead-code removal in `index.html` / `app.ts`), the rest is docs (`ROADMAP`, `DESIGN-SYSTEM`, `ARCHITECTURE`, `URL-ARCHITECTURE`, `FEEDBACK`, `README`) plus retiring `PROGRESS.md`. Atomic commit per concern.

**Tech Stack:** TypeScript, Tailwind v4 (`@theme` in `src/tailwind.css`), Vite, Cloudflare Workers, Playwright (e2e), `gh` / `git` for branch hygiene.

**Source spec:** [docs/superpowers/specs/2026-06-28-post-redesign-stabilisation-design.md](../specs/2026-06-28-post-redesign-stabilisation-design.md) — PR 4 section (lines 138–170).

**Decisions locked in discuss (2026-06-28):**
- **Keep `staging`.** The spec lists local `staging` for pruning, but it is 4 commits ahead of `origin/main` (holds PRs 1–3, not yet on main) and is a protected permanent integration branch. Do **not** delete it. Prune only `new-design` (merged) and remote `chore/roadmap-217` (superseded).
- **QA = critical-path Playwright subset** (`npm run test:e2e:smoke`), run once after the code change in Task 1. Docs-only tasks get no e2e.
- **Skip the optional prod-D1 stray-row delete.** Already filtered from the dashboard; not worth an irreversible prod write.

**Ground truth verified during planning (use these exact values):**
- Fonts: **Quicksand** (body/sans, `--font-sans`) + **Inconsolata** (mono/digits, `--font-mono`). NOT DM Sans. Source: [src/tailwind.css:50-55](../../../src/tailwind.css#L50).
- Accent: a **4-theme picker** — Lime `#0a850a`/`#1ead52`, Berry `#de1f46`/`#ea6c85`, Blue `#376ddb`/`#6393f2`, Violet `#9a44ea`/`#b679f0` (light/dark), persisted in `dlng_colour`, set per-swatch in [src/colours.ts](../../../src/colours.ts). `--color-accent` default is Lime.
- Storage keys are all `dlng_*`: `dlng_history`, `dlng_prefs`, `dlng_active`, `dlng_theme`, `dlng_colour`, `dlng_uid`, `dlng_last_visit_date`. `cw-ck` in `tailwind.css` is an HTML checkbox `id`, not a storage key.
- Stylesheet file is `src/tailwind.css` (there is no `src/style.css`, no `tailwind.config.ts` — theme tokens live in the `@theme` block).
- `#225` (feedback open/resolved state) is still **OPEN** — the FEEDBACK.md triage dependency note must stay.

---

## Task 0: Branch setup

**Files:** none (git only).

- [ ] **Step 1: Confirm clean tree on staging**

Run: `git status -s && git branch --show-current`
Expected: empty status, branch `staging`.

- [ ] **Step 2: Create the work branch off staging**

```bash
git checkout staging
git pull --ff-only origin staging
git checkout -b dev/pr4-cleanup-doc-refresh
```

- [ ] **Step 3: Verify branch**

Run: `git branch --show-current`
Expected: `dev/pr4-cleanup-doc-refresh`

---

## Task 1: Remove orphaned old-completion markup + dead code

The old completion path (`data-next` / `data-again` "next puzzle" / "play another random" text) was superseded by [src/completion.ts](../../../src/completion.ts), which renders the real link via `[data-completion-random-again]`. The old markup in `index.html` is permanently `hidden` and only poked by dead no-op code in `app.ts`. The function `showNextPuzzle()` is defined but **never called** (verified: no callers). The remaining `dom.next?.classList.add("hidden")` / `dom.again?.classList.add("hidden")` calls are no-ops on already-hidden orphaned elements.

**Safety verified:** `e2e/specs/random.spec.ts` asserts against the **new** markup (`[data-completion-links] [data-completion-random-again]`), not the old `data-next`/`data-again` — removal does not touch it. Confirm the new completion screen still shows the next-puzzle / play-again affordances (it does — see [src/completion.ts:200-209](../../../src/completion.ts#L200)) **before** deleting.

**Files:**
- Modify: `index.html:280-288` (remove the two orphaned `<p>` blocks)
- Modify: `src/app.ts` — remove dom cache entries (69-71), the dead `showNextPuzzle()` function (470-475), and the no-op `dom.next` / `dom.again` calls (500, 524, 551, 635)

- [ ] **Step 1: Remove the orphaned markup in `index.html`**

Delete these blocks (the `<!-- Next puzzle -->` and `<!-- Random again -->` paragraphs, [index.html:280-288](../../../index.html#L280)):

```html
            <!-- Next puzzle -->
            <p data-next class="hidden mt-4 text-base text-text font-[Quicksand]">
              Puzzle <span data-next-number></span> is available tomorrow.
            </p>

            <!-- Random again -->
            <p data-again class="hidden mt-4 text-base font-[Quicksand]">
              <a href="/random" class="text-accent underline">Play another random puzzle</a>
            </p>
```

Leave the `<!-- Stats -->` `<div data-stats>` above and the closing `</div></section>` below intact.

- [ ] **Step 2: Remove the dead dom cache entries in `src/app.ts`**

Delete lines 69-71:

```ts
  next: $('[data-next]') as HTMLElement | null,
  nextNumber: $('[data-next-number]') as HTMLElement | null,
  again: $('[data-again]') as HTMLElement | null,
```

- [ ] **Step 3: Remove the dead `showNextPuzzle()` function in `src/app.ts`**

Delete the whole function (lines 470-475):

```ts
function showNextPuzzle() {
  if (dom.next && dom.nextNumber) {
    dom.nextNumber.textContent = String((gameState.puzzleNum ?? 0) + 1);
    dom.next.classList.remove("hidden");
  }
}
```

- [ ] **Step 4: Remove the no-op `dom.next` / `dom.again` calls in `src/app.ts`**

Delete these four lines (search each — line numbers shift as you delete):
- `dom.next?.classList.add("hidden");` inside `showCompletedState` (was 500)
- `dom.next?.classList.add("hidden");` inside `resetPuzzleUI` (was 524)
- `dom.again?.classList.add("hidden");` at the end of `startRandomPuzzle` (was 551)
- `dom.again?.classList.add("hidden");` at the end of `startDailyPuzzle` (was 635)

- [ ] **Step 5: Typecheck / build to prove no dangling references**

Run: `npm run build`
Expected: build succeeds, no TypeScript error about `next`, `nextNumber`, `again`, or `showNextPuzzle`.

- [ ] **Step 6: Grep to confirm nothing references the removed names**

Run: `grep -rn -E "data-next|data-again|showNextPuzzle|nextNumber|dom\.(next|again)" src/ index.html`
Expected: no matches (the `e2e/specs/random.spec.ts` `again`/`next` variable names are unaffected and not in this glob).

- [ ] **Step 7: Run the critical-path Playwright smoke subset (QA gate)**

```bash
npm run test:e2e:smoke
```
Expected: PASS — `random.spec.ts`, `completion.spec.ts`, `game-solve.spec.ts` green. This proves the new completion screen still drives the next-puzzle / play-again flows after the old markup is gone.

- [ ] **Step 8: Commit**

```bash
git add index.html src/app.ts
git commit -m "refactor: remove orphaned old-completion markup and dead code

The data-next/data-again markup and showNextPuzzle()/dom.next/dom.again
references were superseded by the redesigned completion screen
(src/completion.ts). showNextPuzzle() had no callers; the remaining
.add(\"hidden\") calls were no-ops on already-hidden orphaned nodes."
```

---

## Task 2: Refresh `docs/ROADMAP.md` "Recently shipped"

Add the three biggest recent items missing from the list: the three-screen redesign (#226), the `/migrate` hand-off (#231), and PR 1's bug fixes (#233). Record `/random` as a **fixed regression (shipped)** and move the theme-aware shadows from known-bug to shipped. New entries go at the **top** of the `## Recently shipped` list (newest first).

**Files:**
- Modify: `docs/ROADMAP.md` — insert under the `## Recently shipped` heading, above the existing `2026-06-09 … #219` line.

- [ ] **Step 1: Insert the new shipped entries**

Insert these lines as the first entries under `## Recently shipped` (immediately before the `- 2026-06-09 — [#219]…` line):

```markdown
- 2026-06-28 — [#233](https://github.com/jevawin/clumeral-game/pull/233) Post-redesign bug fixes — `/random` correct-answer crash fixed (cold-boot solve no longer hits the uninitialised-router throw) + restored the "Play another random puzzle" entry link on the random completion screen, and theme-aware shadow tokens (`--shadow-*`) so shadows render correctly in dark mode (branch `dev/post-redesign-stabilisation`)
- 2026-06-25 — [#231](https://github.com/jevawin/clumeral-game/issues/231) `/migrate` cross-origin localStorage hand-off — one-time migration page that carries `dlng_*` history across the domain move
- 2026-06-20 — [#226](https://github.com/jevawin/clumeral-game/issues/226) Three-screen redesign — welcome / game / completion rebuilt in Tailwind with the minimal palette and accent picker (`cd206f9`)
```

> Note: the dates for #231 (2026-06-25) and #226 (2026-06-20) are placeholders ordered relative to the surrounding entries — if the executor can confirm the real merge dates from `git log`/`gh pr view`, use those. The `/random` fix is recorded as **shipped**, not an open bug, and the shadow fix is folded into the #233 line (it was the previously-tracked known bug, now resolved).

- [ ] **Step 2: Verify the list still reads newest-first and links resolve**

Run: `grep -n "Recently shipped" -A 6 docs/ROADMAP.md`
Expected: the three new lines appear at the top in date order, above #219.

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): record redesign #226, /migrate #231, and PR1 #233 as shipped"
```

---

## Task 3: Fix `docs/DESIGN-SYSTEM.md` (fonts + accent picker)

Two stale claims: the "green accent only" line and the DM Sans typography. Real state is a 4-colour accent picker and Quicksand.

**Files:**
- Modify: `docs/DESIGN-SYSTEM.md:7` (accent claim), `:27-28` (typography).

- [ ] **Step 1: Fix the accent claim (line 7)**

Replace:

```markdown
- Green accent only -- no colour picker, no multiple themes.
```

with:

```markdown
- Accent colour is user-selectable via a 4-theme picker — **Lime** (default), **Berry**, **Blue**, **Violet** — each with a light and dark value, persisted in `dlng_colour`. The active colour is written to the live `--color-accent` custom property per swatch ([src/colours.ts](../../src/colours.ts)); `color-mix()`-based tokens re-resolve automatically, so no `dark:` variant is needed for accent-derived colours.
```

- [ ] **Step 2: Fix the typography section (lines 27-28)**

Replace:

```markdown
- Body: DM Sans 400/600 (Google Fonts), fallback `system-ui`
- Headings: DM Sans 700 (Phase 1 locked exception -- loaded via Google Fonts `wght@400;600` but 700 used for bold headings)
```

with:

```markdown
- Body / headings: **Quicksand** 400/600/700 (Google Fonts), fallback `system-ui` — `--font-sans`
```

Leave line 29 (`Mono (labels/digits): Inconsolata 400/700`) unchanged — still correct.

- [ ] **Step 3: Verify no remaining "DM Sans" / "green accent only"**

Run: `grep -niE "dm sans|green accent only|no colour picker" docs/DESIGN-SYSTEM.md`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/DESIGN-SYSTEM.md
git commit -m "docs(design-system): correct fonts (Quicksand) and accent picker"
```

---

## Task 4: Fix `docs/ARCHITECTURE.md` (stylesheet filename + storage keys)

`style.css` no longer exists (it's `tailwind.css`), and the localStorage key list is missing `dlng_active` / `dlng_last_visit_date` and still lists the retired `cw-htp-seen`.

**Files:**
- Modify: `docs/ARCHITECTURE.md:18` (file name), `:62-71` (storage keys).

- [ ] **Step 1: Fix the stylesheet filename in the file map (line 18)**

Replace:

```
  style.css      All styling
```

with:

```
  tailwind.css   All styling (Tailwind v4 @theme tokens + component CSS)
```

- [ ] **Step 2: Correct the localStorage keys list (lines 64-69)**

Replace the bullet list under `## localStorage keys`:

```markdown
- `dlng_history` — `[{date, tries, answer?, archived?}]` (`archived: true` = a past/archive solve, excluded from daily stats)
- `dlng_prefs` — `{saveScore}`
- `dlng_theme` — `"light"|"dark"`
- `dlng_colour` — accent colour id
- `dlng_uid` — anonymous analytics id
- `cw-htp-seen` — `"1"` once How-to-Play shown
```

with:

```markdown
- `dlng_history` — `[{date, tries, answer?, archived?}]` (`archived: true` = a past/archive solve, excluded from daily stats)
- `dlng_prefs` — `{saveScore}`
- `dlng_active` — in-progress puzzle state (mid-game restore; validated on load)
- `dlng_theme` — `"light"|"dark"`
- `dlng_colour` — accent colour name (e.g. `"Lime"`)
- `dlng_uid` — anonymous analytics id
- `dlng_last_visit_date` — last-seen local date key, drives the midnight rollover
```

- [ ] **Step 3: Verify**

Run: `grep -nE "style\.css|cw-htp-seen" docs/ARCHITECTURE.md`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs(architecture): tailwind.css filename + correct dlng_* storage keys"
```

---

## Task 5: Fix `docs/URL-ARCHITECTURE.md` (`cw-` → `dlng_` keys)

The rollover logic references `cw-last-visit-date`; the real key is `dlng_last_visit_date`.

**Files:**
- Modify: `docs/URL-ARCHITECTURE.md` — lines 71, 74, 97 (`cw-last-visit-date` → `dlng_last_visit_date`). Line 223 (a historical note that `cw-htp-seen` "was retired") stays as-is — it correctly documents the old name being gone.

- [ ] **Step 1: Replace every `cw-last-visit-date` with `dlng_last_visit_date`**

Run:
```bash
sed -i '' 's/cw-last-visit-date/dlng_last_visit_date/g' docs/URL-ARCHITECTURE.md
```

- [ ] **Step 2: Verify only the intended key changed**

Run: `grep -nE "cw-last-visit-date|dlng_last_visit_date|cw-htp-seen" docs/URL-ARCHITECTURE.md`
Expected: no `cw-last-visit-date` left; `dlng_last_visit_date` now on lines 71/74/97; the `cw-htp-seen` historical note on line 223 untouched.

- [ ] **Step 3: Commit**

```bash
git add docs/URL-ARCHITECTURE.md
git commit -m "docs(url-architecture): cw-last-visit-date -> dlng_last_visit_date"
```

---

## Task 6: Retire `PROGRESS.md`

Frozen on an April session; `ROADMAP.md` is the live working-state doc. No other doc links to it (verified: only `PROGRESS.md` self-references it; the spec mentions it).

**Files:**
- Delete: `PROGRESS.md`

- [ ] **Step 1: Confirm nothing references it**

Run: `grep -rn "PROGRESS.md" --include="*.md" . | grep -v node_modules | grep -v superpowers/specs`
Expected: only the `PROGRESS.md:18` self-reference (the file itself). If `CLAUDE.md` or any live doc references it, stop and update that reference instead.

- [ ] **Step 2: Delete the file**

```bash
git rm PROGRESS.md
```

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: retire stale PROGRESS.md (ROADMAP.md is the live working-state doc)"
```

---

## Task 7: Rewrite the `docs/FEEDBACK.md` triage process section

Replace the "no triage state yet" placeholder (lines 90-103) with the real dev process, keeping the #225 dependency note (issue still OPEN).

**Files:**
- Modify: `docs/FEEDBACK.md:90-103` — the `## Process …` section through end of file.

- [ ] **Step 1: Replace the whole `## Process …` section**

Replace from the `## Process — status: read-only, no triage state yet` heading to the end of the file with:

```markdown
## Process — feedback → triage → roadmap

The loop from raw feedback to shipped work:

1. **Review feedback.** Read the [`/feedback` dashboard](https://clumeral.com/feedback) (or query D1 directly). For anything actionable, create a GitHub issue — bug, suggestion, or roadmap candidate — then **mark the feedback row complete** once it's captured in GitHub, so it isn't re-triaged next visit.
2. **Review new GitHub issues.** Prioritise the open issues (including the ones just filed), then reflect the order in [ROADMAP.md](ROADMAP.md) — issue number + one-line title + trigger condition, newest priorities first.
3. **Work from the roadmap.** Pull the top _Now_ item and build it. Detail stays in the GitHub issue, not the roadmap.

**Dependency — marking rows complete needs #225.** Step 1's "mark the feedback row complete" is blocked until [#225 — Feedback: add open / resolved state for triage](https://github.com/jevawin/clumeral-game/issues/225) ships (still **open**, P2). Until then: capture-to-GitHub happens, but feedback rows can't be marked done — so a row may be re-read across visits. Track which rows are already captured by their linked issue number. When #225 lands, document the state model (open / resolved), who triages and how often, and any new columns/migrations **here**.
```

- [ ] **Step 2: Verify the placeholder language is gone**

Run: `grep -niE "no triage state yet|placeholder for that process|read-only, no triage" docs/FEEDBACK.md`
Expected: no matches. And `grep -n "#225" docs/FEEDBACK.md` still finds the dependency note.

- [ ] **Step 3: Commit**

```bash
git add docs/FEEDBACK.md
git commit -m "docs(feedback): document the feedback -> triage -> roadmap process"
```

---

## Task 8: Verify `README.md` naming (light)

The spec flags "minor README.md naming." Planning found the README file map is already current (`tailwind.css`, `screens.ts`, `welcome.ts`, `colours.ts`) with no `style.css` / `DM Sans` / "green accent only" mentions. This task is a verify-and-fix-only-if-found.

**Files:**
- Modify (only if a mismatch is found): `README.md`

- [ ] **Step 1: Scan for stale naming**

Run:
```bash
grep -niE "style\.css|tailwind\.config|dm sans|green accent only|no colour picker|cw-[a-z]" README.md
```
Expected: no matches → no change needed. If any match appears, fix it to the verified ground truth (Quicksand fonts, `src/tailwind.css`, accent picker, `dlng_*` keys).

- [ ] **Step 2: Commit only if changed**

```bash
git add README.md && git commit -m "docs(readme): correct stale naming" || echo "no README changes — skip"
```

If Step 1 found nothing, skip this task — no empty commit.

---

## Task 9: Prune merged branches

Delete only branches confirmed merged or explicitly superseded. **Do not touch `staging` or `main`.**

Verified during planning (against `origin/main`):
- `new-design` (local + remote): **merged** into `origin/main` → delete both.
- `origin/chore/roadmap-217`: **not** merged (311 ahead) but its only relevant change — the April `/random` fix `a8d0be8` — is superseded by PR 1. The spec authorises deletion. Force-delete the remote branch.
- `staging`: **keep** (4 ahead of main, protected, permanent). Not deleted.
- `dev/readme-deploy-fix` (local + remote): **not in scope** — leave it; it's a separate open dev branch.

- [ ] **Step 1: Re-confirm merge state immediately before deleting**

```bash
git fetch origin --prune
git merge-base --is-ancestor "$(git rev-parse new-design)" origin/main && echo "new-design MERGED — safe" || echo "new-design NOT merged — STOP"
```
Expected: `new-design MERGED — safe`. If it prints STOP, do not delete `new-design` — surface it instead.

- [ ] **Step 2: Delete the merged local branch**

```bash
git branch -d new-design
```
Expected: `Deleted branch new-design (...)`. (`-d`, not `-D` — refuses if not merged, a safety net.)

- [ ] **Step 3: Delete the merged remote branch + the superseded one**

```bash
git push origin --delete new-design
git push origin --delete chore/roadmap-217
```
Expected: both deleted on the remote. `chore/roadmap-217` is deleted by explicit spec decision despite not being merged (its April fix is superseded).

- [ ] **Step 4: Confirm final branch list**

```bash
git branch && echo "---" && git branch -r
```
Expected: no `new-design` anywhere; no remote `chore/roadmap-217`; `staging`, `main`, `dev/readme-deploy-fix`, and the work branch remain.

No commit — branch deletion isn't a tree change.

---

## Task 10: Review gates + PR

The change touches >1 file and >30 lines, so the full review gate applies: DA review (fresh-context subagent) → self-review → PR. See [docs/DA-REVIEW.md](../../DA-REVIEW.md) and [docs/SELF-REVIEW.md](../../SELF-REVIEW.md).

- [ ] **Step 1: Final full verification before review**

```bash
npm run build && npm run test && npm run test:e2e:smoke
```
Expected: build clean, unit tests pass, smoke suite green. (Docs changes don't need e2e, but the Task 1 code change does — re-confirm here.)

- [ ] **Step 2: Push the branch**

```bash
git push -u origin dev/pr4-cleanup-doc-refresh
```

- [ ] **Step 3: DA review** — dispatch a fresh-context subagent per [docs/DA-REVIEW.md](../../DA-REVIEW.md). Feed it the diff vs `staging`. Resolve any findings.

- [ ] **Step 4: Self-review** — run the [docs/SELF-REVIEW.md](../../SELF-REVIEW.md) checklist against the diff. Resolve findings.

- [ ] **Step 5: Open the PR to `staging`**

```bash
gh pr create --base staging --head dev/pr4-cleanup-doc-refresh \
  --title "Cleanup + doc refresh (post-redesign stabilisation PR 4)" \
  --body "Final PR of the post-redesign stabilisation program. Removes the orphaned old-completion markup + dead app.ts code, refreshes stale docs (ROADMAP shipped list, DESIGN-SYSTEM fonts/accent, ARCHITECTURE + URL-ARCHITECTURE storage keys, FEEDBACK triage process), retires PROGRESS.md, and prunes merged branches (new-design, chore/roadmap-217). staging kept (unmerged, protected). QA: critical-path Playwright smoke green.

Plan: docs/superpowers/plans/2026-06-28-pr4-cleanup-and-doc-refresh.md"
```

- [ ] **Step 6: Update the source spec progress line**

In [docs/superpowers/specs/2026-06-28-post-redesign-stabilisation-design.md](../specs/2026-06-28-post-redesign-stabilisation-design.md), change the `PR 4` progress bullet (line 23) from `⬜ next.` to `✅ done` with the PR link. Commit on the work branch and push (or fold into the PR before merge).

---

## Notes for the executor

- **Order independence:** Tasks 2–8 (docs) are independent and can be done in any order or batched; keep them as separate atomic commits so review is legible. Task 1 (code) must precede the smoke run. Task 9 (branch pruning) and Task 10 (review/PR) come last.
- **Never** delete `staging`, `main`, or run `wrangler deploy` / `npm run deploy`. Deployment is automatic on merge to `main`, which the user does on GitHub.
- After the PR merges to `staging`, run post-merge cleanup (`git remote prune origin`, delete the local work branch) per CLAUDE.md.
