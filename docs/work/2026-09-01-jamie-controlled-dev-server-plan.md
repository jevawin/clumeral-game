# Plan: Jamie-controlled dev server — the clumeral-game half

**Date:** 2026-09-01
**Brief:** `docs/work/2026-08-31-jamie-controlled-dev-server-brief.md` — closed 2026-08-31,
da-brief run, every section settled by Jamie, Dave's acknowledgement waived by Jamie (item 60).
**Branch:** `dev/jamie-controlled-dev-server`, off `dev/edit-mode-on-stats`.

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
export function signature(entryCount: number, freeCss: string): string
```

Returns `` `${entryCount}|${freeCss}` ``. A pure function so the rule can be tested without a
DOM: **pending means the current signature differs from the one recorded at the last successful
save.**

A count rather than a boolean flag, because `backOneStep()` does not go through `change()` — a
flag would stay `false` after an undo, and the pill would offer to save work that had been
undone. A count notices in both directions.

**`src/edit-mode/session-store.ts`** — `StoredState` gains `savedSignature: string`, defaulting
to `''`, parsed with the same `typeof … === 'string'` guard the other fields use. `EMPTY` gains
it.

**`src/edit-mode/overlay.ts`** — a `savedSignature` variable restored from `store.load()`,
written by `persist()`, and set to the current signature after any save that returns 2xx.

**Tests** — new `tests/edit-mode-pending.spec.ts`: the signature changes when an entry is added,
changes again when one is undone, changes when the free-CSS box changes, and is stable
otherwise. `tests/edit-mode-session-store.spec.ts` gains a round-trip of `savedSignature` and a
case where the stored value is a number, proving it falls back to `''` rather than throwing.

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
3. Not same-origin → **403**. The rule: accept when `sec-fetch-site` is `same-origin`; when
   that header is absent, accept only if `origin` matches the request's own `host`; refuse
   everything else, including a missing `origin` with no `sec-fetch-site`.
4. Otherwise reply **200** `{ stopping: true }`, and call `stop()` from the response's
   `finish` event — never before it.

**Why the same-origin check** (brief item 41): the plugin sets `server: { host: true }` so the
Pi is reachable from Jamie's phone over Tailscale, and `vite.config.ts` sets no `allowedHosts`.
Without this, anything on the tailnet — and any web page open in the same browser — can kill
his dev server with one cross-origin POST. `Sec-Fetch-Site` is sent by every browser this tool
runs on and cannot be set by page script.

**Why `stop()` only on `finish`** (brief item 40): if the process exits before the response is
flushed, the browser sees a dropped connection, which is indistinguishable from failure. The
whole of item 40 rests on the reply arriving first.

**`edit-mode/plugin.ts`** — register the middleware before `gzipEditStylesheets`, passing a
`stop` that calls `server.close()` and then `process.exit(0)`.

**Tests** — new `tests/edit-mode-shutdown.spec.ts`, driving the middleware with stub
request/response objects as the other route specs do:
- `GET` → 405, `Allow: POST`, `stop` not called.
- `POST` with `sec-fetch-site: cross-site` → 403, `stop` not called.
- `POST` with `origin` on a different host and no `sec-fetch-site` → 403, `stop` not called.
- `POST` with no `origin` and no `sec-fetch-site` → 403, `stop` not called.
- `POST` with `sec-fetch-site: same-origin` → 200, and **`stop` is not called until the
  response emits `finish`**. Asserted in that order — this is the test for item 40.
- A URL that is not the route falls through to `next()`.

---

### Task 4 — The words
Brief items 23, 24, 45, 46, 62.

**`src/edit-mode/copy.ts`**
- Delete `done` — the button it labelled is going in task 6.
- `exitEditMode` becomes **"Save and exit edit mode"**.
- `saveFailed` becomes **"Could not save. Your changes are still here — check the dev server is
  running and tap the pencil again."**
- `saved` becomes **"Saved. Ask the bot in Telegram to fold this into a pull request."**
- New `stopControl`: **"Save & Stop"**.
- New `stopped`: **"Saved and the server has stopped. Ask the bot in Telegram to fold this into
  a pull request, or tap /dev to start again."**
- New `stopFailed`: **"Saved, but the server did not stop. Use /devstop in Telegram."**
- New `pencilHint`: **"The pencil saves your changes and leaves the editor."**

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
  `border-radius: 28px`, black on white with the pencil's border. Hidden in edit mode.
- `p.notice`, for messages that must survive leaving the editor. Fixed, sitting **above** the
  pencil row rather than left of it — `bottom: calc(16px + 56px + 8px + env(safe-area-inset-
  bottom, 0px))`, `right: 16px`, `max-width: min(320px, calc(100vw - 32px))`, `text-align:
  right`. `.notice:empty { display: none }`.

The `Panel` interface gains:
- `onStop(handler: () => void): void`
- `setStopVisible(visible: boolean): void`
- `notify(message: string): void` — writes `.notice`

`setMode` hides `.stop-btn` in edit mode and shows it in play mode, and **must not clear
`.notice`**. It goes on clearing `.status`, which is the in-sheet line.

**Why a second surface** (brief item 43): `panel.say()` writes into `.status`, a child of
`.sheet`, and `setMode` both hides the sheet and blanks the status on every exit from edit
mode. Every message this feature shows appears in play mode, so as the brief first stood none
of them could have been seen at all.

**Why above rather than left** (brief item 44): the game's own bottom-centre stack is
`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300]` in `index.html`. A message box extending
left from the pencil crosses it on a narrow screen; one sitting above the pencil does not.

**Tests** — `tests/edit-mode-panel.spec.ts`:
- the stop button is in the shadow root, labelled `COPY.stopControl`
- `setMode('edit')` hides it, `setMode('play')` shows it
- `notify()` writes the message, and `setMode('play')` **does not** clear it, while `say()`'s
  status line **is** cleared
- `onStop` fires on click

---

### Task 6 — The pencil saves and leaves; the Save button goes
Brief items 1, 10, 11, 12, 46.

**`src/edit-mode/controls.ts`** — remove `onDone` from `ControlsCallbacks` and the
`button(COPY.done, …)` line from the footer. The footer keeps Undo and Reset. Add a
`row('hint')` carrying `COPY.pencilHint` as the last thing in the sheet.

**Why the hint** (brief item 46): the pencil is a glyph with no visible text, so
"Save and exit edit mode" is an `aria-label` Jamie will never see on a phone. A visible line is
the only actual warning that a tap writes a file.

**`src/edit-mode/overlay.ts`** — `toggleMode` stops being a straight flip:

- Entering edit mode: unchanged.
- Leaving edit mode with **nothing pending**: `setMode('play')`, post nothing (item 12).
- Leaving edit mode with **something pending**: `await save()`. On 2xx, record the new
  signature and `setMode('play')`. On failure, **stay in edit mode** and show
  `COPY.saveFailed` (item 11).

The tap-held-during-load path (`toggleWaiting`) keeps working unchanged.

**Tests** — `tests/edit-mode-controls.spec.ts`: the footer renders exactly Undo and Reset, and
the hint line is present with `COPY.pencilHint`. The save-and-exit branching is proved through
the pure signature rule from task 2 plus the panel tests; `overlay.ts` has no unit spec today
and this plan does not add one, because it is a wiring file with no testable seam. The failure
path is covered end to end by the manual round trip in task 9.

---

### Task 7 — Wire `Save & Stop`
Brief items 14, 39, 40, 42.

**`src/edit-mode/overlay.ts`** — `panel.onStop(...)`:

1. If pending, `await save()`. If it fails, show `COPY.saveFailed` and **stop nothing** — the
   server stays up so the save can be retried (item 14).
2. POST `/__edit-mode/shutdown`.
3. On a 2xx, **or on a network error** (item 40 — a dropped socket is what success looks like):
   `store.clear()`, `panel.notify(COPY.stopped)`, hide the stop button.
4. Only on a non-2xx reply that actually arrives: `panel.notify(COPY.stopFailed)`.

`store.clear()` on success is item 42: the entries otherwise outlive the server, and the next
`/dev` would offer to save a session that is already saved.

`panel.setStopVisible(true)` is called once at startup, so the pill is on screen in play mode
for as long as the server is running — Jamie, 2026-08-31: "Always visible" (item 61).

---

### Task 8 — The safety test
Brief items 32, 33, 49, 50.

**`tests/edit-mode-safety.spec.ts`** — three changes.

1. **Share the absence assertions between environments.** Today `.edit-sessions` and the whole
   `OVERLAY_COPY` list are checked against `dist/` only, while the preprod block checks just
   `tailwind-edit` and `src/edit-mode/`. Lift the checks into one function run against both
   directories, so nothing is asserted in production and skipped in pre-prod (item 49).
2. **Add the shutdown route.** `'/__edit-mode/shutdown'` joins the absent strings, asserted
   against `dist/` **and** `dist-preprod/`. This is the assertion the whole feature is judged
   on (item 32).
3. **Derive the pinned copy from `COPY`.** Import it from `src/edit-mode/copy.ts` and assert
   every value is absent from the production JS, instead of the hand-copied `OVERLAY_COPY`
   list (item 50). That list still pins `'Reset element'`, a string `copy.ts` stopped using on
   2026-08-26 — it has been asserting the absence of something that exists nowhere. Deriving it
   makes a copy change unable to silently unpin itself.

The leak-gate test in the same file scans test sources for class-shaped tokens; copy strings
are prose and will not match its filter, so importing `COPY` here does not widen it.

---

### Task 9 — Documentation, and the manual round trip
Brief items 37, 38, 48, 53, 59.

**`docs/EDIT-MODE.md`**
- Intro line and "Using it" step 5: "tap **Done**" → tapping the pencil saves and leaves.
- "Running it": `npm run dev` → `/dev` in Telegram. Say that the Pi runs `npm run dev` for him
  and that the script is still there (item 59) — it is Jamie who no longer types it.
- Delete the two-port table and the whole "Dave's link" section. Dave previews on
  `https://<branch>-clumeral-game.jevawin.workers.dev`.
