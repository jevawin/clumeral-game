# Edit mode

A design tool for Jamie: change classes in the browser on the real page, tap
the pencil to save, and ask the bot to turn it into a pull request.

**Dev server only.** It is absent from production and pre-prod, and
`tests/edit-mode-safety.spec.ts` asserts that against the built artefacts rather
than a config flag.

- Brief: [`work/2026-08-18-edit-mode-roundtrip-brief.md`](work/2026-08-18-edit-mode-roundtrip-brief.md)
- Plan: [`work/2026-08-19-edit-mode-roundtrip-plan.md`](work/2026-08-19-edit-mode-roundtrip-plan.md)
- Design: [`superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md`](superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md)

---

## Running it

**Jamie starts and stops it, from Telegram.** `/dev` starts one on the current
branch and replies with its Tailscale URL; `/devstop` stops it. `/dev` is
idempotent — a second one hands back the same server and resets its two-hour
clock, with a warning ten minutes before that runs out.

**The bot may not start one at all.** Orphaned dev servers stayed inside its
cgroup and ate its whole memory budget: 179,689,160 throttle events against the
pi bot's 663,152, and a live `vite dev` plus `workerd` measures 657 MB on a 4 GB
box. `npm run dev` is still in `package.json` — the Pi runs it for Jamie behind
`/dev`. He is simply not the one typing it any more, and the bot never does.

The dev server binds on all interfaces so the Pi is reachable from a phone. One
port, 5173.

**If the server exits on its own** — not `/devstop`, not the two-hour limit — the
daemon notices within 30 seconds and sends one message: "⚠️ The dev server on
branch `<name>` exited on its own — I didn't stop it and neither did the 2-hour
limit. /dev to start another." It deletes the registry record, releases the
reaper exemption and reaps the zombie, and it fires exactly once. So there is no
stale registration after a `Save` or a `Discard`, and the next `/dev` never hands
back a URL for a dead process. Worth knowing if you ever touch that code: the liveness
check has to **exclude zombies**. `kill -0`, `killpg(pgid, 0)` and a bare `/proc`
pgid comparison all report a dead server as alive.

**Only one dev server at a time in this working directory.** Two share
Miniflare's SQLite state and the second dies with "database is locked".

## Using it

1. Tap the pencil, bottom right.
2. Tap an element. The breadcrumb reaches any wrapper in one tap; the arrows
   step to parent, child and siblings for boxes that look identical.
3. Change classes — tap a chip to remove, `+` to search, `−`/`+` to walk a scale.
   Desktop also gets a raw class field and a free-CSS box.
4. Tap the pencil again to play the game and try the change in use.
5. **Tapping the pencil leaves the editor, saving first if there is anything to
   save.** If the save fails you stay in the editor with your changes — it is
   the one moment work could be lost, so nothing pretends it worked. With
   nothing to save it simply leaves.
6. **Two session controls sit beside the pencil**, both the pencil's size, both
   an icon until you tap them:
   - **Discard** (bin) is **always there** while the server runs, in the editor
     and out of it. It throws away everything in the phone and then stops the
     dev server, so it is the stop button as well as the discard button.
   - **Save** (floppy) appears **only when there is something to save**. It
     writes the session and then stops the server. If the save fails it stops
     nothing, so you can try again.

   **Both take two taps.** The first arms the control: it grows a label —
   "Save and stop?", "Lose all and stop?", or "Stop the server?" when there is
   nothing to lose — and turns green or red. The second tap acts. An armed
   control disarms itself after four seconds, and arming one disarms the other.
   Nothing here has an undo, which is the whole reason for the second tap.

Then ask the bot to fold the session into a pull request. **`/fold` is not built
yet** — this file describes it below as though it were, and that is future work.

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
- **"Could not save…"** The session was not written. Your changes are still in
  the phone and the editor stays open. Check the dev server is running.
- **"Saved and the server has stopped…"** Save worked. This is the last thing
  that page will ever say, because the server that served it has gone.
- **"Changes discarded and the server has stopped…"** Discard worked. Also the
  last thing that page will ever say. If sessions had already been saved this
  run it names them too — Discard throws away what is in the phone and cannot
  reach a session file already written to the Pi.
- **"Changes discarded, but the server did not stop."** The changes are gone on
  purpose and only the shutdown failed. Tap Discard again to retry, or
  `/devstop` in Telegram.
- **"Saved, but the server did not stop."** The work is safe; only the shutdown
  failed. `/devstop` in Telegram finishes the job.
- **"The pencil saves your changes, if there are any, and leaves the editor."**
  Always on screen in the editor. The pencil is a glyph, so its label is invisible on a phone, and
  this is the only warning that a tap writes a file.

## Dave's preview

Dave previews on Cloudflare, at
`https://<branch>-clumeral-game.jevawin.workers.dev` — the branch name with `/`
replaced by `-`. Workers Builds deploys every push to a dev branch, so there is
nothing to start and nothing to keep running.

There used to be a read-only port here, tunnelled to Dave with `cloudflared`.
It is gone (2026-09-01). Jamie: "I'll edit, bot folds, deploys to Cloudflare,
Dave previews there."

## The session file

`.edit-sessions/<timestamp>.json`, gitignored, one file per save.

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
save several times before anything is folded, and every Save leaves another one
behind. **Discard does not touch them** — it clears the phone, not the Pi. There
is no way to list or delete already-written sessions yet; that is known and
deliberately out of scope.

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

3. **Save really stops it — and so does Discard.**
   `/dev`, change something, tap the pencil to save and leave, then Save twice.
   Then repeat the whole thing with Discard, which is the other way out.
   Confirm **no `vite` and no `workerd` process is left** —
   `pgrep -f workerd` finds nothing — and that exactly one session file was
   written. An orphaned `vite`+`workerd` pair at 657 MB is the whole reason this
   control exists, so a `vite` that exits leaving `workerd` behind is a failure,
   not a partial success.

4. **The controls clear the game's own.**
   On a narrow screen, check the control row and the message above it do not
   cover the game's bottom-centre buttons. Three 56px controls plus an armed
   label is about 304px of a 320px screen, so an armed control is the case to
   look at. The panel sits at the top of the
   stacking order, so anything of ours in that band wins.

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
  shutdown-route.ts            POST /__edit-mode/shutdown — Save and Discard
  gzip.ts, html.ts             compression, and the index.html rewrite

src/edit-mode/                 Browser. Imported by NOTHING in the game.
  overlay.ts                   the entry — the only file the injected script names
  panel.ts, controls.ts        the sealed shadow root and what is in it
  select.ts, scale.ts          selection, and walking a scale
  families.ts, catalogue.ts    which classes fight, and what search offers
  history.ts, project.ts       undo, back, and applying a patch set
  patches.ts, session-store.ts the contract, and surviving a reload
  pending.ts                   is anything unsaved, and what to do about it
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
remaining edits go back on. It is also how saved edits survive a refresh, a route
change and a wake from background — one mechanism, several jobs. That is why the
replay route stayed when the rest of Dave's machinery went.

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
