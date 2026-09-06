# Brief: Jamie-controlled dev server — the clumeral-game half

**Date:** 2026-08-31
**Status:** approved by Jamie in Telegram. The Pi half is already built and live.
**Written by:** the pi admin bot. The full design lives in the pi-mediaserver repo at
`docs/superpowers/specs/2026-08-31-jamie-controlled-dev-server-design.md`, which **this repo's
user cannot read** (`/home/jevawin` is 0700). Everything needed is restated below — treat this
file as the source of truth for the work.

## Why this is happening

Both bots kept timing out. Measured cause: dev servers orphaned by a killed turn stayed inside
the dev bot's cgroup and ate its entire 1000 MB memory budget — **179,689,160** `memory.high`
throttle events against the pi bot's **663,152**. A live `vite dev` + `workerd` pair measures
**657 MB RSS** on a 4 GB box that had 482 MB free.

Jamie's decision was to reject automation in favour of control:

> "Instead of relying on more clever watching and ending processes etc, why not give me
> control? I start and I stop the server. […] I don't think relying on you to close is right
> or automations and monitoring because it adds a layer."

## What has ALREADY changed on the Pi (do not rebuild any of this)

- **`/dev`** starts one dev server on the current branch and replies with its Tailscale URL.
  Idempotent — a second `/dev` returns the same server and resets its clock.
- **`/devstop`** stops it.
- A server Jamie started is registered in `/run/ai-turns/dev-server.json` and is **exempt from
  both reapers**, unconditionally.
- **2-hour backstop**, warning at 10 minutes.
- **The bot may no longer start a dev server at all.** `lib/persona.py` forbids `vite dev` and
  `npm run dev`. Use `vite build`, `vitest run` and `npm run e2e:serve`.

## The work

### 1. Remove **Done**

The pencil becomes the save-and-exit control: tapping it saves the pending changes and leaves
the editor. Jamie's words:

> "I asked to remove 'done' and tapping the pencil again saves changes and comes out of editor
> so link to done won't work needs a definitive action outside of editor"

### 2. A stop control OUTSIDE the editor

On the page, not in the editor overlay:

- changes pending → `(Save & Stop)` `(✏️)`
- nothing pending → `(✏️)`

### 3. `Save & Stop` writes the session, then shuts the server down

It POSTs a shutdown request to a **serve-only** route. It must inherit the existing guarantee —
`apply: 'serve'` in `edit-mode/plugin.ts`, asserted against built artefacts by
`tests/edit-mode-safety.spec.ts` — that none of this can reach production. **Extend that test to
cover the new route**; a shutdown endpoint reaching a deployed Worker is the worst failure this
feature could have.

### 4. Delete the read-only proxy and Dave's tunnel

Jamie: *"1 lose it. I'll edit, bot folds, deploys to Cloudflare, Dave previews there."*

- Delete `edit-mode/readonly-proxy.ts` and its `startReadOnlyProxy` call in `plugin.ts`.
- Drop the `devPort + 1` port entirely.
- Remove Dave's tunnel section from `docs/EDIT-MODE.md`.

Dave now previews on the Cloudflare URL, which already works —
`https://{branch}-clumeral-game.jevawin.workers.dev`, `/` → `-`. Verified live on 2026-08-31:
`dev-stats-tweaks`, `dev-edit-mode-roundtrip` and `staging` all returned HTTP 200. Workers
Builds already deploys every dev-branch push; **no CI work is needed.**

### 5. Update `docs/EDIT-MODE.md`

`npm run dev` is no longer how it starts — `/dev` in Telegram is. The two-port table goes.

## NOT in scope

- **Auto-fold.** Jamie approved Save & Stop eventually triggering the fold, but **`/fold` does
  not exist** — it is documented in `docs/EDIT-MODE.md` and has no handler anywhere in the
  daemon. Auto-fold is deferred until `/fold` is real. Save & Stop writes the session and stops
  the server; folding stays a manual instruction for now.
