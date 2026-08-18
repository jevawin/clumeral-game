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
Settled: Jamie 2026-08-18 · Ack: pending (Dave)

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

7. **The safety test is now stronger, so it must assert more.** Edit mode must be absent from
   **every deployed artefact — preprod as well as production** — and that is asserted against
   the built output, never a config flag. It covers all three parts: the overlay code, the
   dev-server middleware, and the edit-mode stylesheet, plus the edit-mode-only utilities the
   spike proved can leak into the CSS. Concrete assertions land in §11. (Jamie 2026-08-18)

8. **How Jamie reaches the dev server, which is now the only route.** Over Tailscale from his
   phone, or a cloudflared tunnel if a public link is ever wanted. The server accepts POSTs
   that write files into the working tree, so it is **never exposed unauthenticated**. This is
   a constraint on the design, not an implementation detail. (Jamie 2026-08-18)

## 2. Out of scope
Settled: pending · Ack: pending

9. **Unit 5, `/fold`.** Lives in `pi-dev-bot` and is being built separately. We own the file
   format it reads; we do not own what it does with it. (assumed — Jamie's boundary)

10. **Arbitrary values.** `mt-[13px]` is not offered and cannot be typed. Hitting the edge of
    the scale is information: Jamie says so in words and the token set gets discussed.
    (assumed — closed in the design, not reopened here)

11. **Any change to preprod or production behaviour.** Both stay exactly as they are today.
    (assumed — follows from item 6)

12. **Fixing the docs class-scanning leak.** That is issue #312 and a separate branch. This
    work must not make it worse, but does not fix it. (assumed — Jamie 2026-08-18)

13. **Screenshots and computed CSS.** The patch carries class lists and identifying context,
    nothing rendered. (assumed — the design rejected both)

14. **Build-time source stamping.** No Vite plugin writing `data-src` onto elements. The bot
    greps and asks when ambiguous. A clean later addition if real use needs it. (assumed —
    rejected in the design)

15. **The desktop panel is IN scope**, including its raw class field and free-CSS box. It is
    part of Unit 3 as designed. Note the consequence for §3 and the contract: a free-CSS entry
    is not a class change, so the session file has to carry more than one kind of patch.
    (assumed — the design specifies it)

16. **Can Dave ever view an uncommitted edit session, or only the PR preview?**
    My rec: **only the PR preview — out of scope.** Why: an uncommitted session exists only on
    the Pi's dev server behind Tailscale, so letting Dave see it means either adding him to
    the tailnet or standing up a tunnel to a server that accepts file-writing POSTs. And what
    he would be looking at is a draft the bot is about to rewrite — the overlay's output is
    deliberately not code anyone would keep. The cost of saying no: Dave cannot weigh in until
    the PR exists, so a change he dislikes costs one extra round trip.
