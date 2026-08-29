# Edit mode

A design tool for Jamie: change classes in the browser on the real page, tap
Done, and the bot turns it into a pull request.

**Dev server only.** It is absent from production and pre-prod, and
`tests/edit-mode-safety.spec.ts` asserts that against the built artefacts rather
than a config flag.

- Brief: [`work/2026-08-18-edit-mode-roundtrip-brief.md`](work/2026-08-18-edit-mode-roundtrip-brief.md)
- Plan: [`work/2026-08-19-edit-mode-roundtrip-plan.md`](work/2026-08-19-edit-mode-roundtrip-plan.md)
- Design: [`superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md`](superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md)

---

## Running it

```
npm run dev
```

Two ports come up. The dev server prints both:

| port | who | what it can do |
|---|---|---|
| 5173 (Vite's default) | Jamie, over Tailscale | everything, including saving |
| 5174 (one above) | Dave, over a Cloudflare tunnel | **read only** — see below |

The dev server binds on all interfaces so the Pi is reachable from a phone.

**Only one dev server at a time in this working directory.** Two share
Miniflare's SQLite state and the second dies with "database is locked".

## Using it

1. Tap the pencil, bottom right.
2. Tap an element. The breadcrumb reaches any wrapper in one tap; the arrows
   step to parent, child and siblings for boxes that look identical.
3. Change classes — tap a chip to remove, `+` to search, `−`/`+` to walk a scale.
   Desktop also gets a raw class field and a free-CSS box.
4. Tap the pencil again to play the game and try the change in use.
5. **Done** writes the session. Then tap `/fold` in Telegram.

Back undoes one change at a time. Once every change is undone, back leaves edit
mode; one more leaves the page.

An unfinished edit is kept in the browser, keyed to the branch, so a locked
screen or a discarded tab does not lose it. Nothing unfinished reaches the Pi.

## What it will tell you

- **"That class is not in this build."** The class changed no computed style.
  Usually a typo in the raw field. It can also fire falsely, when a class is real
  but sets a value already in force, or affects a child rather than the element
  itself.
- **"The game reset this class after your change…"** The class is set at runtime
  (`theme.ts` toggles `.dark`, several modules toggle `.hidden`), so folding it
  means changing a condition in code rather than a literal. Checked on returning
  from play mode, which is the only moment the game has actually rendered.
- **"Nothing on the scale matches…"** The scale has no answer for what you want.
  Say it in words instead and the token set gets discussed.
- **"This element already had X and Y fighting."** The markup carried two classes
  setting the same property before edit mode touched it. Not tidied away — it is
  your markup and the bot's to fold — but changes there will look unpredictable,
  because CSS order decides the winner.

## Dave's link

`cloudflared` pointed at **the port one above the dev server**.

That port is a separate listener with **no write handler at all**. This is the
whole guarantee, and it is structural rather than a check that could be argued
with: a tunnel connects to the dev server as an ordinary local client, so a
request that started on Dave's phone arrives from `127.0.0.1`. A guard reading
"allow writes from localhost" would therefore **allow Dave, and nothing would
look wrong from Jamie's side** — his own saves come in over Tailscale and succeed
either way. Nothing reaching the read-only port can write, whatever it claims.

Dave's page serves the overlay in replay-only mode: no pencil, no panel. He sees
saved sessions applied on his own refresh, one beat after Done.

## The session file

`.edit-sessions/<timestamp>.json`, gitignored, one file per tap of Done.

**This is a contract with `pi-dev-bot`.** The shapes are brief items 93-96 and
`/fold` is written against them. Do not change a field without saying so in the
group first.

Filenames are `createdAt` with `:` and `.` replaced by `-`, e.g.
`2026-08-19T22-41-07-221Z.json`. They sort lexicographically, which is therefore
chronologically, so ordering needs no parsing.

**`/fold` renames a session it has consumed to `<name>.json.folded`.** The game
reads only bare `.json`. Without the rename, replaying a consumed session
re-applies patches on top of source that already carries them, which for a
stepper walk compounds invisibly. Nothing here deletes a session it did not
write.

Every unconsumed session replays, oldest first — not just the newest. Jamie can
tap Done several times before anything is folded.

---

## Jamie's acceptance checklist

Three things a browser test would have caught and no automated test does. Jamie's
call, made knowing the cost (brief items 88-91): the automated suite is vitest
plus the built-artefact assertions, and he is the tester.

**Run these once, by hand.**

1. **Back undoes one step and does not wipe the page.**
   Make three changes, press back three times. Each one reverses in turn and the
   screen does not reload.

2. **Play mode comes back intact.**
   Leave edit mode, then play the game with a keyboard on desktop — arrow keys,
   digit entry, submit. **This one fails silently**, and it is a defect in the
   shipped game rather than in the tool.

3. **The public link cannot write.**
   Open the tunnel URL, make a change, tap Done, and confirm it is refused.
   **This cannot be found by normal use** — a broken write guard looks exactly
   like a working one from Jamie's side, because his own saves come in over
   Tailscale and succeed either way.

**Recorded rather than argued:** with no browser regression test, these are
verified once and thereafter only by whoever happens to notice. Number 3 in
particular will not resurface on its own if a later change breaks it.

---

## How it is put together

```
edit-mode/                     Node. Imported only by vite.config.ts.
  plugin.ts                    the Vite plugin (apply: 'serve' — dropped from every build)
  classlist.ts                 class list, colour predicate, family map
  catalogue-route.ts           GET /__edit-mode/catalogue.json
  session-routes.ts            POST the session, GET the replay
  sessions.ts                  reading and writing .edit-sessions/
  readonly-proxy.ts            the read-only port
  gzip.ts, html.ts             compression, and the index.html rewrite

src/edit-mode/                 Browser. Imported by NOTHING in the game.
  overlay.ts                   the entry — the only file the injected script names
  panel.ts, controls.ts        the sealed shadow root and what is in it
  select.ts, scale.ts          selection, and walking a scale
  families.ts, catalogue.ts    which classes fight, and what search offers
  history.ts, project.ts       undo, back, and applying a patch set
  patches.ts, session-store.ts the contract, and surviving a reload
  runtime-classes.ts, copy.ts  the game-overwrote-it check, and every word
```

Three things worth knowing before changing any of it.

**The class list comes from Tailwind's own design system**
(`__unstable__loadDesignSystem`), so it cannot drift from `@theme`. It is
generated at dev-server start into gitignored files. That API is marked unstable
and is the one real dependency risk; the fallback is hand-written
`@source inline(...)`, which the spike proved works.

**A utility's family is the set of CSS properties it declares**, read from the
compiled output — not its name prefix. `text-sm`, `text-center` and `text-accent`
share a prefix and do three unrelated jobs, so a prefix rule would delete a font
size when you centre text.

**The patch set is the truth; the DOM is a projection of it.** Undo pops one
entry and re-projects, so if the router rebuilt the screen underneath, the
remaining edits go back on. That is also how Dave's replay works — one mechanism,
two users.

## Two things that will bite

**An explicit `@source` at a file makes Tailwind scan that file's whole
directory.** Two generated class lists side by side meant the small one silently
compiled the big one — 5.24 MB where 1.16 MiB was intended. The generated list
sits alone in its own directory for that reason.

**The query string never reaches the plugin.** `wrangler.jsonc` puts `/` in
`run_worker_first`, so the Worker serves the page and rewrites the request on the
way through. `?something=x` is gone before `transformIndexHtml`, before a `use()`
middleware, and before one unshifted to the front of the stack. Anything wanting
per-request state on a page load needs a different mechanism.

## Issue #312

Tailwind scans everything git does not ignore, including prose in `docs/`, so
class names written in a sentence ship to the production stylesheet. Three
`@source not` lines in `src/tailwind.css` keep edit mode's own class literals out
of it.

**When #312 lands, keep `@source not "./edit-mode"`** — narrowing the scan to
`../src` puts `src/edit-mode/` back inside the scanned set, and the overlay's
class literals would be re-admitted. The other two lines become redundant and
should go. `tests/css-leak.spec.ts` holds #312's own assertion, committed skipped
with the turn-on steps in the file.
