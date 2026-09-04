# Plan: Jamie-controlled dev server — the clumeral-game half

**Date:** 2026-09-01
**Brief:** `docs/work/2026-08-31-jamie-controlled-dev-server-brief.md` — closed 2026-08-31,
da-brief run, every section settled by Jamie, Dave's acknowledgement waived by Jamie (item 60).
**Branch:** `dev/jamie-controlled-dev-server`, off `dev/edit-mode-on-stats`.

## Jamie's decisions, 2026-09-01

Plan approved. Four things settled with it:

1. **Stats and edit mode stay on the one branch.** Edit mode exists to finish stats, so
   splitting them is paperwork.
2. **A draft pull request into `staging`, opened now, marked ready when stats is done.**
   `ci-smoke` triggers on `pull_request` with no draft filter, so a draft gets the full gate on
   every push — and 92 files of change have had no CI at all so far. **Not merged to staging
   until stats is finished**: edit mode never reaches production anyway, so landing early gains
   nothing and risks unfinished stats riding the next staging→main release.
3. **The shutdown route stays `apply: 'serve'` and goes into `edit-mode-safety.spec.ts`.**
4. **Item 55 is answered**, not a gap — see task 9.

## Why this branch and not main

Edit mode is not on `main`. It is 136 commits on `dev/edit-mode-roundtrip`, with the stats
Tailwind conversion stacked 88 commits further on `dev/edit-mode-on-stats`. That second branch
already contains the first, so it is the newest edit-mode code and it is the base here.
Jamie's call, 2026-09-01: edit mode and the stats work go live together, because edit mode is
not public.

The consequence for whoever reviews this: the pull request will contain the in-flight stats
conversion as well. That is expected, not an accident.

## Order of work

Nine tasks. Each is committable on its own and leaves `vitest run` green. Copy comes before
the two tasks that use it; the deletion comes first because it removes code the later tasks
would otherwise have to keep working.

---

### Task 1 — Delete the read-only proxy and everything that fed it
Brief items 4, 35, 51, 52.

**Delete outright**
- `edit-mode/readonly-proxy.ts`
- `tests/edit-mode-readonly.spec.ts`

**`edit-mode/plugin.ts`** — remove the `startReadOnlyProxy` import, the `devPort` constant, the
`startReadOnlyProxy({...})` call, the `server.httpServer?.on('close', …)` handler that closed
it, and the `logger.info` line announcing the second port. `configureServer` keeps
`serveCatalogue`, `receiveSession`, `serveReplay` and `gzipEditStylesheets`.

**`src/edit-mode/overlay.ts`** — delete `isReplayOrigin()` entirely, the `const replayOnly =
await isReplayOrigin()` line, and the `if (replayOnly) return;` early return. `createPanel` is
called with the document alone. The `REPLAY_URL` fetch and the `project()` call that follows it
**stay**: they are how Jamie's own saved edits come back on every load, not Dave's machinery.

**`src/edit-mode/panel.ts`** — delete `PanelOptions`, the `options` parameter and the
`if (!options.replayOnly)` guard. The pencil and the sheet are always appended.

**`edit-mode/session-routes.ts`** — unchanged. `serveReplay` and `REPLAY_ROUTE` stay, and their
doc comment is reworded so it no longer describes them as Dave's route.

**Tests**
- `tests/edit-mode-panel.spec.ts`: delete the two `createPanel(document, { replayOnly: true })`
  cases; add one asserting the pencil and the sheet are always in the shadow root.
- Everything else in the suite must stay green.

**Why this is first:** `isReplayOrigin()` is a blocking `HEAD` request on every startup whose
`catch` returns `true` — meaning "hide the whole tool". Once the header can never be set again,
leaving it in place means one flaky request hides edit mode entirely.

---

### Task 2 — "Pending", and making it survive a reload
Brief items 13, 42.

**New file `src/edit-mode/pending.ts`**

```ts
export function signature(entries: Change[], freeCss: string): string
```

