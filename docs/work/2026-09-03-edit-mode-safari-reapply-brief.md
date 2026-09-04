# Brief — edit mode re-applies the edits when Safari comes back

Date: 2026-09-03 · Branch: `dev/jamie-controlled-dev-server` · Reported by Jamie,
2026-09-02

**Short form proposed: sections 1, 3 and 11 only** — this is a defect in existing
behaviour, not a new feature. Sections 2, 4, 5, 6, 7, 8, 9 and 10 are unchanged by
any fix under discussion. Awaiting Jamie's approval.

---

## 1. What it is
Settled: Jamie 2026-09-03, EXCEPT item 9 which is reopened by finding H1 · Ack: n/a

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
Settled: Jamie 2026-09-03 · Ack: n/a

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
Settled: Jamie 2026-09-03 · Ack: n/a

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
Settled: Jamie 2026-09-03 — his own sign-off, as the owner · Ack: n/a

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
Settled: Jamie 2026-09-03 · Ack: n/a

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

58. **Settled: beside the pencil, in the order Discard, Save, Edit.** The pencil
    stays rightmost, where it has always been and where his thumb already goes.
    (Settled: Jamie 2026-09-03)

59. **So an expanding button grows LEFTWARDS.** The row is anchored on the right,
    and the pencil must not move when Discard or Save expands — a control that
    shifts under a thumb mid-tap is how a mis-tap becomes a lost session. The
    same applies to the two of them: when Discard expands, Save must not slide.
    My rec: anchor the row right, and let an expanding button overlay what is to
    its left rather than push it. (recommendation)

60. **Normally only the pencil is on screen.** Discard and Save appear only when
    there is something to save (item 26), so the resting state of a fresh session
    is the single pencil it is today. The row grows to three only once he has
    made a change. (assumed — follows from items 26 and 58)

**Section 7 closed.** Items 52-60. Settled: Jamie 2026-09-03 · Ack: n/a.

---

## 11. Done and the test plan
Settled: Jamie 2026-09-03 · Ack: n/a

61. **The logic goes in `pending.ts` as pure functions, because that is what can
    be tested.** `overlay.ts` ends in a bare call with no export and cannot be
    imported by a test — a known gap, stated on PR #314. Every decision in this
    work is a function of state, so every one of them can live where it is
    testable:
    - `exitDecision` — extended so "nothing pending" leaves, which is item 13's
      bug.
    - a function for item 26's four visibility rules.
    - a function for the confirm state machine: at rest, armed, acted, and the
      four-second revert.
    (recommendation)

62. **The bug that started this gets a test that fails before the fix.** A fresh
    session, no edits, tap the pencil: it must leave. Today that returns 'stay'
    and Jamie is stuck. (recommendation)

63. **The re-projection fix (item 9) needs a test of its own.** The rule is that
    coming back to the tab must not re-apply anything when the page was never
    torn down. My rec: a function that answers "has the DOM diverged from the
    patch set?", tested directly, with the listeners calling it before they
    project. (recommendation)

64. **`edit-mode-safety.spec.ts` gets the new controls.** It already asserts edit
    mode is absent from both deployed artefacts. Two new icons and a new route-
    free control are exactly the kind of thing that leaks. (recommendation)

65. **QA level: light, and no local Playwright.** All of the above is unit-
    testable. CI runs the full browser matrix on the pull request. A local
    Playwright run is Jamie's call in the moment and is not a step in this plan.
    (recommendation)

66. **The acceptance test is Jamie, on his phone.** Four things, and they are the
    four this thread produced:
    1. Make no edits, tap the pencil. It leaves.
    2. Make edits, undo them all, tap the pencil. It leaves.
    3. Make edits, tap Discard, confirm. Page back to normal, out of edit mode,
       "Changes discarded." for four seconds.
    4. Make edits, switch to another app, come back. Nothing visibly re-applies.
    (recommendation)

---

## 7. How it looks — item 59 re-settled