- **A session browser.** There is no way for Jamie to list or discard unfolded sessions. He has
  seen this and said "one for later". Three orphaned test sessions were deleted on 2026-08-31.

## Constraint worth knowing

**Only one dev server per working directory** — two share Miniflare's SQLite and the second
dies with "database is locked". Already documented in `docs/EDIT-MODE.md`; the Pi side relies
on it, so do not design anything that assumes two can coexist.

---

# The short brief (this repo's half)

**Short form: sections 3, 7, 8, 11 — approved by Jamie 2026-08-31.** Everything above this
line is the pi admin bot's brief and is already approved; it stands as sections 1, 2, 5 and 6.

Item numbers below start at **10** so they never clash with the numbered work items 1–5 above.
Numbers are append-only: never reused, never renumbered.

Carried over without reopening:
- **§1 What it is / §2 Out of scope / §6 How it fits** — the pi bot's brief above.
- **§4 Maths — n/a.** Nothing here touches puzzle generation or filtering.
- **§5 State & persistence** — unchanged. The session file under `.edit-sessions/` stays
  exactly as it is; this work does not change what Save writes.
- **§10 Analytics — n/a.** Edit mode is dev-only and `apply: 'serve'` keeps it out of every
  build, so there is nothing to measure and nowhere to send it.

## 3. How it works
Settled: Jamie 2026-08-31, REOPENED by da-brief 2026-08-31 (see items 39-42) · Ack: Override: Jamie 2026-08-31