Returns `entries.map(e => e.target + '=' + e.after.join(' ')).join('|') + '||' + freeCss`.
A pure function so the rule can be tested without a DOM: **pending means the current signature
differs from the one recorded at the last successful save.** The accessor in `overlay.ts` is
called `isPending()` — `overlay.ts:466` already has an unrelated `let pending = 0` holding a
`requestAnimationFrame` handle, and two things called "pending" in one file is exactly the
collision this plan is supposed to prevent.

**Derived from the entries' content, not their count.** A count is wrong, and wrong in the
direction that loses work: save at three entries, tap back once to undo, then make a different
change, and the count is three again. The signature would match, `isPending()` would say no,
and task 6 would leave edit mode posting nothing — losing the change with the tab. Back-gesture
undo is a normal path here, not a corner: `nextBackAction` returns `'undo'` for as long as
entries remain. A count also misses `history.record()` collapsing a repeated step inside its
600 ms window (`history.ts:112-117`), which mutates `previous.after` in place and pushes
nothing.

**`src/edit-mode/session-store.ts`** — `StoredState` gains two fields, both defaulted and both
parsed with the same `typeof … === 'string'` guard the existing fields use:
- `savedSignature: string`, default `''`
- `freeCss: string`, default `''`

`freeCss` has to be stored too. It is a bare `let freeCss = ''` in `overlay.ts` today and
survives nothing. Without it, saving with something in the free-CSS box stores a signature
containing that text, and after a reload the box is empty — so the signatures differ, the tool
says pending, and the pencil posts all three patches a second time. That duplicate session file
is precisely what item 13 forbids. Desktop only, since the box is behind `min-width: 768px`,
but the fix is one field.

**`src/edit-mode/overlay.ts`** — a `savedSignature` variable restored from `store.load()`,
written by `persist()`, and set to the current signature after any save that returns 2xx.
`freeCss` is likewise restored and persisted.

**Tests** — new `tests/edit-mode-pending.spec.ts`, all behavioural rather than restatements of
string concatenation:
- adding an entry makes it pending
- **undoing and then making a different change leaves it pending** — the H2 case above, and the
  reason the signature is content-derived
- a collapsed repeated step still counts as a change
- changing the free-CSS box makes it pending
- saving records the signature and it stops being pending
- the same entries in the same order are not pending

`tests/edit-mode-session-store.spec.ts` gains a round trip of `savedSignature` and `freeCss`,
and a case where each stored value is a number, proving the load falls back to `''` rather than
throwing on boot.

---

### Task 3 — The shutdown route
Brief items 3, 40, 41.

**New file `edit-mode/shutdown-route.ts`**

```ts
export const SHUTDOWN_ROUTE = '/__edit-mode/shutdown';
export function receiveShutdown(stop: () => void): Connect.NextHandleFunction
```

In order:
1. Not our URL → `next()`.
2. Not `POST` → **405** with `Allow: POST`.
3. Not same-origin → **403**.
4. Otherwise reply **200** `{ stopping: true }`, and call `stop()` from the response's
   `finish` event — never before it.

**The same-origin rule, and why it has two live branches.** Fetch Metadata headers are only
attached when the request URL is a trustworthy one — HTTPS, `localhost` or `127.0.0.1`. Jamie
reaches the Pi over Tailscale at a plain-HTTP name on port 5173, which is none of those, so
**`Sec-Fetch-Site` never arrives on the phone**. Both branches are therefore real, and the
`Origin` one is the one that matters most:

- `sec-fetch-site` present → accept only `same-origin`. This is the desktop-on-localhost case.
- `sec-fetch-site` absent → accept only if `new URL(origin).host === req.headers.host`. This is
  the phone case. A missing or malformed `Origin` is a refusal, not a throw — parse inside a
  `try`.

Comparing `.host` rather than the raw string is deliberate: `Origin` is `http://pi:5173` while
`Host` is `pi:5173`, so a string comparison never matches. It also survives the Pi ever putting
the dev server behind `tailscale serve` on HTTPS, where a naive comparison would 403 every
shutdown and look exactly like an attack.

**What this does and does not stop.** It stops the browser half: no other page open on Jamie's
phone can kill the server with a cross-origin POST. It does **not** stop `curl` from any
machine on the tailnet, which can set both headers to anything. That residual is accepted — it
is a personal tailnet, the damage is a stopped dev server, and `/dev` starts it again — but it
is stated here rather than left implied.