67. **Item 59's overlay is rejected. They push, they do not overlap.** Jamie,
    2026-09-03: "They can expand left and push the button over, don't overlap
    that's gross." His sketch:

    ```
    [bin] [floppy  Save and stop] [pencil]
    ```

    **The rule: a button's RIGHT edge is anchored. It grows leftwards from there,
    and pushes its left-hand neighbours further left.** So the pressed button
    still covers the spot it was tapped on, and everything to its right — the
    pencil above all — never moves at all.

    It falls out nicely: Discard is leftmost, so expanding it moves nothing.
    Expanding Save moves only Discard. The pencil is fixed in both cases. No
    control ever moves out from under a thumb, which is what item 59 was trying
    to protect, without the overlap.
    (Settled: Jamie 2026-09-03 — supersedes item 59)

68. **The pill's icon sits at its left**, per the sketch, so the icon travels
    leftwards as the button grows while the right edge stays put.
    (assumed — reading the sketch)

69. **A wide expanded pill must not run off the left of a narrow screen.** "Save
    and stop?" beside an icon is roughly 160px, plus Discard's 38px and the
    pencil's 38px and the gaps — about 250px, which fits a 320px screen. Worth
    stating so the build checks it rather than discovers it.
    (assumed — arithmetic, to be confirmed on the phone by item 66)

**Section 11 closed.** Items 61-66. Settled: Jamie 2026-09-03 · Ack: n/a.

---

## Brief closed — 2026-09-03

**Short form: sections 1, 3, 7, 8, 9 and 11 — approved by Jamie 2026-09-03.**
Sections 2 (beyond item 8), 4, 5, 6 and 10 are n/a: no maths, no new storage, no
new module, nothing new to measure.

All five sections settled by Jamie. `Ack: n/a` throughout, with a reason rather
than as a shrug: edit mode is a dev-only tool that never reaches production and
Dave has never had access to it, so there is no joint content to ack.

**Two defects and one feature, in one brief because item 14 showed they are the
same code:**

1. Coming back to Safari re-applies the edits when nothing was lost (items 9, 63).
2. The pencil wedges when there is nothing to save (items 13, 62).
3. Discard, and a control row that earns its place (items 19-30, 52-60, 67-69).

**The one thing that is NOT reopened:** staying put on a genuinely failed save
with real changes. That is brief items 11, 54 and 74 of the round-trip brief and
it protects work. Only the empty case changes.

---

# da-brief review, 2026-09-03 — four highs, eight mediums, four lows

Every finding is answered. Two need Jamie and are marked so; the rest are
corrected here.

## H1 — the app-switch diagnosis is withdrawn. Item 9 is REOPENED.

70. **My mechanism for candidate (b) cannot produce the symptom.** `project()`
    does `el.className = classes.join(' ')` (`project.ts:77`). That is one atomic
    attribute write — there is no paint between the old value and the new — so
    "a flash of the base styling before the edits land" is impossible when the
    DOM has not diverged. Item 6(b) was wrong, and item 9 rested on it.
    (correction — the finding is right and my reasoning was not)

71. **A third cause, and the repo already names it.**
    `session-store.ts:3` says "Safari discards backgrounded tabs". A discarded
    tab reloads on return, edit mode restores from `sessionStorage`, and the
    changes visibly re-apply — which is Jamie's report, word for word. It was
    never in item 6's list of two.

72. **And a fourth.** `src/app.ts:1183-1193` registers `/sw.js`, calls
    `registration.update()` on **both** `focus` and `visibilitychange`, and
    reloads the page on `SW_UPDATED`. `public/sw.js` means vite serves it in dev.
    Conditional on the Tailscale URL being a secure context, so it needs ruling
    out rather than assuming.

73. **Item 6's test could not have told them apart**, and item 9 read a hedged
    "I think no" as settling it. The test asks Jamie to spot a reload by eye on a
    page with no edits — the one state where a reload looks like nothing.

74. **Replace it with something objective.** A counter in `sessionStorage`,
    incremented once per `start()` and shown in the panel. Come back to the tab:
    if the number went up, the page reloaded, and the cause is (a), (c) or (d).
    If it did not, nothing reloaded and the re-projection is the only suspect
    left. One number, no guessing. (recommendation — needs Jamie to run it)

75. **Item 63's fix does nothing under (c) or (d), and item 66's fourth
    acceptance test is unfalsifiable under them.** After a real reload the DOM
    genuinely has diverged, so "only project when it has diverged" projects — and
    re-applying is then the *correct* behaviour. Both are held until item 74
    answers. (correction)

