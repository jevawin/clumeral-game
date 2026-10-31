# Invariants

The things that must never break. Everything else is a bug; these are damage.

Each one says **what**, **why it matters**, **what currently guards it**, and **how it fails** —
because the failure mode is the useful part. An invariant that fails loudly needs a test. One
that fails *silently* needs a test and a reviewer who knows to look.

Read this before any release (`staging → main`) and before any change touching storage, the
generator, the guess path or the worker. The `.github/pull_request_template.md` checklist points
here.

---

## P1 — Player history is irreplaceable

**What.** `dlng_history` in each player's own `localStorage` is the only copy of their play
record. There is no server-side account, no backup, no export. Some players have a history as
long as the game itself.

**Why.** Losing it cannot be undone or apologised for. Accounts are on the roadmap
([#162](https://github.com/jevawin/clumeral-game/issues/162)); until they exist, treat the
browser store as a production database with no backups — because that is what it is.

**The rules, all already load-bearing:**

- **Never rename the `dlng_` prefix.** It is a legacy name and it is persisted in user browsers
  (`docs/ARCHITECTURE.md`). Renaming it orphans every history on earth.
- **`dlng_active.v` stays at `1`.** Bumping the version throws away the in-progress board of
  every player mid-puzzle.
- **Reads tolerate every shape that has ever been written.** An invalid field drops *that field*,
  never the row, and never the board. `seconds` absent means *unknown*, never `0`.
- **Additive changes only.** A new optional field is safe. Renaming, re-typing or removing one is
  not, and neither is tightening validation on an existing field — old rows fail the new check
  and vanish.

**Guarded by.** `tests/storage-history.spec.ts` (18 cases), `tests/player-stats.spec.ts` (33),
`tests/storage-active.spec.ts` (tolerance of malformed values), `tests/save-pref.spec.ts`,
`e2e/specs/restore.spec.ts`.

**Known gap.** No test loads a *historical* `dlng_history` payload — the shapes that existed
before `seconds`, before `marker`, before `archived` — and asserts it still reads. The realistic
way to destroy a 200-day history is not a read bug; it is a schema change that silently orphans
rows written by an older version. A fixture file of real historical shapes, asserted to still
load, is the single highest-value test this project does not have.

---

## P2 — The game stays playable

**What.** Clues render, digits eliminate, guesses submit, answers validate, state restores.

**Why.** Obvious, and worth stating anyway: a daily game that is broken for one day has broken
that day permanently for everyone who opened it.

**Guarded by.** `e2e/specs/game-solve.spec.ts`, `game-fail.spec.ts`, `smoke.spec.ts`,
`restore.spec.ts`, `undo-reset.spec.ts`, run across six browser projects in `ci-matrix.yml`.

**The non-obvious one.** `generatePuzzleFromRng` in `worker/puzzle.ts` is the **only** entry point
to generation; the raw draw beneath it is private, and a test scans every worker module to keep it
that way. A random puzzle's answer is never stored, so `handleGuess` re-runs generation from the
token's seed — a caller reaching a *different* generator than the one the player was shown marks
**correct guesses wrong**. That is a silent failure that looks like the player being wrong.

---

## P3 — The maths and the logic stay correct

**What.** Every puzzle has exactly one solution, every clue is true of it, and no clue is
redundant.

**Why.** An impossible or ambiguous puzzle is unwinnable, and the player has no way to tell that
from being stuck. Dave owns this; maths changes need his blocking sign-off (`CLAUDE.md`).

**Guarded by.** `tests/puzzle-fibonacci.spec.ts`, `tests/puzzle-redundancy.spec.ts`,
`tests/resolve-route.spec.ts`, and the module scan above.

**Archive integrity is part of this, and is separate from P1.** `PUZZLES` KV is **write-once with
no TTL** — already-served puzzles cannot be rewritten, so a generator change cannot retroactively
corrupt the archive. But it *does* immediately affect any past date that was never frozen
([#235](https://github.com/jevawin/clumeral-game/issues/235)), and **every deployment shares
production KV, preview URLs included.** Whichever deployment writes a date freezes it permanently
for real players.

---

## P4 — The answer never reaches the client

**What.** `/api/puzzle` returns clues only. Validation happens server-side in `POST /api/guess`.

**Why.** If the answer ships to the browser, the game is trivially cheatable and there is no way
to un-ship it for that day. This fails **silently** — nothing crashes, no test goes red, and the
response merely contains one extra field.

**Guarded by.** *Nothing, directly.* `docs/ARCHITECTURE.md` states the rule, and the route tests
exercise the endpoints, but no test asserts the answer is **absent** from an `/api/puzzle`
response. (The `answer` assertions in `tests/save-pref.spec.ts` are about a stored history row
when score-saving is off — a different thing.) One assertion per puzzle kind, that the response
body has no answer field, would close the project's most dangerous silent gap.

---

## P5 — Accessibility does not regress

**What.** Keyboard operation, screen-reader output, focus handling, WCAG AA contrast.

**Why.** For a keyboard or screen-reader player, breaking this *is* breaking P2. Jamie owns it;
accessibility changes need his blocking sign-off.

**Guarded by.** `e2e/specs/a11y.spec.ts` (axe), `tests/palette-contrast.spec.ts`,
`tests/stats-contrast.spec.ts`, and the Accessibility section of `docs/SELF-REVIEW.md`.

---

## P6 — Random-puzzle tokens stay unforgeable

**What.** `HMAC_SECRET` is a per-Worker secret that signs random-puzzle tokens.

**Why.** Its absence fails **silently and dangerously**: `TextEncoder.encode(undefined)` yields
`""`, making the signing key `SHA-256("")` and every token forgeable. Nothing errors. This is the
reason pre-prod shares one Worker rather than being a second deployment (`CLAUDE.md`).

**Guarded by.** *Nothing tests the secret itself.* `tests/wrangler-bindings.spec.ts` asserts
bindings are declared, and `tests/worker-guard.spec.ts` covers the date gate (#205), not this.
A silent failure with no test is the worst combination in this file — a test that signs with an
absent secret and asserts it is rejected rather than accepted would fix it.

Any new binding must also be added to `env.preprod` — omitting one is only a *warning*, and the
Worker then throws at runtime.

---

## P7 — Database migrations are additive only

**What.** Migrations run *before* the new Worker version goes live, so they must leave the
currently-deployed code working.

**Why.** Add columns and tables; never drop or rename in the same pull request as the code that
stops using them. Destructive SQL is refused unless the file is named `*.destructive.sql`, and
only Jamie adds one.

**Guarded by.** `npm run lint:migrations`, plus `tests/lint-migrations.spec.ts`.

---

## The gap that undercuts all of them

**There is no typecheck.** No `tsc` script in `package.json`, no typecheck step in either
workflow. Vite strips types with esbuild, so the build passes regardless, and `tests/` and the
vitest configs are not in `tsconfig.json`'s `include` at all. A change that re-types a stored
history field — exactly the P1 failure mode — would not be caught by types anywhere in CI.

Worth fixing on its own; until then, P1 and P3 rest on tests alone.
