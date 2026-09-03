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

---

## 1. What it is (continued)

9. **Item 6's test came back "I think no".** With no pending edits, backgrounding
   Safari and coming back does not visibly jump. So candidate (a) is out: vite is
   not reloading the page. **It is (b) — edit mode re-projects when nothing was
   lost.** The three listeners at `overlay.ts:591-595` fire on every return to the
   tab and call `scheduleReproject()` unconditionally, and `project()` rewrites
   class attributes across the panel whether or not the DOM has diverged from the
   patch set. (settled by Jamie's test, 2026-09-03 — "I think", so worth one
   re-check before the fix is built)

10. **A second defect, reported in the same message: the pencil stops closing.**
    "Stuck in edit mode on the same screen. Pencil not closing." Read against
    `overlay.ts:432-454`, there are exactly three ways the pencil refuses to
    leave, and two of them are deliberate:
    - **the save failed** — `exitDecision()` returns 'stay' by design (brief items
      11, 54, 74), because the edits only exist in the phone until a save
      succeeds. `panel.say(COPY.saveFailed)` should be on screen: "Could not save.
      Your changes are still here — check the dev server is running and tap the
      pencil again."
    - **the server has gone** — `stopped` is true, the pencil is dead on purpose,
      and the closing message stays up to say why.
    - **`busy` never cleared** — a `fetch` that neither resolves nor rejects. This
      one is a real bug, not a design, and it is the only one of the three with no
      message on screen.
    Which of the three it is, is decided by what is written on the panel.
    (recommendation — needs Jamie to say what the panel says)

11. **Are 9 and 10 one bug or two?** Treat them as two until shown otherwise. The
    re-projection is a repaint; the pencil refusing to close is a save or a hung
    request. Nothing yet connects them. (assumed — revisit if item 10 turns out to
    be the hung-`busy` case, because a re-projection storm could plausibly be
    involved)

---

## 1. What it is (continued) — the stuck pencil is found

12. **Jamie sees the "Could not save" line, so it is the failed-save branch.**
    Not the dead server, and not the hung `busy` flag. (given, 2026-09-03)

13. **Cause: an empty patch set is treated as a failed save, and "nothing to
    save" is exactly what giving up looks like.** Confirmed by running the real
    code, not by reading it:
    - `session-store.ts:44` defaults `savedSignature` to `''` when nothing has
      been saved yet.
    - `signature([], '')` returns `'||'`, never `''`.
    - So `isPending()` at `overlay.ts:206` is **true on a session with no
      edits** — a fresh one, or one where every edit has been undone.
    - The pencil then calls `save()`, which posts an empty `patches` array.
    - `edit-mode/session-routes.ts:60` answers **400 "no patches"**, correctly:
      it must not claim to have written a file it did not write.
    - `exitDecision(true, false)` returns `'stay'`, and the panel says "Could not
      save. Your changes are still here".

    There are no changes, the server is running fine, and the only way out is to
    make an edit so there is something to save. (verified 2026-09-03 by importing
    `pending.ts` and printing the values)

14. **This is the same bug as Jamie's feature request.** "Sometimes I mess about
    and want to give up" is undoing everything and tapping the pencil — which is
    precisely the path that wedges. So item 15 is not a nice-to-have bolted onto
    a bug fix; it is the missing half of it. (recommendation)

15. **Wanted: a way to abandon edits.** Jamie's words: "I need a way to abandon
    edits, sometimes I mess about and want to give up." Needs section 3 to say
    what it does to the screen, to the session file and to the undo stack.
    (question — see section 3)

16. **Not yet reproduced on a phone, and it does not need to be.** Items 13's
    facts come from running the code. A phone check is still worth having once
    the fix exists, but the diagnosis does not wait on it. (assumed)
