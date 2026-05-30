# Phase 06 Verification — Add "Guess the number from 100–999" copy

**Verdict: PASS**

Date: 2026-05-30

## Phase goal

Add one line of explanatory range copy to two screens (welcome + play),
telling the player the answer is a 3-digit number from 100–999. Copy-only,
frontend markup. No backend, puzzle logic, or component changes.

## What was delivered (verified, not claimed)

- `src/welcome.ts:130` — `<p class="text-base text-text text-center">Work out the number from 100–999</p>`, placed between `${puzzleNumHtml}` and `${playButton()}`, reusing the subtitle classes. En-dash U+2013 confirmed; no hyphen variant.
- `index.html:198` — `<p class="text-sm font-[Quicksand] text-text mb-4">Work out the number from 100–999. <span class="font-bold">Clues:</span></p>`, placed after `[data-archive-row]` close and before `[data-clue-list]`. `Clues:` emphasised in a `font-bold` span. En-dash U+2013 confirmed.
- Visual order on archive replay: archive banner → copy line → clues (markup order verified).
- Existing welcome subtitle "A daily number puzzle" unchanged.

## Checks run

- `npm run build` → exit 0 (built dist/client + dist/clumeral_game).
- `grep` confirms both literal lines present, en-dash not hyphen.
- `git diff base..HEAD --name-only` → only `index.html`, `src/welcome.ts`, plus tracking/SUMMARY. No backend, no puzzle logic, no components.

## Gaps / issues

- `npx vitest run` → 96/97 pass. One failure: `tests/router.spec.ts > POL-02` (navigate(/archive) sendBeacon).
  - **Pre-existing and unrelated.** The test was last edited in phase 03 (commit 77a5653, 2026-05-04) and exercises router/sendBeacon behaviour through jsdom location mocking. Phase 06 changed no router code (diff scope is welcome.ts + index.html copy only). Not introduced by this phase.
  - Tracked separately — does not block phase 06.

## All must-haves met

Welcome line ✓ · Play line ✓ · en-dash ✓ · subtitle classes reused ✓ · Clues emphasised ✓ · shows on all puzzles ✓ · banner→copy→clues order ✓ · build exit 0 ✓.