## H2 — item 61 names the wrong function

76. **`exitDecision` is already right.** `pending.ts:41-44` returns 'leave' when
    nothing is pending. The defect is `isPending()` at `overlay.ts:206`, which
    compares `signature([], '')` = `'||'` against a `savedSignature` that
    `session-store.ts:44` initialises to `''`. A test written against
    `exitDecision` passes before and after the fix.
    **The fix: the empty-session sentinel.** Item 62's test targets `isPending()`
    — or whatever pure function replaces it — and must be red today.
    (correction — supersedes item 61's first bullet and item 62's target)

## H3 — hiding Save takes away the only way to stop the server (needs Jamie)

77. **Item 60's premise is false.** `stopPillState('play', false, false)` returns
    `visible: true`, and `docs/EDIT-MODE.md:56` says the pill sits beside the
    pencil whenever you are out of the editor. Today's resting state is **pill and
    pencil**, not the pencil alone. (correction)

78. **So item 26 as written creates the orphan the feature exists to prevent.**
    Start `/dev`, make no edit, change your mind — under item 26 there is nothing
    on screen that stops the server. `edit-mode/plugin.ts:45` calls that "the
    657 MB orphan this whole feature exists to prevent". Falling back to
    `/devstop` in Telegram is exactly the friction `/dev` removed.

79. **And the same empty-signature bug already wedges Save & Stop, unreported.**
    `runStop()` at `overlay.ts:475-481` sets `hadSomethingToSave = isPending()` —
    true on a fresh session — then `save()` 400s and it returns without stopping.
    So today, on a fresh session, **Save & Stop does not stop the server either**.
    `COPY.stoppedNothingSaved` is unreachable. Item 76's fix repairs this too,
    which is worth saying: one sentinel, three symptoms.

80. **Which way should Save behave?** (question — Jamie)
    - **(i) Save is always visible while the server is running**, because it is
      also the stop control, and only Discard follows the "something to discard"
      rule. My rec. Why: the button has two jobs and the second one is always
      available. It costs one icon on screen.
    - **(ii) Item 26 as written**, and stopping with nothing to save is `/devstop`
      in Telegram only.

## H4 — section 5 is NOT n/a. REOPENED.

81. **Discard's order of operations is load-bearing, and item 20's order is
    wrong.** `setMode()` calls `persist()` (`overlay.ts:361`), which writes the
    record straight back — so `store.clear()` then `setMode('play')` leaves the
    session on disk. In-memory state has to be reset first. `runStop` only
    escapes this through the `stopped` guard at `overlay.ts:186`. (correction)

82. **The sentinel is `signature([], freeCss)`, never `''`.** Item 20 said "reset
    `savedSignature` so nothing reads as pending"; `''` is the value that CAUSED
    item 13's bug. `overlay.ts:504` already does it correctly.
    (correction — this one would have shipped the bug back)

83. **Item 20 was silent on three things Discard must also clear:** `freeCss`
    (it is part of the signature and posts as a `css` patch — it IS a change),
    `switchedOff` (`overlay.ts:107`), and `selected` / `selectedPath`.
    My rec: all three reset, because "back to normal" means all of it.
    (recommendation)

84. **Item 21 is true but incomplete, and the gap is visible to Jamie.** Saved
    sessions stay on disk — but `serveReplay` hands every unconsumed session to
    every page load, and `overlay.ts:57-60` projects it before anything else. So
    after a discard the page is clean *until the next refresh*, when the banked
    sessions come back. That is not a bug, it is what the replay route is for,
    but it must be stated or it reads as the discard failing. (correction)

## Mediums