**Why `stop()` only on `finish`** (brief item 40): if the process exits before the response is
flushed, the browser sees a dropped connection, which is indistinguishable from failure. The
whole of item 40 rests on the reply arriving first.

**`edit-mode/plugin.ts`** — register the middleware before `gzipEditStylesheets`, passing:

```ts
const stop = async () => {
  await server.close().catch(() => {});
  process.exit(0);
};
```

Awaited, because `ViteDevServer.close()` returns a promise and calling `process.exit(0)`
straight after it would abandon the close. `workerd` is not orphaned by the exit: miniflare
registers an `exit-hook` in its constructor whose callback calls `runtime.dispose()`, which
runs `runtimeProcess.kill("SIGKILL")` synchronously, and `exit-hook` listens on
`process.once('exit', …)` — which `process.exit()` does fire. Worth stating plainly, because a
`vite`+`workerd` pair surviving as orphans at 657 MB is the entire reason this feature exists.

**Tests** — new `tests/edit-mode-shutdown.spec.ts`. There is **no existing stub-based route
spec to copy**: nothing under `tests/` imports `receiveSession` or `serveReplay`, and the only
route test, `tests/edit-mode-readonly.spec.ts`, uses real sockets and is deleted in task 1. So
the stub shape is specified here:

- `req`: a plain object with `url`, `method` and `headers`.
- `res`: an object extending `EventEmitter` with `statusCode`, `setHeader()`, and an `end()`
  that records the body and then emits `'finish'`. It must be an emitter, because the item-40
  test asserts ordering across that event.

Cases:
- `GET` → 405, `Allow: POST`, `stop` not called.
- `POST`, `sec-fetch-site: cross-site` → 403, `stop` not called.
- `POST`, `origin` on a different host, no `sec-fetch-site` → 403, `stop` not called.
- `POST`, no `origin`, no `sec-fetch-site` → 403, `stop` not called.
- `POST`, malformed `origin`, no `sec-fetch-site` → 403, no throw.
- `POST`, `sec-fetch-site: same-origin` → 200, and `stop` **not** called until `finish` fires.
- **`POST`, `origin` matching `host`, no `sec-fetch-site` → 200, `stop` called on `finish`.**
  This is the phone's path and the one that would otherwise go untested.
- A URL that is not the route falls through to `next()`.

---

### Task 4 — The words
Brief items 23, 24, 45, 46, 62.

**`src/edit-mode/copy.ts`**
- `exitEditMode` becomes **"Save and exit edit mode"**.
- `saveFailed` becomes **"Could not save. Your changes are still here — check the dev server is
  running and tap the pencil again."**
- `saved` becomes **"Saved. Ask the bot in Telegram to fold this into a pull request."**
- New `stopControl`: **"Save & Stop"**.
- New `stopped`: **"Saved and the server has stopped. Ask the bot in Telegram to fold this into
  a pull request, or tap /dev to start again."**
- New `stopFailed`: **"Saved, but the server did not stop. Use /devstop in Telegram."**
- New `pencilHint`: **"The pencil saves your changes and leaves the editor."**

`done` is **not** deleted here. It is deleted in task 6, with the button it labels. Removing it
now would leave `controls.ts:350` rendering `button(undefined, …)` and turn
`tests/edit-mode-controls.spec.ts` red between two commits, which breaks this plan's own rule
that every task leaves `vitest run` green.

No message names `/fold`, because `/fold` does not exist (brief item 62). `stopped` is the last
thing that page will ever say, so it carries both next steps.

**`src/edit-mode/panel.ts`** — import `COPY` and use `COPY.enterEditMode` / `COPY.exitEditMode`
for the pencil's `aria-label`, in both the initial assignment and `setMode`. They are hardcoded
today and match by coincidence; `tests/edit-mode-panel.spec.ts` already asserts they equal the
`COPY` values, so changing `copy.ts` alone would turn that spec red.

---

### Task 5 — `Save & Stop`, and somewhere to say things in play mode
Brief items 18, 20, 21, 39, 43, 44.

**`src/edit-mode/panel.ts`**

Two new elements in the shadow root, siblings of the pencil, outside the sheet:

