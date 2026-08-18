# Edit-mode round-trip — brief

**Date started:** 2026-08-18
**Branch:** `dev/edit-mode-roundtrip`
**Scope:** Units 1-4 of `docs/superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md`.
Unit 5 (`/fold`) is built separately in `pi-dev-bot` and is out of scope here.

## Seeded from

- `docs/superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md` — the approved design,
  including Jamie's 2026-08-18 hybrid variant decision.
- `docs/superpowers/notes/2026-08-18-tailwind-full-build-spike.md` — Unit 1, measured.

Anything those two files settle is **not re-asked**: scope, the safety gate, no arbitrary
values, and the hybrid variant split are closed. Numbered items below carry them as
assumptions so they stay referenceable.

## Sections

1. What it is — *in progress*
2. Out of scope
3. How it works
4. Maths
5. State & persistence
6. How it fits
7. How it looks
8. Copy & wording
9. Accessibility
10. Analytics
11. Done / test plan

---

## 1. What it is
Settled: pending · Ack: pending

1. **The problem.** Jamie designs by changing things in the browser and looking at the
   result. Today the only way those changes reach the codebase is to describe them to the bot
   in Telegram, which is lossy in both directions — precise descriptions are tedious, vague
   ones get guessed at. (assumed — the design doc's opening)

2. **Who it is for.** Jamie edits. Dave looks, using the per-branch preview URL exactly as he
   does now. Nothing in Units 1-4 changes Dave's route. (assumed — the design doc)

3. **Why now.** The one unverified thing, Unit 1, was measured on 2026-08-18 and works. The
   fallback was not needed. Nothing else in Units 1-4 depends on an unknown. (assumed)

4. **What we are building here.** Units 1-4: the full-Tailwind dev build, the class
   catalogue, the overlay, and the middleware that writes the session file. The deliverable
   ends when `.edit-sessions/<timestamp>.json` exists in the working tree with a well-formed
   patch set in it. (assumed — Jamie's scope boundary, 2026-08-18)

5. **Not our problem here.** Whether `/fold` correctly locates an element in source, or
   normalises it to house conventions, is `pi-dev-bot`'s job. What *is* our problem is that
   the JSON contract is exact enough for that half to be written against it without guessing.
   (assumed)

6. **Where can edit mode actually run?**
   My rec: **the Pi's dev server only — not preprod.** Why: the design says "dev/preprod",
   but preprod is a deployed Worker version with no filesystem and no Vite. Tapping Done
   there cannot write a session file, so edit mode would look available and then fail at the
   last step. Preprod is also Dave's route, and he only looks. Gating to dev alone makes the
   safety test simpler too — the overlay is absent from every deployed artefact, not just
   production.