85. **M1 — the pencil is 56px, not 38px.** `panel.ts:66-67`. `TAP_TARGET` is the
    sheet-button floor, a different thing. So "same size as pencil" (item 52) is
    56px. Item 69's arithmetic: 160 + 56 + 56 + 8 + 8 + 16 ≈ **304px** on a 320px
    screen — it fits, with 16px to spare, which is tight enough to check on the
    phone. (correction — supersedes items 50, 53 and 69's numbers)

86. **M1, second half — the closing block's "no layout change beyond the footer"
    is false.** `.stop-btn` is `position: fixed` with a hard-coded
    `right: calc(16px + 56px + 8px)`. Item 67's reflowing row needs a
    right-anchored flex container replacing both fixed positions.
    (correction)

87. **M2 — item 54 named the wrong file.** Edit-mode icons are inlined Lucide
    paths in `src/edit-mode/icons.ts`, and `save` (floppy) is already there at
    line 20. `public/sprites.svg` is the GAME's sheet and a production artefact —
    putting edit-mode icons in it is precisely the leak
    `tests/edit-mode-safety.spec.ts` exists to catch. **Only a bin icon is
    needed.** (correction)

88. **M3 — item 63's "has the DOM diverged?" function exists.**
    `detectOverwrites(expected, readActual(doc, keys))` in `runtime-classes.ts`,
    already called at `overlay.ts:355`. Reuse it. (correction)

89. **M4 — Save & Stop is deliberately hidden in edit mode** (`panel.ts:80-82`,
    "two ways to do one thing on a phone is one too many", 2026-08-26). Item 26
    and item 67's sketch both assume the row shows whenever there are changes,
    including in edit mode. My rec: **the sketch wins and the 2026-08-26 rule is
    reversed** — with Discard added, the row is now the one place both session
    actions live, and hiding half of it in edit mode is the confusing option.
    (recommendation)

90. **M5 — item 41's four-second timer must cancel on any later message.**
    `panel.notify()` only sets `textContent`; nothing clears it. A blind timer
    would wipe whatever is written next — including `COPY.stopped`, which the
    brief itself calls the last thing the page ever says. (correction)

91. **M6 — the red and green must NOT come from `--color-success` /
    `--color-error`.** Two reasons. `panel.ts:8-10` says the sealed root cannot
    use the project's tokens. And those two derive from `--accent-l` and
    `--chroma-*`, which flip in dark mode — while the panel is hand-written and
    permanently light. So they would take a dark-mode value on a white panel, and
    the tool's own chrome would start tracking the theme Jamie is editing, which
    is the exact thing sealing the root prevents.
    My rec: **two fixed hex pairs in `panel.ts`, beside the panel's other
    hand-written colours**, chosen to read on its permanently-light surface.
    (correction — supersedes item 55's mechanism; item 55's *design* decision,
    colour only once expanded, stands)

92. **M7 — the six stale `Settled: pending` ledgers are corrected** in place,
    above. (correction)

93. **M8 — section 6 is NOT n/a either. REOPENED, and here it is.** Six modules:
    `pending.ts` (the sentinel, the visibility rules, the confirm state machine),
    `overlay.ts` (discard, `isPending`, wiring), `panel.ts` (the control row, the
    notice timer, per-control visibility), `controls.ts` (the footer rules),
    `copy.ts` (four strings), `icons.ts` (the bin). No file outside
    `src/edit-mode/` is touched. (correction)

94. **M8, second half — `docs/EDIT-MODE.md` is wrong after this and nothing said
    so.** It names "Save & Stop" at lines 37, 56, 87, 125, 148-150, 157 and 176,
    and describes the pencil's failed-save rule at line 53. Items 18, 19, 26 and
    30 falsify all of it. It joins section 11's list. (correction)

## Lows

95. **L1 — `panel.sheet` needs `tabindex="-1"`** or item 45's `.focus()` does
    nothing. It is the one accessibility item Jamie kept, so it should work.
    (correction)

96. **L2 — the three new strings go in `OVERLAY_COPY`**, which is what
    `edit-mode-safety.spec.ts` actually guards — not icons, as item 64 said.
    "Save and stop?", "Lose all changes?" and "Changes discarded." **And a
    caution on item 30:** `COPY.stopControl` is already in that list and becomes
    the bare word "Save", which is a weak marker. It passes today (capital "Save"
    appears zero times in `dist/`), but the spec's own comment warns this is how
    a one-word string quietly stops guarding anything. My rec: keep a longer
    string in the list — the confirm label "Save and stop?" — rather than the
    resting one. (correction)

97. **L3 — `COPY.exitEditMode` is "Save and exit edit mode"**, the pencil's
    aria-label. After item 18 the pencil sometimes just exits. My rec: "Leave
    edit mode", which is true in both cases. (recommendation)

98. **L4 — structure.** The closing summary's 1/2/3 sit at column 0, where a
    number means "brief item", and section 11's items print before section 7's.
    Both are tidied when this review is folded in. (correction)

---

# The app-switch cause, settled by measurement — 2026-09-03

99. **The counter went up, but only after MINUTES away. Seconds never triggered
    it.** Jamie, 2026-09-03. (given — the measurement item 74 asked for)

100. **That is Safari discarding the tab. Candidate (c), and nothing else fits.**
     - **(a) vite HMR reconnect** — the websocket drops the moment the tab
       backgrounds and reconnects the moment it returns. It would fire on a
       seconds-long switch. It does not. **Ruled out.**
     - **(b) an unnecessary re-projection** — the counter would not move at all,
       because nothing reloads. It moves. **Ruled out**, which also closes item
       70: the mechanism was unsound AND the cause was wrong.
     - **(d) the service worker** — `update()` runs on every `focus` and
       `visibilitychange`, so it too would fire on a seconds-long switch. **Ruled
       out.**
     - **(c) Safari discarding a backgrounded tab** — evicted under memory
       pressure after minutes, not seconds; the page reloads on return. This is
       the only candidate whose timing matches, and `session-store.ts:3` already
       warned about it. **This is it.**
     (settled by measurement, 2026-09-03)

101. **So nothing here is broken, and the fix is not to stop the reload.** We
     cannot stop Safari evicting a tab and should not try. Edit mode restoring
     the patch set afterwards is the safety net working exactly as designed —
     the edits are not lost, and that is the whole point of `sessionStorage`.
     **What Jamie sees is the restore arriving late.** (correction — this
     replaces items 9 and 63 entirely)

102. **Why it is visible: `start()` awaits two fetches before it projects.**
     `overlay.ts:56-62` awaits the replay route and then the 23,000-class
     catalogue. The game renders inside that window, un-edited. Only when both
     land does anything project — and that is the snap Jamie is describing.
     (checked in the code)

103. **The fix: project from `sessionStorage` synchronously, before any await.**
     The patch set is already in the phone and `sessionStorage` is a synchronous
     read, so the edits can go on at the same moment the game first renders
     rather than two fetches later. The observer that catches the game's render
     moves up with it. The fetches keep doing their jobs; they just stop being on
     the critical path for something that does not need them.
     My rec: this. Why: it removes the visible gap without fighting Safari, and
     it makes the restore behave the same on a discard as on an ordinary reload.
     (recommendation — supersedes item 63)

104. **Item 66's fourth acceptance test is rewritten.** "Nothing visibly
     re-applies" was unfalsifiable once we knew a real reload happens. It
     becomes: *make edits, leave Safari for five minutes, come back — the page
     comes back already edited, with no un-edited flash.* The counter proves the
     reload happened; the eye proves the restore was invisible.
     (correction — supersedes item 66.4)

105. **The counter stays until the fix is verified, then goes.** Item 74 said
     delete once the cause is settled. It is settled, but it is also the only
     thing that proves a reload happened at all, so it earns its keep for one
     more round. Deleting it is a task in the plan, not a loose end.
     (correction — supersedes item 74's disposal)

## H3 settled: Discard stops the server too

106. **Jamie, 2026-09-03: "discard stops the server as well".** So Discard is
     always on screen and does three things: throw the edits away, put the page
     back, and stop the dev server. (Settled: Jamie 2026-09-03 — the trap in item
     107 was put to him explicitly and he confirmed)

107. **The cost, recorded because it is real.** There is now no way to throw away
     a mess and carry on designing in the same session. Give up means give up:
     `/dev` again to come back. My recommendation was to leave stopping to Save;
     Jamie chose otherwise and that is his call as the only user of the tool.
     (recorded — not reopened)

108. **So both session controls stop the server, and item 36's confirm labels
     must both say so.**
     - Save → **"Save and stop?"** (unchanged)
     - Discard → **"Lose all and stop?"** (was "Lose all changes?")
     My rec: this wording. Why: after item 106 a Discard that only says "lose all
     changes" understates it by the entire dev server, which is the same
     mislabelling item 28 warned about for Save. (recommendation — supersedes
     item 36's Discard label)

109. **And item 39's closing line changes with it.** "Changes discarded." is no
     longer the whole truth, and it is now the last thing the page will ever say,
     which puts it in `COPY.stopped`'s class rather than as a passing note.
     My rec: **"Changes discarded and the server has stopped. Tap /dev in
     Telegram to start again."** Why: it mirrors `COPY.stopped`, and item 41's
     four-second timer is dropped for it — a terminal message must not vanish.
     (recommendation — supersedes items 39 and 41)

110. **Item 26's visibility rules, final.** Discard: **always visible** (item
     106). Save: only when there is something to save. Undo and Reset: only with
     an element selected and something to do. (correction — supersedes item 26's
     first two bullets)

111. **Items 103, 108 and 109 settled.** The synchronous restore, "Lose all and
     stop?", and the closing message that does not vanish.
     (Settled: Jamie 2026-09-03)

---

# Brief closed — second time, 2026-09-03

Items 1-111. Short form: sections 1, 3, 7, 8, 9 and 11, plus 5 and 6 which the
review reopened (items 81-84, 93). Sections 2 (beyond item 8), 4 and 10 are n/a.
Every section settled by Jamie; `Ack: n/a` throughout, because edit mode is a
dev-only tool that only Jamie has ever used.

**What the first close got wrong, and the review caught:** the app-switch cause.
It was settled on a hedged by-eye test, on a mechanism that could not have
produced the symptom. Measurement replaced it — the reload happens, it takes
minutes not seconds, and that is Safari discarding the tab. The fix moved from
"stop re-applying" to "restore sooner", which is close to the opposite.

**Three defects and one feature, all in `src/edit-mode/`:**

- The restore arrives two fetches late after Safari discards the tab (100-105).
- The empty-session sentinel wedges the pencil AND Save & Stop (13, 76, 79).
- `panel.sheet` cannot take focus, so item 45 could never have worked (95).
- Discard, and a control row that earns its place (19-30, 52-60, 67-69, 106-110).

**Not reopened:** staying put on a genuinely failed save with real changes.

---

# Second da-brief review, 2026-09-03 — item 100 is withdrawn

## H-1 — vite IS ruled back in, and it fits "minutes, not seconds" exactly

112. **Item 100 crossed vite off for having the wrong timing. That was wrong, and
     vite's own client source says so.** Verified here, not taken on trust —
     `node_modules/vite/dist/client/client.mjs`:
     - **:967-975** on `vite:ws:disconnect` — "server connection lost. Polling
       for restart..." then `await waitForSuccessfulPing(url)` then
       **`location.reload()`**.
     - **:1148-1150** the poll only runs while the tab is visible:
       `while (true) if (currentState === 'visible') { ping } else await
       waitForWindowShow(...)`.

     So: a seconds-long switch does not kill the socket, and nothing happens. A
     minutes-long switch lets iOS suspend the page, the socket dies, the client
     **parks** until the tab is shown again, and then reloads. That is precisely
     "the counter only moved after minutes" — produced by the candidate item 100
     dismissed for not matching that timing.
     (correction — item 100's ruling-out of candidate (a) is withdrawn)

113. **And (d) was ruled out for the wrong reason.** The service worker only
     reloads if `sw.js` actually changed, so it would not fire on a short switch
     either. The real reason it is out is item 72's own unchecked caveat: the
     Tailscale URL is plain http, so `navigator.serviceWorker` is undefined and
     `app.ts:1173` never runs. Right answer, wrong argument.
     (correction)

114. **The measurement that settles it is ALREADY ON SCREEN and was not read
     back.** The counter prints `loads: N (navType)`. `location.reload()` reports
     `navigation.type === 'reload'`; a Safari tab discard and restore reports
     `navigate`. Item 99 recorded the number and not the word.
     **One word from Jamie settles the whole diagnosis.** (question — Jamie)

115. **Why it changes the fix, not just the write-up.** If it is vite, item 101's
     "we cannot stop the reload and should not try" is false — a `server.hmr`
     setting stops it, and item 8 already names the route for asking the pi bot.
     Item 103's synchronous restore would then be treating a symptom we could
     remove outright. Items 100-105 are held until item 114 is answered.
     (correction)

## H-2 — item 103's fix is broken in three ways

116. **Moving the observer up throws.** `reproject()` calls `draw()`, which calls
     `controls.render(...)`, and `controls` is created after both awaits because
     it needs the catalogue. The game's DOM insertions would fire the observer
     during the awaits and hit a temporal dead zone — a silent `ReferenceError`
     inside a rAF callback, on a phone. The early path must be a bare `project()`
     with no `draw()`, and the observer needs a guard until `controls` exists.

117. **It inverts replay and live edits, and nothing puts them back.** Today the
     replay projection lands first and the live patch set second. Item 103 makes
     the live set go first, and the replay `project()` then **overwrites**
     `className` for every breadcrumb in both — and a className write does not
     retrigger the observer, which watches `childList` only. The same element is
     routinely in both sets (`docs/EDIT-MODE.md:125`, "save several times before
     anything is folded"). **The fix needs a precedence rule: live wins, and
     re-project once the replay lands.**

118. **A synchronous projection before the game renders is a no-op** —
     `overlay.ts:583-589` already documents exactly that. The load-bearing half of
     item 103 was the observer move, which the wording buried.

## Findings held for the next pass, so a context clear does not lose them

119. **H-3 — item 89 is an unsettled recommendation that reverses a decision
     Jamie made on 2026-08-26** (the control row is hidden in edit mode, "two ways
     to do one thing on a phone is one too many"). Items 106 and 110 both assume
     it was reversed. If it was not, a genuinely failed save leaves him stuck in
     edit mode with no Discard, no Save and no way to stop the server. Needs
     Jamie. Also unrecorded: `.sheet { padding-right: 76px }` clears one pencil,
     not a three-control row.

120. **H-4 — section 5 was never rewritten after item 106 made Discard a stop.**
     Item 20's order of operations omits `stopped = true`, `setPencilEnabled(false)`,
     `syncStopPill()`, the shutdown POST itself, a `busy` guard, and what happens
     when the discard succeeds and the stop then fails — where `COPY.stopFailed`
     ("Saved, but the server did not stop") is wrong on both counts.

121. **M-1 — item 76 names a value, not a rule.** Initialising the sentinel does
     not fix item 66.2: save three edits, undo all three, and the signature
     differs from the saved one again. The rule is **"an empty patch set is
     nothing to save"**. Item 93's module list also omits `session-store.ts`.

122. **M-2 — item 79's "`COPY.stoppedNothingSaved` is unreachable" is false.**
     Save with the pencil, then tap the pill: `isPending()` is false, the save is
     skipped, and that message shows. It is also wrong copy on that path — a
     session file was just written and it tells him nothing about folding it.
     A live bug the brief asserted out of existence.

123. **M-3 — item 109's closing line can be materially incomplete.** A Discard
     can end a run in which sessions were already banked, and the line never
     mentions folding them, while `COPY.stopped` does.

124. **M-4 — "Lose all and stop?" lies on a fresh session**, where Discard is
     visible (item 110) with nothing to lose.

125. **M-5 — item 92 was false: two ledgers still read as open** (§3 line 153,
     §1 line 13), and the closing block claims otherwise. Item 98's tidy-up was
     not done either.

126. **M-6 — item 93 contradicts items 94 and 96 in the same block.** "No file
     outside `src/edit-mode/`" is false: the docs, the safety spec and the unit
     specs all change. And §11 must be restated as ONE list — six later items
     have retargeted it.

127. **M-7 — item 60 still reads live** and is wrong twice over (item 77 killed
     its premise, item 110 killed its conclusion). Item 61's "four visibility
     rules" is stale too — three rules plus one always-on control.

128. **Lows: item 88 is orphaned** by item 103 and must be marked dead; item 90 is
     mooted by item 109; the line numbers in items 76-88 and 102-103 are stale
     after commit 52c0b38 (the two fetches are at `overlay.ts:75-82`, not 56-62);
     item 96's evidence is wrong though its conclusion holds; item 85 does not
     supersede item 50, which is true of a different element.