- "The session file": "one file per tap of Done" → one per save.
- "How it is put together": drop `readonly-proxy.ts`, add `shutdown-route.ts` and `pending.ts`.
- Acceptance checklist: drop item 3, "The public link cannot write" — untestable once the
  proxy is gone. Replace with the round trip below.
- Note plainly that `/fold` is not built yet, since the file documents it as though it were.

**`docs/work/2026-08-29-edit-mode-handover.md`** line 34 — drop "read-only proxy on 5174".
Check `README.md` for the same and fix it if present.

**Done means** (item 48, correcting item 38): `npm run build && npm run build:preprod &&
vitest run`, all green. `npm run build` alone produces `dist/` only, and the preprod half of
the safety spec skips itself when `dist-preprod/` is missing — so under the original wording
the test that matters most would have passed vacuously.

**The manual round trip** (item 37), on Jamie's phone, before the pull request: `/dev`, edit
something, tap the pencil to save and leave the editor, then `Save & Stop`. Confirm the server
is gone, that exactly one session file was written, and — item 44 — that the pill and the
message clear the game's own bottom-centre controls on a narrow screen.

**No Playwright** (item 36). Edit mode does not exist in a production build, and the browser
suite only ever runs against a production build.

---

## Every brief item, and where it lands

| Items | Task |
|---|---|
| 1, 10, 11, 12, 46 | 6 |
| 3, 40, 41 | 3 |
| 4, 35, 51, 52 | 1 |
| 13, 42 | 2 |
| 14, 39, 61 | 7 |
| 18, 20, 21, 43, 44 | 5 |
| 22 | 5 (CSS) and 9 (checked by hand) |
| 23, 24, 25, 27, 28, 26, 45, 62 | 4 |
| 32, 33, 49, 50 | 8 |
| 37, 38, 48, 53, 59 | 9 |
| 2, 5 | the pi bot's half — already built and live |
| 15 | 5 and 7 together: the surface, then the message |
| 17, 19 | superseded by items 39 and 61 |
| 29 | 4 (the `done` key goes) and 8 (the pinned list) |
| 30, 31 | no code — the standing accessibility decision, unchanged |
| 36 | no code — no Playwright work |
| 47 | answered by 62 |
| 54, 55 | out of scope: the pi bot's, Jamie 2026-09-01 |
| 56, 57, 58, 60 | no code — recorded decisions and housekeeping |

## What this plan does not do

- **No auto-fold.** `/fold` does not exist; the brief defers it.
- **No session browser.** Out of scope in the brief, and item 56 records that every
  `Save & Stop` leaves another unfolded session behind. That hazard is unchanged by this work,
  not introduced by it.
- **Nothing on the Pi.** Items 54 and 55 are the other bot's.