10. Tapping the pencil while in edit mode saves the pending changes and then leaves edit
    mode. (assumed — Jamie's own words in the brief above.)
11. If that save FAILS, we stay in edit mode and show the existing "could not save" message.
    My rec: do not leave the editor. Why: leaving looks like it worked. The edits only exist
    in the phone until a save succeeds, so an exit that follows a failure is the one path
    that can lose work.
12. Tapping the pencil with nothing pending just leaves edit mode, posting nothing.
    (assumed — no empty session files.)
13. "Pending" means at least one change has been made since the last successful save. Saving
    twice with nothing in between writes one session file, not two. (assumed — today two taps
    of Save write the same patches twice.)
14. `Save & Stop` saves, leaves edit mode, then stops the server — in that order, and it only
    stops if the save succeeded.
    My rec: yes. Why: same reasoning as 11. A stopped server cannot be retried against.
15. Once the server has stopped, the panel says so and says the page is finished with.
    My rec: show a closing message. Why: the reply arrives before the server dies, so we can
    say it. Without it Vite's own client just starts flashing reconnect errors and it reads
    as a crash rather than as the thing Jamie just asked for.
16. No confirmation step before `Save & Stop`.
    My rec: no. Why: one user, and `/dev` starts it again in seconds. A confirm is a second
    tap on a phone for nothing.
17. No stop-WITHOUT-saving control on the page.
    My rec: no. Why: `/devstop` in Telegram already does exactly that, and keeping one
    meaning on the page control is what makes it safe to tap.

## 7. How it looks
Settled: Jamie 2026-08-31, REOPENED by da-brief 2026-08-31 (see items 39, 43, 44) · Ack: Override: Jamie 2026-08-31

18. `Save & Stop` is a labelled pill sitting immediately left of the pencil, bottom-right,
    vertically aligned with it. (assumed — the pencil is already the "on the page, outside
    the editor" spot, and a second control there needs no new place to look.)
19. It shows ONLY in play mode, and only when something is pending. In edit mode the pencil
    is the save control (work item 1), so a second save control there would be two ways to do
    one thing.
    My rec: play mode only. Why: it is also what keeps it clear of the open sheet. The sheet
    is pinned to the bottom of the screen and already has to dodge the pencil; a second
    control beside the pencil would eat more of the row Jamie types classes into.
20. A label, not an icon. Black filled, same treatment the Save button has today.
    (assumed — it is rare, and it ends the session; an unlabelled glyph is a guess.)
21. It lives in the panel's shadow root alongside the pencil, not in the game's markup.
    (assumed — the game's markup ships; the shadow root does not.)
22. It fits beside the pencil at 320px wide: 56px pencil, 8px gap, roughly 100px pill.
    (assumed — measured against the existing panel CSS, worth an eye on a real phone.)

## 8. Copy & wording
Settled: Jamie 2026-08-31, REOPENED by da-brief 2026-08-31 (see items 45-47) · Ack: Override: Jamie 2026-08-31

23. The pencil's label while in edit mode becomes **"Save and exit edit mode"** (today:
    "Exit edit mode"). Why: it now does two things, and the label is the only warning that a
    tap writes a file.
24. `saveFailed` loses its reference to a button that no longer exists. New wording:
    **"Could not save. Your changes are still here — check the dev server is running and tap
    the pencil again."**
25. `saved` is unchanged: "Saved. Tap /fold in Telegram to turn this into a pull request."
    Still true — the pencil save leaves the server running. (assumed)
26. The stop control is labelled **"Save & Stop"**, Jamie's own words from the brief above.
    (assumed)
27. After the server stops: **"Saved and the server has stopped. Tap /fold in Telegram to
    turn this into a pull request, or /dev to start again."** Why: this is the last thing the
    page will ever say, so it carries both next steps rather than one.
28. If the save succeeds but the shutdown does not: **"Saved, but the server did not stop.
    Use /devstop in Telegram."** Why: the work is safe and only the stop failed, so the
    message should not read like a lost session.
29. The `done` key leaves `copy.ts` with the footer button it labelled. (assumed — work
    item 1.) `tests/edit-mode-safety.spec.ts` pins overlay copy as absent from the production
    bundle; the new strings above go on that list.

## 9. Accessibility
Settled: Jamie 2026-08-31 (standing decision confirmed) · Ack: n/a (Jamie's owned section)

30. The new control is held to the same bar as the rest of the panel — which the original
    edit-mode brief (item 81) set as "only me using it, no accessibility needs, prioritise
    simplicity". So: a real `<button>` with a visible text label, 38px minimum tap target and
    the panel's existing focus ring, and nothing beyond that.
    My rec: no change to the standing decision. Why: it is one control, in a dev tool, that
    never ships. The GAME's accessibility is untouched by this work.
31. The one carried-over guarantee that still holds: the game's own keyboard handling must
    survive edit mode being present (original brief item 76, enforced in `intercept.ts`).
    Nothing in this work goes near it. (assumed)

## 11. Done / test plan
Settled: Jamie 2026-08-31, REOPENED by da-brief 2026-08-31 (see items 48-50) · Ack: Override: Jamie 2026-08-31

32. **The one that matters.** `tests/edit-mode-safety.spec.ts` gains the shutdown route to its
    absence checks, asserted against `dist/` AND `dist-preprod/` exactly as the existing
    `src/edit-mode/` and `.edit-sessions` assertions are. Why: a shutdown endpoint on a
    deployed Worker is the worst thing this feature could do, and the existing spec's whole
    argument is that a built file is a fact where a config flag is only a promise.
33. The two new panel messages (items 27 and 28) join the overlay-copy list that same spec
    pins as absent from the production bundle. Why: production JS is minified, so copy is
    what survives to be asserted on.
34. New unit tests in the existing vitest style: the shutdown route refuses anything that is
    not a POST; a failed save leaves edit mode open and does not stop the server; a failed
    shutdown still reports the save as done; the pending flag clears on a successful save.
35. `tests/edit-mode-readonly.spec.ts` is deleted with the proxy it tests, and the read-only
    references in `tests/edit-mode-panel.spec.ts` go with the `replayOnly` option.
36. No Playwright work. Edit mode does not exist in a production build, and the browser suite
    only ever runs against a production build — so there is nothing there for it to drive.
    My rec: none. Why: the cover that matters here is the built-artefact check in 32, which is
    a unit test.
37. One manual round trip on Jamie's phone before the pull request: `/dev`, edit something,
    tap the pencil to save and leave the editor, then `Save & Stop`. Confirm the server is
    gone and exactly one session file was written. The acceptance checklist in
    `docs/EDIT-MODE.md` is updated to this flow.
38. Done means: `vitest run` green, `npm run build` green, `docs/EDIT-MODE.md` updated
    (two-port table gone, `/dev` replacing `npm run dev`, Dave's tunnel section removed), and
    the round trip in 37 passed.

---

# da-brief review, 2026-08-31 — findings and what changed

The review found the feature **as first written could not be built**: the stop control was
hidden at the exact moment it was needed, and the panel had nowhere to show the messages §8
writes. Items 39 onward are the fixes. Numbers are append-only; the items they supersede stay
above, struck through in meaning but not deleted.

## 3. How it works — reopened
Settled: Jamie 2026-08-31 (item 39 answered "always visible"; 40-41 accepted as recommended) · Ack: Override: Jamie 2026-08-31

39. **Supersedes item 19.** `Save & Stop` shows in play mode **whenever the server is
    running**, not only when something is pending. It saves if there is anything pending, and
    it stops the server either way.
    Why the first version was wrong (finding H1): item 10 makes the pencil save and exit,
    item 13 clears pending on a successful save — so the round trip in item 37 (tap the
    pencil, then tap `Save & Stop`) hid the pill at exactly the moment it was needed, and
    item 17 removed the only other way to stop from the page. Item 14's ordering now applies
    only when there is something to save.
40. **A network error AFTER the shutdown request is treated as SUCCESS**, not failure.
    Item 28's "did not stop" message fires only on a real non-2xx reply that actually
    arrives. The server sends its response, waits for it to flush, and only then exits.
    Why (finding H3): a dropped connection is what a *successful* shutdown looks like from
    the browser. Treating it as failure would routinely show the wrong final message, and it
    is the last thing that page ever says.
41. **The shutdown route accepts only a same-origin POST** and refuses everything else.
    Why (finding H5): the dev server binds on all interfaces so Jamie's phone can reach it
    over Tailscale, and `vite.config.ts` sets no `allowedHosts`. Without this check anything
    on the tailnet, and any page open in the same browser, can kill his server. This is the
    threat that is actually live; the built-artefact check in item 32 covers a different one
    and does not replace it.

## 5. State & persistence — reopened
Settled: Jamie 2026-08-31 (corrections accepted as recommended) · Ack: Override: Jamie 2026-08-31

42. **Pending survives a refresh.** It is a saved-watermark kept beside the edit history in
    `sessionStorage`, not a plain variable. On a successful `Save & Stop` the stored session
    is cleared.
    Why (finding H4): `save()` never clears `history.entries`, so pending cannot be derived
    from them. Reloading mid-session is normal here, and a variable would come back wrong —
    either the pill vanishes with unsaved work, or a second save writes a duplicate session
    file. Clearing on stop is what stops the next `/dev` offering to re-save a session that
    is already saved.

## 7. How it looks — reopened
Settled: Jamie 2026-08-31 (corrections accepted as recommended) · Ack: Override: Jamie 2026-08-31

43. **A message line that survives leaving the editor.** The closing messages need somewhere
    to render in play mode: a line in the panel's shadow root, beside the pencil, which
    `setMode` does not clear.
    Why (finding H2): today `panel.say()` writes into `.status` inside `.sheet`, and
    `setMode` hides the sheet and blanks the status on every exit from edit mode. Every
    message in items 15, 27 and 28 is shown in play mode, so as first written none of them
    could be seen at all.
44. The 320px check in item 22 also has to clear the game's own bottom-centre stack
    (`index.html`, `fixed bottom-6 left-1/2 -translate-x-1/2 z-[300]`), not just the pencil.
    A pill extending left from the pencil crosses that band on a narrow screen.

## 8. Copy & wording — reopened
Settled: Jamie 2026-08-31 (item 47 answered — see item 62) · Ack: Override: Jamie 2026-08-31

45. Item 23 must also name `src/edit-mode/panel.ts`, which **hardcodes** `'Edit mode'` and
    `'Exit edit mode'` rather than importing `COPY`. They match today by coincidence, and
    `tests/edit-mode-panel.spec.ts` asserts the attribute equals `COPY.enterEditMode` — so
    editing `copy.ts` alone turns that spec red. The fix is to make `panel.ts` read `COPY`.
46. **A visible signal that the pencil now saves.** Item 23's label is an `aria-label` on a
    pencil glyph, which Jamie will never see on a phone, so it cannot be the warning item 23
    claimed. Add a persistent line in the sheet while in edit mode: **"The pencil saves your
    changes and leaves the editor."**
47. **OPEN QUESTION for Jamie.** Items 25 and 27 tell him to "Tap /fold in Telegram", but the
    "NOT in scope" note above states plainly that `/fold` does not exist and has no handler
    anywhere in the daemon. Item 27 is the last thing the page will ever say, so it should
    not name a command that does nothing.

## 11. Done / test plan — reopened
Settled: Jamie 2026-08-31 (corrections accepted as recommended) · Ack: Override: Jamie 2026-08-31

48. **Supersedes item 38's build line.** Done means `npm run build && npm run build:preprod
    && vitest run`, all green.
    Why (finding H6a): the preprod half of `tests/edit-mode-safety.spec.ts` skips itself
    unless `dist-preprod/` exists, and `npm run build` produces `dist/` only. Under the
    original wording the test that matters most would have passed vacuously.
49. **Corrects item 32.** "Exactly as the existing assertions" was factually wrong: the
    preprod block checks only `tailwind-edit` and `src/edit-mode/`, while `.edit-sessions`
    and the whole `OVERLAY_COPY` list live in the production block. The preprod block gains
    the shutdown route string, `.edit-sessions` and the copy list too.
50. **The pinned copy list is derived from `COPY`, or each pinned phrase is asserted to exist
    in `copy.ts`.**
    Why (finding M7): `OVERLAY_COPY` still pins `'Reset element'`, a string `copy.ts` stopped
    using on 2026-08-26. It has been asserting the absence of something that exists nowhere.
    Adding items 27 and 28 to a list with no drift protection would repeat that.

## 6. How it fits — corrections
Settled: Jamie 2026-08-31 (corrections accepted as recommended) · Ack: Override: Jamie 2026-08-31

51. **Work item 4 removes more than it names** (finding M5). Also going:
    `isReplayOrigin()` in `src/edit-mode/overlay.ts` — a blocking `HEAD` on every startup
    whose `catch` returns `true`, meaning a hiccup hides the entire tool — the `replayOnly`
    early return beside it, and `PanelOptions.replayOnly` in `src/edit-mode/panel.ts`.
    `tests/edit-mode-readonly.spec.ts` goes with the proxy.
52. **`serveReplay` and `REPLAY_ROUTE` in `edit-mode/session-routes.ts` STAY.** They are not
    only Dave's machinery: the overlay fetches the replay on every load and projects it, so
    Jamie's own saved edits come back through that route. Deleting it with the rest of the
    read-only work would silently break the reload safety net.
53. **The doc list in item 38 was incomplete** (finding M6). `docs/EDIT-MODE.md` also needs:
    the "How it is put together" file map, which still lists `readonly-proxy.ts`; the intro
    line and step 5 of "Using it", which still say "tap **Done**" — a button that has read
    `Save` since 2026-08-26 and is now going entirely; the session-file section's "one file
    per tap of Done"; and acceptance-checklist item 3, "The public link cannot write", which
    is untestable once the proxy is gone. Outside that file: `README.md` and
    `docs/work/2026-08-29-edit-mode-handover.md` both mention the read-only proxy on 5174.

## Carried out of this brief — raised, not solved here

54. **The pi bot's sanctioned replacement has the same problem it was fixing** (finding M1).
    In this repo `npm run e2e:serve` runs `npm run preview`, which is `vite build && vite
    preview --host` — a long-lived server with `workerd` behind it, which is the same process
    pair the 657 MB measurement is about, started by the bot and registered nowhere. It also
    shares `.wrangler/state` with `vite dev`, so the "only one server per working directory"
    constraint means the bot running the browser suite can collide with the server Jamie
    started with `/dev`. **For Jamie to raise with the pi bot** — it is their half, but the
    fact is about this repo's scripts.
55. **What happens on the Pi when the process exits without `/devstop`?** (finding M4.) The
    registration in `/run/ai-turns/dev-server.json` is the Pi's, and nothing says whether it
    is cleaned up, whether anything restarts the server, or whether a later `/dev` — which is
    documented as idempotent — would hand back a URL for a dead process. **Needs the pi bot's
    answer before build.**
56. **Unfolded sessions compound, and this change makes more of them** (finding M8).
    `serveReplay` hands every unconsumed session to every page load and the overlay projects
    them all, so a stepper walk re-applied twice lands somewhere wrong. The guard against
    that is `/fold` renaming consumed sessions — which item 47 questions the existence of.
    Every `Save & Stop` leaves another session behind. Noted, not solved: "no session
    browser" is already out of scope.
57. **Housekeeping** (finding L4). This brief is untracked on `dev/edit-mode-on-stats`, a
    branch carrying unrelated in-flight work. It must be committed on its own branch before
    planning, or the memory this workflow depends on is one `git checkout` from gone.
58. The short-form line records "sections 3, 7, 8, 11" but §9 was also asked and answered
    (finding L1). Recorded here so the approval covers what the file actually contains.
59. `npm run dev` is not retired from `package.json` (finding L3) — the Pi runs it for Jamie
    behind `/dev`. Item 38's wording is right for Jamie and wrong as a blanket statement.

60. **Dave's acknowledgement waived.** Jamie, 2026-08-31: "no need for Dave input on this
    one." Recorded as `Override: Jamie 2026-08-31` on every joint section, not as an ack.
    Reasonable here — edit mode is a dev tool with one user, and none of this reaches the
    game.

61. **Item 39 answered.** Jamie, 2026-08-31: "Always visible." `Save & Stop` is on screen in
    play mode for as long as the server is running, regardless of whether anything is
    pending.

62. **Item 47 answered.** Jamie, 2026-08-31: "fold is future work so now it's just a request
    to you." So no message names `/fold`. The two that did are rewritten to say what actually
    happens — Jamie asks the bot in Telegram:
    - **Supersedes item 25**, `saved` (the pencil save, server still running):
      **"Saved. Ask the bot in Telegram to fold this into a pull request."**
    - **Supersedes item 27**, after the server stops:
      **"Saved and the server has stopped. Ask the bot in Telegram to fold this into a pull
      request, or tap /dev to start again."**
    Why: item 27 is the last thing that page will ever say. Naming a command that does
    nothing would leave Jamie tapping it and waiting.

---

**Brief closed 2026-08-31.** Every section settled by Jamie; Dave's acknowledgement waived by
Jamie as dev lead (item 60). da-brief run and all High and Medium findings answered above.
Next stage: `planning`, working from this file.
63. **New message, approved after the build.** Stopping the server with nothing unsaved had no
    wording — item 39 created that path but §8 never gave it words, and the other two both
    open with "Saved", which would have been a lie. Added as
    `stoppedNothingSaved`: **"The server has stopped. Tap /dev to start another."**
    Settled: Jamie 2026-09-02 ("yep happy") · Ack: Override: Jamie 2026-08-31.