- `button.stop-btn`, labelled `COPY.stopControl`. Fixed, bottom-right, immediately left of the
  pencil: `right: calc(16px + 56px + 8px)`, same `bottom` as the pencil, `height: 56px`,
  `border-radius: 28px`, `padding: 0 16px`, black text on white with the pencil's 2px border
  and shadow.
- `p.notice`, for messages that must survive leaving the editor. Fixed, **above** the pencil
  row: `bottom: calc(16px + 56px + 8px + env(safe-area-inset-bottom, 0px))`, `right: 16px`,
  `max-width: min(320px, calc(100vw - 32px))`, `text-align: right`. Styled like the sheet,
  because it inherits nothing — `:host` is `all: initial` — and it sits directly over a game
  that has dark themes: `background: #ffffff`, `color: #1a1a1a`, `border: 2px solid #1a1a1a`,
  `border-radius: 8px`, `padding: 8px 10px`, `font-size: 13px`, `line-height: 1.35`.
  **No `pointer-events: auto`**, so it cannot swallow taps meant for the game.
  `.notice:empty { display: none }`.

The `Panel` interface gains:
- `onStop(handler: () => void): void`
- `setStopVisible(visible: boolean): void`
- `notify(message: string): void` — writes `.notice`

**One owner for the stop button's visibility.** `setMode` may hide it in edit mode, and that is
all it may do — it must never show it. Showing is the overlay's call alone, through
`setStopVisible`, so that a stop button pointing at a dead server cannot be brought back by
Escape (`overlay.ts:149`) or by the back gesture (`overlay.ts:416`) after a successful stop.
`setMode` must also **not** clear `.notice`; it goes on clearing `.status`, which is the
in-sheet line.

**Why a second surface** (brief item 43): `panel.say()` writes into `.status`, a child of
`.sheet`, and `setMode` both hides the sheet and blanks the status on every exit from edit
mode. Every message this feature shows appears in play mode, so as the brief first stood none
of them could have been seen at all.

**The narrow-screen problem, and the fallback** (brief item 44): the game's own bottom-centre
stack is `fixed bottom-6 left-1/2 -translate-x-1/2 z-[300]` in `index.html`, and the panel host
is `z-index: 2147483000` — so anything of ours sits on top of a live game toast. `.notice`
sitting above the pencil clears it. The pill at `right: calc(16px + 56px + 8px)` spans roughly
x=140–220 on a 320px screen, and the toast stack is centred on x=160 at 24px from the bottom,
against the pill's 16–72px band: **they overlap.** The brief settled the pill as left of the
pencil, so build it there and check it by hand (task 9). **If it does cover a toast, the
fallback is to move the pill into the same right-aligned column as `.notice`, directly above
the pencil** — no new decision needed at that point.

**Tests** — `tests/edit-mode-panel.spec.ts`:
- the stop button is in the shadow root, labelled `COPY.stopControl`
- `setMode('edit')` hides it
- `setMode('play')` does **not** show it on its own — only `setStopVisible(true)` does
- `notify()` writes the message, and `setMode('play')` does not clear it, while `say()`'s
  status line is cleared
- `onStop` fires on click

---

### Task 6 — The pencil saves and leaves; the Save button goes
Brief items 1, 10, 11, 12, 34, 46.

**New pure functions in `src/edit-mode/pending.ts`**, so the decisions this feature turns on
can be tested without a DOM — brief item 34 asks for exactly these and `overlay.ts` has no
testable seam today:

```ts
export function exitDecision(pending: boolean, saveOk: boolean | null): 'leave' | 'stay'
export function stopOutcome(result: 'ok' | 'network-error' | 'http-error'): 'stopped' | 'stopFailed'
```

`exitDecision(false, null)` → `'leave'` (nothing to save, item 12). `exitDecision(true, true)`
→ `'leave'`. `exitDecision(true, false)` → `'stay'` (item 11). `stopOutcome` returns
`'stopped'` for both `'ok'` and `'network-error'` — item 40's rule that a dropped socket is
what success looks like — and `'stopFailed'` only for `'http-error'`.

