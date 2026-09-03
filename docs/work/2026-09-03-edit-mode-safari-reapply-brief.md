# Brief — edit mode re-applies the edits when Safari comes back

Date: 2026-09-03 · Branch: `dev/jamie-controlled-dev-server` · Reported by Jamie,
2026-09-02

**Short form proposed: sections 1, 3 and 11 only** — this is a defect in existing
behaviour, not a new feature. Sections 2, 4, 5, 6, 7, 8, 9 and 10 are unchanged by
any fix under discussion. Awaiting Jamie's approval.

---

## 1. What it is
Settled: pending · Ack: n/a (Jamie reported it; no joint content yet)

1. **The report, in Jamie's words.** Switching from Safari to another app and back
   "refreshes" — not a page refresh, it re-applies his changes. (given)

2. **Who it is for: Jamie, on a phone, mid-design-session.** Edit mode exists to
   let him design the stats panel on the device it will be used on. A jump every
   time he checks something in another app is friction on exactly the loop the
   tool was built to make smooth. (assumed — that is what edit mode is for)

3. **Why now: it is the third report of the same shape, and the first two fixes
   are the suspect.** 2026-08-24, "navigating away from and back to Safari resets
   everything" — answered by re-projecting on `visibilitychange`, `focus` and
   `pageshow`. 2026-08-26, comes back "to a semi previous state but with elements
   deselected" — answered by a `MutationObserver` that re-projects whenever the
   game rebuilds the page. Both are in `src/edit-mode/overlay.ts`. The edits now
   survive; what Jamie is seeing is the machinery that makes them survive, doing
   it visibly. (assumed — see item 5, which is not yet confirmed)

4. **What is NOT in doubt: the data.** The patch set is in `sessionStorage`, keyed
   to the branch, and `src/edit-mode/session-store.ts` is tested. Nothing is lost.
   This is about what the screen does, not about what survives. (given — the store
   has unit tests)

5. **A correction to one of the two starting facts.** The comment at
   `src/edit-mode/overlay.ts:536` blames `src/router.ts` for re-rendering the
   screen on `visibilitychange`. It does not. `checkStaleDay()` at
   `src/router.ts:143` returns immediately unless the local **date** has changed —
   so on an ordinary app switch the router does nothing at all. Whatever is
   rebuilding the DOM, it is not that. This matters because it is the reasoning
   the current re-projection was built on. (checked in the code, 2026-09-03)

6. **Two candidates remain, and one cheap test separates them.**
   - **(a) Vite reloads the page.** `vite.config.ts` sets no `server.hmr`
     override, so vite's default applies: backgrounding a tab drops the HMR
     websocket and a reconnect triggers a full page reload. Edit mode would then
     restore from `sessionStorage` and re-project — which looks exactly like "it
     re-applied my changes".
   - **(b) Edit mode re-projects when nothing was lost.** The three listeners at
     `overlay.ts:591-595` call `scheduleReproject()` unconditionally, and
     `project()` rewrites class attributes across the panel. If the DOM was never
     torn down, that write is redundant, and a mass class rewrite on Safari can
     show as a flash of the base styling before the edits land.
   - **The test: background Safari and come back with NO pending edits.** If the
     page still visibly jumps, it is (a) — nothing for edit mode to re-apply. If
     nothing happens, it is (b).
   (recommendation — Jamie runs the test; see item 7)

7. **Reproduction is Jamie's, and it blocks the diagnosis.** He asked for it to be
   reproduced on real iPhone Safari before any fix, and he is right that it will
   not show on desktop. I have no iPhone and Playwright's WebKit is not installed
   on this box — and would not reproduce a real Safari backgrounding anyway.
   (given — a hard constraint, not a preference)

## 2. Out of scope
Settled: pending

8. **`/dev` and the dev server's lifetime.** They belong to the pi bot. Nothing
   here changes how the server is started or stopped. If a fix needs something
   from that side — a vite config change is the obvious candidate — it is asked
   for, not done. (given — Jamie's instruction, 2026-09-02)
