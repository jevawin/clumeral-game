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

---

## 3. How it works
Settled: pending · Ack: n/a (Jamie's tool; Dave never uses edit mode)

Jamie, 2026-09-03: "Lose the changes. Drop out of edit mode should happen when I
click the pencil. I think an abandon changes button with the save and close. I
thought this is what the reset button does but I think it's per element?"

17. **He is right about Reset: it is per element, and only the selected one.**
    `COPY.resetElement` is the label, `onResetElement` at `overlay.ts:323` returns
    early with no selection, and it restores that one element's original classes
    from the history. There is nothing today that clears the whole session.
    (checked in the code, 2026-09-03)

18. **The pencil always leaves when there is nothing to save.** This is item 13's
    bug, and it is fixed by making "no changes" mean "nothing to save" rather than
    "the save failed". The pencil keeps its existing behaviour in every other
    case, including staying put on a genuinely failed save with real changes,
    which is brief items 11, 54 and 74 and is not being reopened.
    (recommendation — this is a defect fix, not a design choice)

19. **A third control, beside Save & Stop: "Discard changes".** Jamie asked for it
    there and that is where it belongs — the two session-wide actions sit
    together, and Reset stays where it is as the per-element one.
    (recommendation)

20. **What it does, in order: put the page back, forget the session, drop to play
    mode.** All three, because "give up" means the screen is clean and the tool is
    out of the way. Concretely: project the original classes back over every
    edited element, clear the undo stack, clear `sessionStorage`, reset
    `savedSignature` so nothing reads as pending, and `setMode('play')`.
    (recommendation)

21. **It does NOT delete session files already written to disk.** Those are
    already banked, and a saved session is a thing Jamie asked the bot to fold —
    reaching back and deleting it is a different, more dangerous action. Discard
    is about what is still in the phone. (recommendation)

22. **It is disabled when there is nothing to discard**, on the same rule the
    pencil now uses, so it never asks a question about an empty session.
    (recommendation)

23. **Does it need a confirmation tap?**
    My rec: **yes** — the button becomes "Really discard?" for a few seconds and
    only the second tap does it. Why: it is irreversible and it throws away a
    whole session's work, it sits next to Save & Stop where a mis-tap is easy,
    and it is on a phone. The cost is one extra tap on a thing done rarely.
    (question — Jamie)

---

## 3. How it works (continued)

Jamie, 2026-09-03: "Yes confirm. Just 'discard'. And save just 'save'. So they're
smaller. Also only show when there's something to discard and save and only show
undo and reset when selected an element and something to undo or reset."

24. **Item 23 settled: the confirmation tap stays.** (Settled: Jamie 2026-09-03)

25. **Short labels: "Discard" and "Save".** One word each, so both fit small.
    Section 8 carries the final wording; this records the decision.
    (Settled: Jamie 2026-09-03)

26. **Every control earns its place before it appears.** Four rules, one per
    control, all of them "hide, not disable" — this supersedes item 22's
    "disabled":
    - **Discard** — only when there is something to discard.
    - **Save** — only when there is something to save. Same test as Discard, so
      in practice the pair appear and disappear together.
    - **Undo** — only when an element is selected AND there is a step to undo.
    - **Reset** — only when an element is selected AND that element has been
      changed from its original.
    (Settled: Jamie 2026-09-03)

27. **Hidden rather than greyed out, and the footer must not jump.** Hiding is
    what Jamie asked for and it keeps the sheet small, which is the point. The
    risk is a footer that changes height as controls come and go, moving the
    thing under his thumb. My rec: the footer keeps a fixed height and the
    buttons centre within it. (recommendation)

28. **"Save" is a NEW button, and "Save & Stop" keeps its full name.**
    There is no Save button today — it was removed on 2026-08-26 when the pencil
    took over saving (`copy.ts:19`). So "save just 'save'" reads as: bring back a
    plain Save that writes the session and leaves you in the editor, beside
    Discard. **Save & Stop is deliberately not renamed**: it also kills the dev
    server, and a button labelled "Save" that stops the server is the one
    mislabelling here that costs a whole session. (question — Jamie, item 29)

29. **Which did you mean?** (question — Jamie)

30. **Item 28 settled the other way: "Save & Stop" is renamed to "Save".**
    (Override: Jamie 2026-09-03 — my recommendation was a new Save button and the
    pill keeping its full name; the concern was raised and Jamie reaffirmed.)

31. **The consequence, recorded because the label no longer states it.** The
    button still stops the dev server. Tapping "Save" ends the session — the page
    goes read-only, the pencil goes dead, and starting again means `/dev` in
    Telegram. The existing closing message (`COPY.stopped`) is now the only thing
    that says so, which makes it load-bearing copy rather than a nicety. Section 8
    should check it reads as an explanation rather than as an aside.
    (assumed — follows from item 30)

32. **Short form, revised.** Sections 1, 3 and 11 was proposed before the work
    included four label and visibility changes. Hiding a control changes what a
    screen reader finds, and renaming the one that stops the server is copy that
    now carries a warning. **Revised proposal: sections 1, 3, 8, 9 and 11.**
    Sections 2, 4, 5, 6, 7 and 10 stay n/a — no new state, no new module, no
    layout change beyond the footer, nothing to measure. (question — Jamie)

33. **Short form approved: sections 1, 3, 8, 9 and 11.** Sections 2, 4, 5, 6, 7
    and 10 are n/a — no maths, no new state, no new module, no layout change
    beyond the footer, nothing new to measure.
    (Short form: sections 1, 3, 8, 9, 11 — approved by Jamie 2026-09-03)

34. **Save gets a confirmation tap too.** Jamie, 2026-09-03: "add a confirm tap
    to save. That solves your mislabel problem and is consistent with discard."
    So the second tap is where the consequence is stated, and item 31's worry is
    answered by copy rather than by the label. Both session controls now behave
    identically: tap, read what it is about to do, tap again.
    (Settled: Jamie 2026-09-03)

**Section 3 closed.** Items 17-34. Settled: Jamie 2026-09-03 · Ack: n/a — edit
mode is a dev-only tool that only Jamie uses; Dave has never had access to it.

---

## 8. Copy and wording
Settled: pending · Ack: n/a

The whole point of item 34 is that the confirm label carries the meaning, so
these are not decoration.

35. **Resting labels: "Save" and "Discard".** One word each (items 25, 30).
    (Settled: Jamie 2026-09-03)

36. **Confirm labels name the consequence, because the resting label no longer
    does.**
    - Save → **"Save and stop?"**
    - Discard → **"Lose all changes?"**
    My rec: these two. Why: "Save and stop?" is the sentence Jamie's rename
    removed from the button, put back at the only moment it matters. "Lose all
    changes?" says *all*, which is the difference from Reset — Jamie's own
    confusion in this thread was thinking Reset already did this.
    (recommendation)

37. **The confirm state reverts on its own after a few seconds.** Otherwise a
    button left mid-confirm in a pocket is armed when the phone comes back out.
    My rec: four seconds. (recommendation)

38. **`COPY.stopped` is unchanged and stays load-bearing.** "Saved and the server
    has stopped. Ask the bot in Telegram to fold this into a pull request, or tap
    /dev to start again." It already reads as an explanation with both next
    steps, which is what item 31 asked for. No edit needed.
    (assumed — checked against `copy.ts:67`)

39. **A discard needs its own closing line, and there is none today.** After
    discarding, the page is back to normal and edit mode is off, so silence would
    look like a crash.
    My rec: **"Changes discarded."** Nothing more — there is no next step to
    offer, the tool is still running, and the pencil is right there.
    (recommendation)

40. **`COPY.stopControl` is renamed, not replaced.** Its comment says "the
    control that saves and then stops the dev server", which stays true and is
    now the only place in the source that says so. (assumed)

41. **The "Changes discarded." line clears itself after four seconds too**, the
    same as the confirm labels. (Settled: Jamie 2026-09-03)

42. **It cannot use `say()`, or it will never be seen.** `say()` writes into
    `.status`, which lives inside the sheet, and `setMode` blanks it on every exit
    from edit mode (`panel.ts:497`). Discard drops to play mode (item 20), so the
    message would be wiped in the same tick it was written. It has to use the
    `.notice` surface instead — the one built to outlive the editor, which Save &
    Stop already uses. (assumed — checked against `panel.ts:495-500`)

**Section 8 closed.** Items 35-42. Settled: Jamie 2026-09-03 · Ack: n/a.

---

## 9. Accessibility
Settled: pending — **Jamie's sign-off, blocking**

43. **Tap targets do not shrink.** "Smaller" (item 25) is about the label, not the
    button: `panel.ts:170-171` already floors every control at 44px square and
    that stays. Shorter words, same target. (assumed — checked in the code)

44. **Hiding beats disabling, and that is the accessible choice as well as the
    tidy one.** A disabled control is still announced and still lands in the tab
    order, offering something that cannot be done. Removing it says the same
    thing by saying nothing. (assumed)

45. **Focus must not fall off the page when a control hides itself.** Undo
    disappears the moment there is nothing to undo — and that can happen on the
    tap that used it. If focus is on it when it goes, focus resets to `<body>`
    and a keyboard user is thrown to the top.
    My rec: when the focused control is about to be hidden, move focus to the
    sheet itself first. (recommendation)

46. **The confirm state must be announced, not just drawn.** The button's name
    changes from "Save" to "Save and stop?", and a screen reader user who has
    already tapped needs to hear what the second tap will do — that is the entire
    safety mechanism (item 34).
    My rec: give the two session controls `aria-live="polite"` on the button
    itself, so the name change is spoken when it happens.
    (recommendation)

47. **"Changes discarded." must be announced.** The `.notice` surface it lands on
    (item 42) needs `role="status"` if it does not have one.
    (recommendation — to be checked during the build)

48. **The four-second timers are a knowing WCAG 2.2.1 exception.** Both the
    confirm revert (item 37) and the discard message (item 41) disappear on a
    timer with no way to extend them. WCAG 2.1 AA's Timing Adjustable says timed
    content should be adjustable; this is not. The defence is that edit mode is a
    dev-only tool that never reaches production, used by one person on his own
    phone, and both timers make things *safer* — an armed confirm and a stale
    message are the risks they remove.
    My rec: accept it, and write it down as accepted rather than leave it
    unstated. Jamie owns accessibility, so it is his to accept.
    (question — Jamie, blocking)

49. **Item 48 accepted, and the screen-reader items with it.** Jamie, 2026-09-03:
    "Wcag doesn't matter it's only me no screen reader." Edit mode is dev-only,
    never reaches production, and has exactly one user who has said he does not
    use a screen reader. Items 46 and 47 — the announcements — are dropped on
    that basis. **Item 45 (focus) stays**: it costs nothing and it bites him with
    a keyboard on desktop, screen reader or not.
    (Settled: Jamie 2026-09-03, as the owner of accessibility)

50. **Correction to item 43: the controls are 38px, not 44px.** `TAP_TARGET` at
    `panel.ts:25` is `'38px'`. The 44px I quoted is a different element. So the
    floor is already below the WCAG minimum and has been since the tool was
    built — consistent with item 49, and worth stating rather than leaving as a
    wrong fact in the record. (corrected 2026-09-03)

51. **Item 43 was also wrong in spirit.** Jamie: "Buttons should reduce in width
    because less text — that was the whole point, they block the screen." Width
    was the goal, and saying "same target, shorter words" missed it.
    (corrected 2026-09-03)

**Section 9 closed.** Items 43-51. Settled: Jamie 2026-09-03 (accessibility is
his, and he has signed it) · Ack: n/a.

---

## 7. How it looks — REOPENED, was marked n/a
Settled: pending · Ack: n/a

Section 7 was n/a under item 32 because nothing was moving but the footer. Item
52 changes that, so it reopens. Short form becomes **1, 3, 7, 8, 9, 11**.

52. **Jamie's design, 2026-09-03.** "I'm even considering icons that become icon
    with words on tap. Yeah let's do that, same size as pencil. Icon at first.
    Expand to show confirm message on tap. Floppy for save. Trash for discard.
    Maybe red/green bg (brand red/green) for extra obviousness?" (given)

53. **So the confirm tap and the expansion are the same gesture.** At rest: a
    38px icon, the pencil's size. Tapped: it grows sideways to show the icon plus
    the confirm question from item 36. Tapped again: it acts. Untouched for four
    seconds: it shrinks back (item 37). One mechanism doing two jobs, which is
    why it is worth doing. (recommendation)

54. **The icons: a floppy disk for Save, a bin for Discard.** Jamie's choice, and
    both are already the obvious symbol for what they do. They need adding to the
    sprite sheet if they are not there. (Settled: Jamie 2026-09-03)

55. **Red and green: yes, but only once expanded.** The tokens exist —
    `--color-success` (lime) and `--color-error` (cherry), `tailwind.css:136-137`
    — so this costs nothing and stays on-theme in both light and dark.
    My rec: **at rest the two icons are neutral, the same treatment as the
    pencil. Colour arrives with the expansion.** Why: at rest these sit on top of
    the design Jamie is trying to look at, and two saturated blobs compete with
    it — the whole complaint was that the controls block the screen. Colour at
    the moment of confirming is where it does the work, and it is also the moment
    the words appear, so meaning never rests on colour alone.
    (recommendation)

56. **Where they live: beside the pencil, not in the sheet.** Save & Stop is
    already a pill outside the sheet (`panel.ts:79`) for exactly this reason —
    reachable without opening the panel. Discard joins it, and the three controls
    stack. Undo and Reset stay in the sheet footer, because they are per-element
    and you need the panel open to have selected anything.
    (question — Jamie, item 57)

57. **Or do you want all four together?** (question — Jamie)