**`src/edit-mode/controls.ts`** — remove `onDone` from `ControlsCallbacks` and the
`button(COPY.done, callbacks.onDone, 'save-btn', 'save')` line at `controls.ts:350`. The footer
keeps Undo and Reset. Add a `row('hint')` carrying `COPY.pencilHint` as the last thing in the
sheet. The `.save-btn` CSS rule in `panel.ts` goes with the button.

**`src/edit-mode/copy.ts`** — delete `done` here, now that nothing renders it.

**Why the hint** (brief item 46): the pencil is a glyph with no visible text, so
"Save and exit edit mode" is an `aria-label` Jamie will never see on a phone. A visible line is
the only actual warning that a tap writes a file.

**`src/edit-mode/overlay.ts`** — `toggleMode` stops being a straight flip. Leaving edit mode:
compute `isPending()`; if nothing is pending, `setMode('play')` and post nothing; otherwise
`await save()` and follow `exitDecision`. On `'leave'`, record the new signature and
`setMode('play')`. On `'stay'`, remain in edit mode and `panel.say(COPY.saveFailed)`. Entering
edit mode is unchanged, and the tap-held-during-load path (`toggleWaiting`) keeps working.
Delete the now-dead `onDone: () => void save(),` wiring at `overlay.ts:309`.

**Tests**
- New cases in `tests/edit-mode-pending.spec.ts` for `exitDecision` and `stopOutcome` — three
  of brief item 34's four required tests: a failed save keeps you in the editor, a failed
  shutdown still reports the save as done, and the pending marker clears on a successful save.
  The fourth, the route refusing a non-POST, is in task 3.
- `tests/edit-mode-controls.spec.ts` — four sites break and all four are updated: the
  `onDone: vi.fn()` stub at line 26, the `byText('Save').click()` and `expect(calls.onDone)`
  assertions at 247–249, the footer-length assertion at 257 (3 → 2), and the label list at 226
  (`['Undo','Reset','Save']` → `['Undo','Reset']`). Add a case asserting the hint line renders
  `COPY.pencilHint`.

---

### Task 7 — Wire `Save & Stop`
Brief items 14, 15, 39, 40, 42, 61.

**`src/edit-mode/overlay.ts`** — add `const SHUTDOWN_URL = '/__edit-mode/shutdown';` beside the
existing `DONE_URL` at `overlay.ts:24-26`. The overlay cannot import from `edit-mode/`, which is
the Node side, so the literal is repeated — and it is the same literal the safety spec asserts
is absent from every build, so the two must be written to match.

`panel.onStop(...)`:

1. If `isPending()`, `await save()`. If it fails, `panel.notify(COPY.saveFailed)` and **stop
   nothing** — the server stays up so the save can be retried (item 14).
2. POST `SHUTDOWN_URL`.
3. Feed the result through `stopOutcome`. On `'stopped'`: mark the overlay stopped,
   `history.restore([])`, `store.clear()`, `panel.setStopVisible(false)`, and
   `panel.notify(COPY.stopped)`.
4. On `'stopFailed'`: `panel.notify(COPY.stopFailed)` and leave the button where it is.

**A `stopped` flag in the overlay, and `persist()` returns early when it is set.** Without it
`store.clear()` is undone within moments: `persist()` writes `history.entries` back to
`sessionStorage` and runs from `setMode`, `select`, `change` and `backOneStep`, so the first
Escape or back gesture after the stop rewrites the session that was just cleared — and the next
`/dev` offers to save a session that is already saved, which is the exact failure item 42
exists to prevent. Clearing the history as well as the store means there is nothing left to
rewrite even if a path is missed. The same flag is what stops `setStopVisible` being called
again for a dead server (task 5).

`panel.setStopVisible(true)` is called once at startup, so the pill is on screen in play mode
for as long as the server is running — Jamie, 2026-08-31: "Always visible" (item 61).

---

### Task 8 — The safety test
Brief items 32, 33, 49, 50.

**`tests/edit-mode-safety.spec.ts`** — three changes.

1. **Share the absence assertions between environments.** Today `.edit-sessions` and the
   `OVERLAY_COPY` list are checked against `dist/` only, while the preprod block checks just
   `tailwind-edit` and `src/edit-mode/`. Lift them into one function run against both
   directories, so nothing is asserted in production and silently skipped in pre-prod
   (item 49).
