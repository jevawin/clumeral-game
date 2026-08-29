# Edit mode — handover, 2026-08-29

Written so a fresh session can pick this up with no memory of the conversation.
Everything agreed in chat that still matters is here or in the files it names.

- Brief: [`2026-08-18-edit-mode-roundtrip-brief.md`](2026-08-18-edit-mode-roundtrip-brief.md) — 116 numbered items, closed
- Plan: [`2026-08-19-edit-mode-roundtrip-plan.md`](2026-08-19-edit-mode-roundtrip-plan.md) — revision 5, approved
- Doc: [`../EDIT-MODE.md`](../EDIT-MODE.md) — how to run it, and Jamie's three manual checks
- Round 1 feedback: [`2026-08-24-edit-mode-round-1-feedback.md`](2026-08-24-edit-mode-round-1-feedback.md)
- **Open ideas: [`2026-08-29-edit-mode-open-ideas.md`](2026-08-29-edit-mode-open-ideas.md)**

Branch `dev/edit-mode-roundtrip`. Nothing merged. No pull request opened yet.

---

## State

Units 1-4 are built. 271 edit-mode tests pass, plus the rest of the suite.

Five rounds of Jamie's use on an iPhone 16 Pro have reshaped the panel since the
plan was written; the plan is still accurate about architecture and safety, and
out of date about layout. Where they differ, the code and this file win.

**The safety gate still holds and must keep holding:** edit mode is absent from
production and preprod, asserted against built output by
`tests/edit-mode-safety.spec.ts`. Never make the game import anything under
`src/edit-mode/`.

---

## Running it

```
npm run dev                       # dev server on 5173, read-only proxy on 5174
```

The dev server binds on all interfaces. Jamie reaches it over Tailscale at
`http://100.98.218.120:<port>`. During this work it has been run on 5199 to
avoid clashing with anything else, which puts the read-only view on 5200.

**Start it detached and check the log — never in the foreground:**

```
nohup npx vite dev --port 5199 > /tmp/vite-5199.log 2>&1 &
until curl -s -o /dev/null http://localhost:5199/; do sleep 2; done
```

**Stop it by port, never by matching a command line:** `fuser -k 5199/tcp`.
`pkill -f` matches this process's own argv and will kill the session.

**One dev server at a time in this directory.** Two share Miniflare's SQLite
state and the second dies with "database is locked".

---

## Playwright — now installed, and how to use it

Jamie installed it on 2026-08-28. **Chromium only** —
`~/.cache/ms-playwright/` has `chromium-1223` and the headless shell, nothing
else. A bare `npm run test:e2e` runs all six projects and the three
webkit/firefox ones fail with a missing executable. That is expected and is not
a bug to fix.

**The rules, which have not changed:**

- It is **on request only**. Run it when Jamie asks in that turn, and say so
  before starting. It is not part of the normal loop — CI runs the full matrix
  on every pull request and that stays the default.
- **Always `--workers=1`.** Measured 2026-08-29: at the default 2 workers the
  chromium project alone drove load average to 16 and 43 of the first 49 tests
  died on `page.goto: Test timeout`. The box was saturated; the app was fine.
- **Only** `--project=chromium-desktop` or `--project=mobile-chromium`.
- A full run outlives a 10-minute turn. Run it detached to a log and read the
  log afterwards.

```
npx playwright test --project=mobile-chromium --workers=1 e2e/specs/<one>.spec.ts
```

### What Playwright can and cannot settle here

Worth being honest about, because it was oversold in conversation.

**It would have caught**, in a real browser, quickly:
- the search input being detached on redraw, which blurred it and shut the
  keyboard
- the `hidden` row that stayed visible because `display: flex` beat it
- selection firing on pointer-down so scrolling changed the selection
- the picker losing the selected element before the class was applied

**It would not have caught**, because Chromium on Linux is not iOS Safari:
- the on-screen keyboard covering a bottom-fixed panel (`visualViewport`)
- Safari discarding a backgrounded tab and reloading
- double-tap zoom
- anything about how the 5 MB stylesheet feels on a phone

So: real value for the interaction logic, none for the iOS-specific half.
**Jamie on the phone is still the only test for that half.**

### The e2e suite as it stands

`playwright.config.ts` builds and serves the **production** build
(`npm run e2e:serve`). Edit mode is deliberately absent from that build, so the
existing suite can prove edit mode is GONE and can never prove it WORKS.

**To test edit mode a new project is needed**, pointed at the dev server. Brief
item 88 proposed exactly that and Jamie cut it on 2026-08-18 ("Cut. I will be
the tester"). With Playwright now installed that decision is worth revisiting —
it is a `webServer` entry running `vite dev` and a `testMatch` for a new
`e2e/edit-mode/` directory. **Ask Jamie before adding it**; it changes what CI
runs.

---

## What to test first, if a browser test is wanted

In rough order of how much grief each has caused:

1. **The class picker round trip.** Open it, type, tap a class, confirm the
   class lands on the still-selected element and the picker closes.
2. **Selection survives a scroll.** Drag the page; the selection must not move.
3. **Back undoes one step and the screen does not reload.** Three changes,
   three backs. This is Jamie's acceptance check 1 and it passes by hand.
4. **Play mode comes back with the keyboard alive.** Acceptance check 2, and
   the one that fails silently in the shipped game.
5. **The read-only port refuses a POST.** Acceptance check 3. Already covered
   by `tests/edit-mode-readonly.spec.ts` against real sockets.

---

## Open bugs

**Safari discards the tab and reloads when you leave the app and come back.**
The reload itself is iOS and cannot be prevented. Edits and selection are meant
to survive it: the patch set is in `sessionStorage`, and a `MutationObserver`
re-applies once the game has rendered. Jamie last reported "still refreshes" on
2026-08-27, **without saying whether the edits survived**. That is the open
question — a reload is expected; losing the work is not.

**The picker's family names are raw CSS properties** ("font-size, line-height").
Correct and unambiguous, possibly unfriendly on a phone. Jamie has not
complained; flagged in case.

---

## Two traps this codebase has sprung twice each

**Backticks inside `PANEL_CSS`.** The whole stylesheet in `src/edit-mode/panel.ts`
is one template literal. A backtick in a CSS *comment* ends the string and the
file stops parsing. This broke the build twice. **Compile before committing:**

```
npx esbuild src/edit-mode/panel.ts --outfile=/dev/null
```

**`hidden` does not beat `display: flex`.** The attribute only sets
`display: none` as a default. `panel.ts` now forces `[hidden] { display: none
!important }`; do not remove it.

---

## Things only Jamie can do

- **The Cloudflare tunnel for Dave**, pointed at the read-only port (one above
  the dev server). Not set up yet.
- **The three manual acceptance checks** in `docs/EDIT-MODE.md`. Check 1 passes.
  Checks 2 and 3 have not been run on a device.
- **Approving a pull request**, and merging it.
