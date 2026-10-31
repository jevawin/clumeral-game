# Brief — vitest 2 → 4, and the Workers test pool with it

**Date:** 2026-10-31
**Branch:** `dev/vitest-4` (off `staging`)
**Owner:** Jamie (dev lead). Dave acks joint sections.

**Short form: sections 1, 2, 3, 6, 11 — approved by Jamie 2026-10-31.**
Sections 4, 5, 7, 8, 9 and 10 are recorded n/a below, each with its reason.

Replaces the permanent pin recorded by PR #330. Target, verified against npm on
2026-10-31: `vitest@^4.1.12` with `@cloudflare/vitest-pool-workers@^0.19.1`.

---

## 1. What it is
Settled: Jamie 2026-10-31 (item 6 → rec accepted; 1–5 assumptions stand) · Ack: n/a (no joint content)

1. **The problem.** The suite is frozen on `vitest@2.1.9` with
   `@cloudflare/vitest-pool-workers@0.12.21`. Both are the last release on their line, so no
   patch will ever arrive for either. The pool pins its own `miniflare 4.20260310.0` and
   `wrangler 4.72.0`, while root `wrangler` is at `^4.80.0` and keeps climbing — so
   `tests/worker/**` asserts against an ever-older workerd than dev, build and deploy run.
   (assumed — stated in `.github/dependabot.yml` and verified against npm today)
2. **Who it is for.** Jamie and Dave, the only people who run the suite. No player-visible
   change whatsoever. (assumed)
3. **Why now.** PR #330 stops the Dependabot churn (#326, #328, #329 each died on ERESOLVE
   before a test ran) but in exchange makes the freeze permanent *and silent* — three
   `ignore` entries mean nothing in CI will ever raise it again. The only reminder is a
   prose entry in `CLAUDE.md`. Doing it now, while the reasoning is fresh and written down,
   is cheaper than rediscovering it in six months. (assumed)
4. **Target versions.** `vitest@^4.1.12` with `@cloudflare/vitest-pool-workers@^0.19.1`.
   `0.19.1` is deliberate, not "latest": it is the newest pool still on a **stable**
   miniflare (`4.20260730.0`). Re-verified against npm 2026-10-31 — `0.19.2` does not
   exist, and every release `0.20.0` through `0.23.0` ships a miniflare **5 alpha**.
   (assumed)
5. **vitest 5 is not reachable and is not the target.** `5.0.5` is the current latest, but
   pool `0.23.0` — the newest pool release — still declares peer `vitest "^4.1.0"`. 4 is
   the ceiling until Cloudflare moves. (assumed — verified against npm today)
6. **Do we stop at `vitest@3.2.7` on the way, or jump straight to 4?**
   **My rec: go to 4, but in two commits on one branch, with 3.2.7 as the first.**
   Why: every test-file breakage this task owes is a **vitest 3** change, not a 4 change —
   `useFakeTimers` losing its default `toFake` (20 uses, 8 files), `vi.spyOn` reusing an
   existing mock (9 uses, 3 files), and `mock.invocationCallOrder` starting at 1 (3 uses,
   1 file). Every *config* breakage is a **vitest 4** change — the workspace file, the pool
   rewrite, the Pi caps. Those are two disjoint sets of risk. Commit 1 moves `vitest` to
   `3.2.7` alone, touching no config and not moving the pool (`3.2.7` sits inside the
   pool's `"2.0.x - 3.2.x"` peer range and resolves cleanly today), and we prove the suite
   green with both projects still running. Commit 2 then moves to `4.1.12` + pool `0.19.1`
   and does the config work. One PR, one review, but a bisectable line down the middle: if
   the suite goes red we know immediately which half did it. Two *PRs* would cost a second
   round of gates and leave `main` sitting on an unsupported pairing in between — the
   pairing is fine for ten minutes, not for days.
   **Settled 2026-10-31: recommendation accepted — 3.2.7 then 4, two commits, one PR.**

## 2. Out of scope
Settled: pending · Ack: pending

## 3. How it works
Settled: pending · Ack: pending

## 4. Maths
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — Touches no puzzle generation, seeding or filtering — the change is confined to test tooling. Dave's blocking maths sign-off is therefore not required for this brief.

## 5. State & persistence
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — Nothing is stored. No localStorage, no sessionStorage, no URL state, no server state. The only persisted artefact is `package-lock.json`.

## 6. How it fits
Settled: pending · Ack: pending

## 7. How it looks
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — No DOM, no CSS, no rendered output. The only visible surface is terminal test output, and its format is not being changed deliberately — see item 25 in §3 on the `basic` reporter.

## 8. Copy & wording
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — No user-facing strings. Comments in the config files are rewritten, but they are developer documentation and are covered by §3.

## 9. Accessibility
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — Nothing reaches a browser. Jamie's blocking accessibility sign-off is therefore not required for this brief.

## 10. Analytics
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — No runtime or worker code changes, so there is nothing new to instrument and no existing event is affected.

## 11. Done / test plan
Settled: pending · Ack: pending