2. **Add the shutdown route.** `'/__edit-mode/shutdown'` joins the absent strings, asserted
   against `dist/` **and** `dist-preprod/`. This is the assertion the whole feature is judged
   on (item 32).
3. **Stop the pinned list drifting — but do not derive it wholesale.** `OVERLAY_COPY` stays an
   explicit list of the *distinctive* phrases, and gains `COPY.stopped`, `COPY.stopFailed` and
   `COPY.pencilHint`. Alongside it, a new assertion that **every pinned phrase appears verbatim
   in `copy.ts`**. That is what kills the dead `'Reset element'` pin — a string `copy.ts`
   stopped using on 2026-08-26, so the spec has been asserting the absence of something that
   exists nowhere — and it stops a future copy change silently unpinning itself.

   **Deriving the list from `COPY` wholesale does not work**, and this was measured rather than
   guessed: `COPY.undo` is `'Undo'` and `COPY.resetElement` is `'Reset'`, and both appear in the
   shipped game — `dist/client/assets/index-*.js` carries "Board reset. Undo reset available."
   and `dist/clumeral_game/index.js` carries both. Asserting every `COPY` value absent fails on
   the first run, in both environments. Brief item 50 offered the drift assertion as its second
   option and that is the one that works.

The leak-gate test in the same file scans test sources for class-shaped tokens, but its filter
rejects anything containing a space, so every `COPY` value is invisible to it. The new
`'stop-btn'` literal in `panel.ts` **is** class-shaped and will enter that set — harmlessly,
because Tailwind emits no `.stop-btn` selector, exactly as with the existing `save-btn`.

> **Superseded section removed, 2026-09-02.** An earlier draft of task 8 said to derive
> the pinned copy list from `COPY` wholesale. That does not work — the game ships both
> "Undo" and "Reset" — and the version above replaced it. The old text was left in the
> file by mistake and is deleted here, so nobody follows the wrong one.

### Task 9 — Documentation, and the manual round trip
Brief items 37, 38, 48, 53, 55, 59.

**`docs/EDIT-MODE.md` — what goes**
- Intro line and "Using it" step 5: "tap **Done**" → tapping the pencil saves and leaves.
- "Running it": `npm run dev` → `/dev` in Telegram. Say that the Pi runs `npm run dev` for him
  and that the script is still in `package.json` (item 59) — it is Jamie who no longer types it.
- The two-port table and the whole "Dave's link" section. Dave previews on
  `https://<branch>-clumeral-game.jevawin.workers.dev`.
- Line 171, "That is also how Dave's replay works — one mechanism, two users", and lines
  100–101, "Jamie can tap Done several times before anything is folded", both now stale.
- "The session file": "one file per tap of Done" → one per save.
- "How it is put together": drop `readonly-proxy.ts`, add `shutdown-route.ts` and `pending.ts`.
- Acceptance checklist item 3, "The public link cannot write" — untestable once the proxy is
  gone. Replaced by the round trip below.

**`docs/EDIT-MODE.md` — what is ADDED.** The file would otherwise come out describing a tool
with a control it never mentions:
- "Using it" gains `Save & Stop`: what it does, that it saves first, and that it is on screen
  whenever the server is running.
- "What it will tell you" gains `stopped`, `stopFailed` and `pencilHint`, and its existing
  entries are corrected where task 4 changed the wording.
- A plain note that **`/fold` is not built yet**. The file documents it as though it were,
  including `/fold` renaming a consumed session to `.json.folded`.

**Elsewhere** — `docs/work/2026-08-29-edit-mode-handover.md` mentions the proxy at lines 34, 39,
126–127 and 164. `README.md` does **not** mention it; brief item 53 was wrong about that, and
this plan records the correction rather than sending a builder looking.

**Brief item 55 — answered, and it must be documented.** Jamie, 2026-09-01: the Pi already
handles a server that exits on its own, built and tested. `docs/EDIT-MODE.md` gains a short
section saying so, because `COPY.stopped` tells Jamie to tap `/dev` and he needs to know what
he will see if the server died some other way:

- The daemon notices within 30 seconds, on its poll loop.
- It sends one Telegram message: "⚠️ The dev server on branch `<name>` exited on its own — I
  didn't stop it and neither did the 2-hour limit. /dev to start another."
- The registry record is deleted, the reaper exemption is released, and the zombie is reaped.
- It fires exactly once. Later ticks stay quiet.

Worth recording alongside it: detecting this needed a liveness check that **excludes zombies**.
`kill -0`, `killpg(pgid, 0)` and a bare `/proc` pgid comparison all report a dead server as
alive. So there is no stale registration after a `Save & Stop`, and no dead URL from the next
`/dev`.

**Done means** (item 48, correcting item 38): `npm run build && npm run build:preprod &&
vitest run`, all green. `npm run build` alone produces `dist/` only, and the preprod half of
the safety spec skips itself when `dist-preprod/` is missing — so under the original wording
the test that matters most would have passed vacuously. Both directories are gitignored, and
`build:preprod` produces the `client/assets` and `clumeral_game/index.js` layout the spec reads.

**The manual round trip** (item 37), on Jamie's phone, before the pull request: `/dev`, edit
something, tap the pencil to save and leave the editor, then `Save & Stop`. Confirm:
- **no `vite` and no `workerd` process is left** — `pgrep -f workerd` finds nothing. This is the
  whole point of the feature; a stopped `vite` with an orphaned `workerd` behind it is the
  657 MB failure it exists to fix.
- exactly one session file was written
- item 44: the pill and the message clear the game's own bottom-centre controls on a narrow
  screen. If the pill does not, apply task 5's stated fallback.

**No Playwright** (item 36). Edit mode does not exist in a production build, and the browser
suite only ever runs against a production build.

---

## Every brief item, and where it lands

The pi brief's numbered work items 1–5 are all **this repo's**, and are listed as "work 1"–
"work 5" to keep them apart from the numbered brief items 10–62.

| Items | Task |
|---|---|
| work 1, 10, 11, 12, 34, 46 | 6 |
| work 2, 18, 20, 21, 43, 44 | 5 |
| work 3, 40, 41 | 3 |
| work 4, 35, 51, 52 | 1 |
| work 5, 37, 38, 48, 53, 55, 59 | 9 |
| 13, 42 | 2 |
| 14, 15, 39, 61 | 7 |
| 22 | 5 (the CSS and its fallback) and 9 (checked by hand) |
| 23, 24, 25, 26, 27, 28, 45, 62 | 4 |
| 29 | 6 (the `done` key goes with its button) and 8 (the pinned list) |
| 32, 33, 49, 50 | 8 |
| 16, 17, 19 | no code — 16 is "no confirmation step"; 17 and 19 are superseded by 39 and 61 |
| 30, 31 | no code — the standing accessibility decision, unchanged |
| 36 | no code — no Playwright work |
| 47 | answered by 62 |
| 54 | out of scope: the pi bot's, Jamie 2026-09-01 |
| 56, 57, 58, 60 | no code — recorded decisions and housekeeping |

## What this plan does not do

- **No auto-fold.** `/fold` does not exist; the brief defers it.
- **No session browser.** Out of scope in the brief, and item 56 records that every
  `Save & Stop` leaves another unfolded session behind. That hazard is unchanged by this work,
  not introduced by it.
- **Nothing on the Pi.** Items 54 and 55 are the other bot's.

---

## What changed after da-plan, 2026-09-01

Every High and Medium finding is answered above. The four worth knowing about:

- **The copy assertion would have failed on its first run.** Deriving the pinned list from
  `COPY` asserts `'Undo'` and `'Reset'` are absent from production — and the game ships both.
  Task 8 now keeps an explicit list and adds a drift check instead.
- **The pending rule could have lost an edit.** Counting entries misses an undo followed by a
  different change, which is a normal path here. Task 2's signature is derived from the
  entries' content.
- **`Sec-Fetch-Site` never reaches the Pi.** It is only sent to trustworthy origins, and the
  Tailscale address is plain HTTP — so the `Origin` fallback is the branch that actually runs
  on Jamie's phone, and it now has a test.
- **Brief item 34 had been dropped.** Three of its four required tests are back, as pure
  functions in `pending.ts` rather than as an untestable branch inside `overlay.ts`.
