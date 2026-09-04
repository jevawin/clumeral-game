# Plan — the late restore, the empty-session wedge, and Discard

Date: 2026-09-03 · Branch: `dev/jamie-controlled-dev-server` · Brief:
[`2026-09-03-edit-mode-safari-reapply-brief.md`](2026-09-03-edit-mode-safari-reapply-brief.md)

**Section 12 of the brief is the contract.** Items 1-128 are the working record
and are superseded by section 12 wherever they differ. Two `da-brief` rounds ran;
the second withdrew the original diagnosis, and the brief carries both.

**Approved: Jamie 2026-09-03.** Plan approval is his as dev lead. Build may start.
R22's wording was approved in the same message, so section 6 has no open items.

---

## 0. The one thing still open, and why it does not block

Brief item 114: the load counter prints `loads: N (navType)` and only the number
was read back. `reload` means vite is reloading the page; `navigate` means Safari
discarded the tab.

**It does not block, because the reload is real either way and the edits come
back two fetches late either way** (item 129). Task 2 fixes that, and is correct
under both. If the answer turns out to be `reload`, a `server.hmr` setting would
stop the reload entirely — that is a better fix on top, and `vite.config.ts`
belongs to the pi bot, so it is an **ask, not an edit** (items 8, 130, 150).

Task 9 deletes the counter and is the only task that waits.

---

## 1. What is testable, and why that shapes everything

`src/edit-mode/overlay.ts` ends in a bare `void start()` with no export, so a
test cannot import it. This is a known gap, already stated on PR #314. Every
decision in this work is a function of state, so **every decision moves into
`pending.ts`, which is a plain module with no DOM**, and `overlay.ts` keeps only
the wiring.

That is not a tidiness argument. Item 121 exists because the first fix was
specified as a value rather than a rule, and a value cannot be tested for the
case it misses.

---

## 2. Tasks

Tests first, then implementation, in each task. Each is one commit and each
leaves `npx vitest run` green.

### Task 1 — copy first, because three tasks need it

**Implements:** brief items 142, 143, 144, 145, 147, and the copy half of 133.
**Files:** `src/edit-mode/copy.ts`, `tests/edit-mode-safety.spec.ts`.

1. `stopControl: 'Save & Stop'` → `'Save'` (item 30).
2. New: `discardControl: 'Discard'`.
3. New armed labels:
   - `saveArmed: 'Save and stop?'`
   - `discardArmed: 'Lose all and stop?'`
   - `discardArmedNothing: 'Stop the server?'` — the fresh-session case, where
     "lose all" has nothing to lose (item 143).
4. New closing lines:
   - `discarded: 'Changes discarded and the server has stopped. Tap /dev in Telegram to start again.'`
   - `discardedWithSaved: 'Changes discarded and the server has stopped. Sessions you saved earlier are still there — ask the bot in Telegram to fold them, or tap /dev to start again.'`
     (item 144, covering item 123's gap)
   - `discardStopFailed: 'Changes discarded, but the server did not stop. Use /devstop in Telegram.'`
     (item 140 — `stopFailed` says "Saved", which is wrong on both counts here)
5. `exitEditMode: 'Save and exit edit mode'` → `'Leave edit mode'` (item 145).
   After Task 3 the pencil sometimes only exits.
6. **Fix `stoppedNothingSaved`.** Item 122: it IS reachable — save with the
   pencil, then tap the pill — and on that path a session file was just written
   and the message says nothing about folding it. It becomes:
   `'The server has stopped. Sessions you saved earlier are still there — ask the bot in Telegram to fold them, or tap /dev to start another.'`
7. `tests/edit-mode-safety.spec.ts`: add `saveArmed`, `discardArmed` and
   `discarded` to `OVERLAY_COPY`. **The armed labels, not the bare words** —
   `'Save'` and `'Discard'` are one-word strings that would stop guarding
   anything (item 147). Remove the old `stopControl` entry, which is now the bare
   word `'Save'`.

**Proves it:** `npx vitest run tests/edit-mode-safety.spec.ts` green, and it
still fails if an edit-mode string is planted in `dist/`.

### Task 2 — the restore lands on first paint

**Implements:** brief items 129, 131, 153. Supersedes items 63, 88, 103.
**Files:** `src/edit-mode/project.ts`, `src/edit-mode/overlay.ts`,
`tests/edit-mode-controls.spec.ts`.

The shape of the fix changed under review, and the change matters. Item 103 said
"project the live set early, the replay still lands later". That inverts the two
and the replay then overwrites the live edits, silently, because `project()`
writes `className` and the observer watches `childList` only (item 117).

**So the two projections merge into one, rather than racing.**

1. **New pure function in `project.ts`:**
   ```ts
   export function mergeProjections(
     replay: ReadonlyMap<string, string[]>,
     live: ReadonlyMap<string, string[]>,
   ): Map<string, string[]>
   ```
   Every key from both; **live wins on a collision**. That is the precedence rule
   item 117 asked for, expressed as data rather than as an ordering of side
   effects. The same element is routinely in both sets — `docs/EDIT-MODE.md:125`,
   "save several times before anything is folded".

2. **`overlay.ts`, before either fetch:** build the store, load it, restore the
   history, and `project(document, history.projection())`.

3. **The early observer is a bare projection.** `reproject()` calls `draw()`,
   which calls `controls.render(...)`, and `controls` is created after the
   catalogue arrives. Calling it early throws a `ReferenceError` inside a
   `requestAnimationFrame` callback — silently, on a phone (item 116). So:
   ```ts
   let controlsReady = false;
   ```
   and `reproject()` returns after `project()` unless `controlsReady`. Set it
   true immediately after `createControls(...)`.

4. **When the replay fetch resolves**, project
   `mergeProjections(replayMap, history.projection())` rather than the replay
   alone.

5. **The `project()` call before the game renders is a no-op and that is fine**
   (item 118) — `overlay.ts:583-589` already says why. The observer is what
   catches the render; moving it up is the load-bearing half.

**Tests** (`tests/edit-mode-controls.spec.ts`, which already imports the pure
modules):
- `mergeProjections` — keys only in replay survive; keys only in live survive; a
  key in both takes the live value. The third is the one that is red today, in
  the sense that today's ordering produces the replay value.

**Proves it:** the unit tests, plus Jamie's acceptance test 5 (item 158).

### Task 3 — an empty patch set is nothing to save

**Implements:** brief items 132, 133, 152. Supersedes items 61, 62, 76.
**Files:** `src/edit-mode/pending.ts`, `src/edit-mode/overlay.ts`,
`tests/edit-mode-controls.spec.ts`.

1. **New pure function:**
   ```ts
   export function hasSomethingToSave(patchCount: number, signatureChanged: boolean): boolean {
     return patchCount > 0 && signatureChanged;
   }
   ```
   **The rule, not the value.** Initialising `EMPTY.savedSignature` to
   `signature([], '')` fixes the fresh session and leaves the one item 121 names:
   save three edits, undo all three, and the signature differs from the saved one
   again with nothing to post. `patchCount > 0` covers both, in one place.

2. **`overlay.ts`:** `isPending()` becomes
   `hasSomethingToSave(patchCount(), signature(history.entries, freeCss) !== savedSignature)`,
   where `patchCount()` is `history.entries.length` plus one when `freeCss` is
   non-empty **and** an element is selected — the same condition `save()` uses to
   decide whether to append the `css` patch, so the count and the post cannot
   disagree.

3. `session-store.ts` is **not** changed. One rule in one place beats a rule plus
   a sentinel that must agree with it.

4. This repairs three things, not two: the pencil, `runStop()`'s
   `hadSomethingToSave`, and Discard's own guard (item 133).

**Tests:**
- fresh session, no entries, no free CSS → `hasSomethingToSave(0, true)` is false
  → `exitDecision(false, null)` is `'leave'`. **Red today**: `isPending()` returns
  true and the pencil posts an empty set.
- three entries saved, then all undone → `hasSomethingToSave(0, true)` is false.
  **This is the case item 121 says a sentinel-only fix misses.**
- entries present and changed → true.
- entries present and unchanged since the save → false.

**Proves it:** the unit tests, plus Jamie's acceptance tests 1 and 2.

### Task 4 — which controls are on screen

**Implements:** brief items 134, 135. Supersedes items 22, 26, 60.
**Files:** `src/edit-mode/pending.ts`, `src/edit-mode/panel.ts`,
`src/edit-mode/controls.ts`, `src/edit-mode/overlay.ts`,
`tests/edit-mode-controls.spec.ts`.

1. **`stopPillState` is replaced by a row:**
   ```ts
   export interface ControlRowState {
     discard: { visible: boolean; enabled: boolean };
     save:    { visible: boolean; enabled: boolean };
   }
   export function controlRowState(
     stopped: boolean,
     somethingToSave: boolean,
     busy: boolean,
   ): ControlRowState
   ```
   - Discard: `visible: !stopped` — **always, in play mode and in edit mode**.
   - Save: `visible: !stopped && somethingToSave`.
   - Both: `enabled: !busy`.
   The `mode` parameter goes. **This reverses the 2026-08-26 rule** that hid the
   pill in edit mode; brief item 135 records why and flags it to Jamie.

2. **The footer:**
   ```ts
   export function footerControls(
     hasSelection: boolean,
     canUndo: boolean,
     elementChanged: boolean,
   ): { undo: boolean; reset: boolean }
   ```
   Undo needs a selection and a step; Reset needs a selection and a changed
   element. `controls.ts` renders from this instead of always appending both.

3. **The footer keeps a fixed height** so it does not jump as buttons come and go
   (item 27).

4. **Focus** (items 45, 95): `panel.sheet` gains `tabindex="-1"` — without it
   `.focus()` does nothing — and a control about to be hidden hands focus to the
   sheet first.

**Tests:** a table over `controlRowState` and `footerControls` — every
combination, including `stopped` beating everything and `busy` disabling rather
than hiding.

### Task 5 — the confirm gesture

**Implements:** brief items 24, 34, 37, 53, 141, 143, 146.
**Files:** `src/edit-mode/pending.ts`, `src/edit-mode/panel.ts`,
`tests/edit-mode-controls.spec.ts`.

1. **Pure state machine:**
   ```ts
   export type ArmedControl = 'save' | 'discard' | null;
   export function armOnTap(current: ArmedControl, tapped: 'save' | 'discard'):
     { armed: ArmedControl; act: 'save' | 'discard' | null }
   ```
   Tapping an unarmed control arms it and disarms the other (item 141). Tapping
   the armed one acts and disarms.

2. **The label:**
   ```ts
   export function controlLabel(
     control: 'save' | 'discard',
     armed: boolean,
     somethingToSave: boolean,
   ): string
   ```
   Discard armed with nothing to lose returns `discardArmedNothing`
   (item 143).

3. **Four seconds, and only on the confirm labels** (item 146). Item 41's timer
   on the discard message is dropped by item 144 — a terminal message must not
   vanish. The timer is cleared when the control is disarmed by a tap on the
   other one, so two timers cannot both be running.

**Tests:** arming one disarms the other; a second tap acts; the label table.
The four-second revert is driven by `vi.useFakeTimers()` in the panel test.

### Task 6 — the icons and the row

**Implements:** brief items 52, 54, 55, 58, 67, 68, 69, 91, 136, 137.
**Files:** `src/edit-mode/icons.ts`, `src/edit-mode/panel.ts`.

1. `icons.ts` gains a **bin**. The floppy is already there as `save` (item 87).
   `public/sprites.svg` is the **game's** sheet and a production artefact — it is
   not touched.
2. **One right-anchored flex row** replaces `.pencil`'s and `.stop-btn`'s two
   `position: fixed` rules. Order left to right: Discard, Save, pencil (item 58).
   Anchored right, so a button's right edge stays put, it grows leftwards, and it
   **pushes** its left-hand neighbours rather than overlapping them (item 67).
3. Controls are **56px**, the pencil's size (items 85, 137).
4. `.sheet { padding-right: 76px }` clears one pencil. **The clearance follows
   the row** — about 180px at rest (item 136).
5. **Colour arrives with the expansion, not at rest** (item 55). **Fixed hex
   pairs in `panel.ts`, beside its other hand-written colours — NOT
   `--color-success` / `--color-error`** (item 91): those derive from
   `--accent-l` and `--chroma-*` and flip in dark mode, while the panel is
   permanently light, so they would take a dark-mode value on a white surface and
   the tool's chrome would start tracking the theme being edited.
6. **Check the 320px case**: 160 + 56 + 56 + gaps + gutters is about 304px on a
   320px screen (item 137). It fits with little to spare, so it is on Jamie's
   acceptance list rather than assumed.

### Task 7 — Discard

**Implements:** brief items 19, 20, 106, 107, 138, 139, 140.
**Files:** `src/edit-mode/overlay.ts`, `src/edit-mode/pending.ts`.

`discardAll()`, a sibling of `stopServer()` rather than a branch inside it —
`runStop` is save-then-shutdown and this is discard-then-shutdown (item 139).
Guarded by `if (busy) return`, like `stopServer()`.

In this order (item 138), and the order is load-bearing:

1. `stopped = true` **first**. It is what stops `persist()` writing the session
   straight back after `store.clear()`, and it is the guard `runStop` already
   relies on (`overlay.ts:204`).
2. Project the originals back over every edited element, from
   `history.originalOf(...)`.
3. Clear the undo stack, `freeCss`, `switchedOff`, `selected`, `selectedPath`.
4. `store.clear()`, and set `savedSignature = signature([], '')` — **never
   `''`**, which is the value that caused the wedge in the first place (item 82).
5. `setMode('play')`, `panel.setPencilEnabled(false)`, refresh the control row.
6. POST `/__edit-mode/shutdown`, and report with `stopOutcome()`:
   - `'stopped'` → `discarded`, or `discardedWithSaved` when sessions were
     already banked in this run.
   - `'stopFailed'` → `discardStopFailed` (item 140).

**A network error still counts as success.** A dropped connection is what a
successful shutdown looks like from the browser; `stopOutcome` already encodes
that and it is not being reopened.

**Whether sessions were banked** is tracked by a boolean set whenever a save
returns 2xx, so the closing line can pick between the two (item 123).

**Tests:** `stopOutcome` is already covered. New: the closing-line chooser as a
pure function of (outcome, hadSavedSessions).

### Task 8 — the docs

**Implements:** brief items 94, 149, 155.
**Files:** `docs/EDIT-MODE.md`.

Lines 37, 53, 56, 87, 125, 148-150, 157 and 176 name "Save & Stop" or describe
the pencil's failed-save rule. All are falsified by items 18, 19, 26 and 30.
Rewrite them to: two session controls beside the pencil, Discard always there and
also the stop, Save appearing only when there is something to save, and the
pencil leaving whenever there is nothing to save.

### Task 9 — delete the load counter

**Implements:** brief items 105, 156. **BLOCKED on item 114.**

The counter added in `52c0b38` is the only thing that proves a reload happened at
all, so it stays until Jamie reads back the word in brackets. Then it goes, and
the answer is recorded in the brief.

If the answer is `reload`, this task also carries the **ask** to the pi bot for a
`server.hmr` setting (items 130, 150). We do not edit `vite.config.ts`.

---

## 3. Order, and why

1, 2, 3 first: copy has no dependencies, and Tasks 2 and 3 are the two defects —
they are what Jamie is actually stuck on, and they are independent of the whole
control redesign. **If the redesign slips, the bugs are already fixed.**

Then 4, 5, 6, 7 build the row from the inside out: the rules, then the gesture,
then the pixels, then the action that uses all three.

Then 8. Then 9 when unblocked.

---

## 4. QA

**Light, and no local Playwright** (items 65, 157). Everything above is unit-
testable because everything above is a pure function. CI runs the full browser
matrix on the pull request. A local Playwright run is Jamie's call in the moment
and is not a step in this plan.

`tests/edit-mode-safety.spec.ts` is the one that matters most: it asserts edit
mode is absent from both deployed artefacts, and this work adds three strings and
an icon.

**Jamie's acceptance test** is item 158, five items, on his phone.

---

## 5. Brief items → tasks

| Items | Where |
|---|---|
| 1-16 | The report and the diagnosis. Record only, no code. |
| 17, 43, 50, 77, 85 | Facts checked during the brief. No code. |
| 18, 132, 133, 152 | Task 3 |
| 19, 20, 106, 107, 138, 139, 140 | Task 7 |
| 21, 84 | Recorded behaviour, no code — banked sessions stay on disk |
| 22, 26, 27, 60, 134, 135 | Task 4 |
| 24, 34, 37, 53, 141, 146 | Task 5 |
| 23, 25, 28-33, 35, 36, 108, 109, 142-145, 147 | Task 1 |
| 38 | No code — `COPY.stopped` is unchanged |
| 39, 41 | Superseded by 144 → Task 1 |
| 40 | Task 1 |
| 42 | Task 7, step 6 — the message uses `notify`, not `say` |
| 44, 48, 49, 51 | Accessibility, waived by Jamie. No code. |
| 45, 95 | Task 4, step 4 |
| 46, 47 | Dropped by item 49. No code. |
| 52, 54, 55, 58, 67-69, 91, 136, 137 | Task 6 |
| 56, 57, 59 | Superseded by 58 and 67. No code. |
| 61-64, 66 | Superseded by 151-158. See the tasks named there. |
| 65, 157 | Section 4 |
| 70-75, 99-105, 112-118, 129-131 | Task 2, and Task 9's ask |
| 76, 79, 121, 122 | Task 3 |
| 78, 119 | Task 4 — the orphan is closed by Discard being always visible |
| 80 | Answered by item 106. No code. |
| 81-83, 120 | Task 7 |
| 86 | Task 6, step 2 |
| 87 | Task 6, step 1 |
| 88 | **Dead.** Superseded by Task 2's merge. No code. |
| 89, 135 | Task 4, step 1 |
| 90 | Mooted by item 144. No code. |
| 92, 98, 125, 127 | Brief housekeeping, done. No code. |
| 93, 126, 148, 149 | The file list. Tasks 1-8. |
| 94, 155 | Task 8 |
| 96, 147, 154 | Task 1, step 7 |
| 97, 145 | Task 1, step 5 |
| 105, 114, 156 | Task 9 |
| 110 | Task 4 |
| 123 | Task 1, step 4 and Task 7, step 6 |
| 124, 143 | Task 1, step 3 and Task 5, step 2 |
| 128 | Line-number refresh. Done in this plan's citations. |
| 150 | Task 9 — an ask, not an edit |
| 151-153 | Tasks 2, 3, 4, 5 — the pure functions |
| 158 | Section 4 |

---

# 6. da-plan review — rev 2

Two highs, nine mediums, eleven lows. All answered. **Where this section
disagrees with sections 2-5, this wins.**

## H1 — the tests were aimed at the wrong files, and three tasks left the suite red

The plan sent every new test to `tests/edit-mode-controls.spec.ts` on the claim
that it "already imports the pure modules". It does not — it imports
`controls.ts`, `catalogue.ts` and `copy.ts` only. `pending.ts` lives in
**`tests/edit-mode-pending.spec.ts`**, which the plan never named, and which
imports `stopPillState` and asserts on it five times. Task 4 deletes that
function, so that file stops compiling. **`tests/edit-mode-panel.spec.ts`** was
missed too. Brief item 149 is where the wrong file list came from; the plan
should have checked rather than inherited it.

**R1. The real file list.** Tasks 4, 5 and 6 also touch
`tests/edit-mode-pending.spec.ts` and `tests/edit-mode-panel.spec.ts`.

**R2. Three existing tests are DELIBERATE reversals, not breakages, and each gets
a replacement that says so:**
- `edit-mode-panel.spec.ts:124` "hides the pill in edit mode, where the pencil is
  the save control" → becomes "shows the row in edit mode too", citing brief item
  135. This is the 2026-08-26 decision being reversed.
- `edit-mode-panel.spec.ts:131` "does NOT bring the pill back on its own when edit
  mode closes" → the invariant it guards moves onto `stopped`; the replacement
  asserts a stopped server never shows either control.
- `edit-mode-panel.spec.ts:122` asserts the pill's text is `COPY.stopControl` →
  becomes the two-control row.

**R3. `edit-mode-controls.spec.ts:259`** asserts two footer buttons with no
selection, which `footerControls(false, …)` makes impossible. It and the four
assertions depending on the `beforeEach` render are rewritten to pass the new
state explicitly.

**R4. Every task's "Proves it" line names the files it must leave green**, and
`npx vitest run` in full is the gate at each commit — not one spec.

## H2 — Task 5's label used the wrong predicate

`controlLabel(control, armed, somethingToSave)` re-creates item 124's mislabel in
the other direction. Make three edits, tap Save, the save succeeds:
`somethingToSave` is now false, but the entries are still there and Discard is
about to throw away a screenful of visible work — and the button would read
**"Stop the server?"**.

**R5.** The predicate is **something to DISCARD**, which is a different value:

```ts
export function hasSomethingToDiscard(patchCount: number): boolean {
  return patchCount > 0;
}
export function controlLabel(
  control: 'save' | 'discard',
  armed: boolean,
  somethingToDiscard: boolean,
): string
```

They coincide only before the first save. **A test pins the divergence:** edits
saved, then Discard armed → "Lose all and stop?", never "Stop the server?".

## Mediums

**R6 (M1) — Task 2's move is wider than four lines.** The block that moves above
the fetches is `overlay.ts:84-133` (`store`, `saved`, `freeCss`,
`savedSignature`, `stopped`, `busy`, `history`, `mode`, `selected`,
`selectedPath`, `switchedOff`, `offFor`, `chipOrder`) **and** `563-607`
(`projecting`, `reproject`, `pending`, `scheduleReproject`, `observer`,
`observer.observe`). `projecting` and `pending` are `let`, so an observer
callback firing during the awaits hits the same temporal-dead-zone error item 116
warned about — in a different variable. The `controlsReady` guard is confirmed
correct for `controls` itself; it is the scope of the move that was wrong.

**R7 (M3, M4) — `countPatches` is exported from `pending.ts` and called from BOTH
places.** The plan's safety argument was "the same condition `save()` uses, so
they cannot disagree" — but that was two hand-copied conditions in a file no test
can import.

```ts
export function countPatches(entryCount: number, freeCss: string, hasSelection: boolean): number {
  return entryCount + (freeCss !== '' && hasSelection ? 1 : 0);
}
```

Called by `isPending()` and by `save()` (`overlay.ts:414`). The invariant is now
enforced rather than asserted, and the whole decision is reachable from a test.

**R8 (M4) — item 152's "red today" test is honestly limited, and the limit is
stated rather than hidden.** The shipped bug is in `isPending()`, which cannot be
imported (`grep -c "^export" src/edit-mode/overlay.ts` → 0). With R7 a test can
drive real `history` entries through `countPatches` and `hasSomethingToSave` and
cover the whole decision — but the *wiring* of that decision into `overlay.ts` is
still only covered by Jamie's acceptance tests 1 and 2. **Said plainly, not
claimed away.**

**R9 (M2, M3) — section 4's "everything is unit-testable" is withdrawn.** What is
NOT reachable from a test, stated: Task 2's wiring and the observer move — which
item 118 calls the load-bearing half; Task 6 entirely; `discardAll()`'s sequence;
and the focus handling. `mergeProjections` tests the merge, not the move. These
rest on Jamie's acceptance test, and that is the honest position.

**R10 (M5) — the panel's API and its dead code.** `panel.ts:490`
`if (mode === 'edit') stopBtn.hidden = true` is silently undone by the
`syncStopPill()` that follows it; it goes. The docstring at `panel.ts:386-392`
becomes false and is rewritten. `setStopVisible` / `setStopBusy` / `onStop` are
single-control methods and are replaced by:

```ts
setRow(state: ControlRowState): void;
onDiscard(handler: () => void): void;
```

`onStop` becomes `onSave`. Confirmed: dropping `mode` does **not** break the
"cannot be brought back by Escape" invariant — that half is carried by `stopped`,
and `controlRowState(true, …)` still hides both.

**R11 (M6) — `stopped` is set back to `false` when the shutdown fails.** Task 7
set it before the POST and never unset it, so on `'stopFailed'` the server is
alive while both controls are hidden and the pencil is dead — no control on the
page can stop it. That is item 78's orphan, reached through the one path item 120
asked to be specified. On the `stopFailed` branch: `stopped = false`, refresh the
row, and a second Discard tap retries the shutdown.

**R12 (M7) — "were sessions banked?" must survive the reload.** An in-memory
boolean is false after exactly the tab discard this whole brief is about. The
durable signal already exists and is already persisted: `savedSignature` in
`StoredState`, written on `res.ok`. **Use `saved.savedSignature !== ''`.**

**R13 (M8) — the closing line has two axes, not one.** Task 5 gets a fresh-session
label; Task 7 then ended that same session claiming it discarded changes that
never existed — the last thing the page ever says. The chooser is a pure function
of (stop outcome, anything discarded, anything banked):
- nothing discarded, nothing banked → `stoppedNothingSaved`
- discarded, nothing banked → `discarded`
- discarded, banked → `discardedWithSaved`
- nothing discarded, banked → `stoppedNothingSaved` (it already names the fold)
- stop failed → `discardStopFailed`

**R14 (M9) — focus cannot go to the sheet for the session controls.**
`panel.sheet` is `hidden` outside edit mode, and `.focus()` on a hidden element
does nothing. Save's commonest disappearance is in play mode the moment a save
succeeds — item 45's exact case. **The row's container is the fallback target**
for Save and Discard; the sheet stays the target for Undo and Reset, where it is
visible. `tabindex="-1"` on the sheet (item 95) is right and unaffected.

## Lows

**R15 (L10) — the ordering had a live hazard.** Task 1 landed
`stopControl: 'Save'` several commits before Task 5's confirm gesture, so for the
duration a **one-tap button labelled "Save" would kill the dev server** on a
branch Jamie is using on his phone. `exitEditMode: 'Leave edit mode'` is likewise
untrue until Task 3. **Both renames move out of Task 1 and land with the task
that makes them true** — `stopControl` with Task 5, `exitEditMode` with Task 3.
Task 1 keeps only the additions, which are inert until wired.

**R16 (L9) — hold the replay map and merge inside `reproject()`.** As written the
merge applies once, and `reproject()` then projects `history.projection()` alone,
dropping replay-only breadcrumbs at the first re-render. Pre-existing, but one
line makes item 153's sentence true across re-renders instead of for one instant.

**R17 (L4) — `discardArmedNothing`, `discardedWithSaved` and `discardStopFailed`
go in `OVERLAY_COPY` too.** Long distinctive strings are exactly what that spec
guards.

**R18 (L6, L7) — no placeholders.** `.sheet` clearance becomes
`padding-right: 196px` (three 56px controls, two 8px gaps, 16px gutter). The
expanded pill is handled by the row sitting **above** the sheet and the sheet
scrolling under it, not by padding — padding cannot solve a 300px overlay.
Colours, fixed hex in `panel.ts` beside its other hand-written values, chosen to
read on its permanently-light surface: **discard `#c62828` on `#fff`, save
`#2e7d32` on `#fff`**, white text on both.

**R19 (L5) — `COPY.pencilHint`** ("The pencil saves your changes and leaves the
editor") goes stale for the same reason as `exitEditMode`. It becomes "The pencil
saves your changes, if there are any, and leaves the editor." Lands with Task 3.

**R20 (L11, L2, L8) — housekeeping.** Item 42's surface is named in Task 7 step 6:
`panel.notify()`, never `say()`, because `setMode` blanks the sheet. Task 3's
omission of `session-store.ts` from item 148's list is a **deliberate deviation**
— one rule in one place — not an oversight. `syncStopPill()` is renamed
`syncControlRow()` and that name is used throughout.

**R21 (L1) — item 111 is a ledger entry with no code.** Added to section 5.

## L3 — the one thing that needs Jamie

**R22.** Task 1 step 6 invented replacement wording for `COPY.stoppedNothingSaved`.
Brief item 133 says "fix that copy too" and settles nothing about the words, and
section 8 is Jamie's. The proposed line is:

> "The server has stopped. Sessions you saved earlier are still there — ask the
> bot in Telegram to fold them, or tap /dev to start another."

**Settled: Jamie 2026-09-03.** Everything else in this revision is a "how" and is mine.

---

# 7. Build record — 2026-09-04

Tasks 1-8 built, one commit each, in the plan's order. `npx vitest run` green in
full after every commit: **1199 passed, 1 skipped** at the end, up from 1157 at
the start. `npm run build` succeeds and `tests/edit-mode-safety.spec.ts` passes
against the real `dist/`, which is the gate that matters most here — three new
strings and an icon were added to a tool that must not ship.

| Task | Commit | Note |
|---|---|---|
| 1 — copy | `b3de604` | Additions only. Both renames deferred per R15. |
| 2 — restore on first paint | `1658eb3` | State + observer moved above the fetches; `mergeProjections`. |
| 3 — empty patch set | `5fef421` | `countPatches` / `hasSomethingToSave`; the two deferred renames land here and in task 5. |
| 4 — the control row | `1017e6d` | `controlRowState`, `footerControls`, panel `setRow`/`onSave`/`onDiscard`. |
| 5 — the confirm gesture | `be2b87f` | `armOnTap`, `controlLabel`, `hasSomethingToDiscard`. `stopControl` → 'Save'. |
| 6 — icons and the row | `6c92685` | Bin icon, 56px circles, colour on expansion, `padding-right: 196px`. |
| 7 — Discard | `3273d73` | `discardAll()`, `discardClosingLine`, R11's stopFailed recovery. |
| 8 — the docs | `125c530` | Nine "Save & Stop" references rewritten. |
| 9 — the load counter | **not built** | Blocked on item 114. Still in `overlay.ts`. |

## Deviations from section 6, and why

**D1. R7's `countPatches` is called from `save()` through
`includesCssPatch`, not directly.** R7 asked for one function called from both
places; `save()` needs a boolean ("does the css patch go in this post?"), not a
count. So the shared condition is `includesCssPatch(freeCss, hasSelection)`,
which `countPatches` is defined in terms of and `save()` calls directly. The
invariant R7 wanted is enforced — one condition, one place, both call sites
reach it — rather than asserted.

**D2. R12's durable "were sessions banked?" is a variable seeded from the store,
not a re-read of `savedSignature`.** R12 said use `saved.savedSignature !== ''`.
Read at the moment of use that is wrong: Discard sets `savedSignature` to
`signature([], '')`, which is not empty, so a second Discard after a failed
shutdown would claim a session nobody wrote. `sessionsBanked` is seeded from
`saved.savedSignature !== ''` — R12's durable signal, read once at boot, so a
tab discard cannot reset it — and set again whenever a save returns 2xx.

**D3. `mergeProjections`'s tests live in `tests/edit-mode-history.spec.ts`**, not
`edit-mode-controls.spec.ts`. That is the spec that already imports `project.ts`.
R1 corrected the file list for `pending.ts`; this is the same correction for
`project.ts`.

**D4. The observer's early-exit now also asks about the replay.** It returned
when `history.entries.length === 0`, which with a held replay map would drop
every replay-only breadcrumb at the first re-render. R16 named the merge; this is
the same sentence one line further down.

**D5. Task 6's row container was built in task 4.** Task 4 could not rename the
panel's methods to `setRow`/`onSave`/`onDiscard` without two buttons to put in
it, and two buttons need somewhere to sit. Task 6 kept the icons, the 56px
sizing, the colours and the sheet's padding — the parts Jamie decided.

## Not reachable from a test, restated after building

R9's list held. `mergeProjections` is covered; the MOVE that makes it matter is
not. `discardAll()`'s ordering is not — the closing-line chooser is, the sequence
is not. Task 6 is not. The focus handling is covered at the panel level only.
These rest on Jamie's acceptance test, item 158.

**Four pre-existing `tsc` errors in `overlay.ts` are unchanged** (`replay.json`
and `catalogue.json` come back as `{}` / `unknown`). They are on lines this work
moved but not on code it wrote, and the count is the same before and after.
Types are Jamie's call; flagged, not touched.

## The ask that goes with task 9

If item 114's word turns out to be `reload`, a `server.hmr` setting in
`vite.config.ts` would stop the reload happening at all — a better fix on top of
this one. `vite.config.ts` belongs to the pi bot, so that is an **ask**, not an
edit (items 8, 130, 150).

---

# 8. da-build review, and what it changed

Ran fresh-context after the eight commits. Verdict: **FIX FIRST, 2 Medium.** Both
fixed; the Lows are triaged below. It found the temporal-dead-zone hunt, the
Discard ordering, the timer handling, the orphan check, the `syncControlRow`
coverage and the safety gate all clean, and accepted D1-D5.

## M1 — the fresh-session Discard ended on a sentence that was false

R13's table sent (stopped, nothing discarded, nothing banked) to
`stoppedNothingSaved`. That was right when R13 was written and stopped being
right one item later: **brief item 122 rewrote `stoppedNothingSaved` to ALWAYS
name the fold.** So `/dev`, tap Discard, tap again — and the last thing the page
ever says tells Jamie to go and fold sessions that were never written. That is
his acceptance test 3, verbatim, and it is the exact failure `copy.ts` says that
string exists to avoid.

**Fixed** with a fourth closing line, `stoppedNothing`. Its wording is the one
`stoppedNothingSaved` carried before item 122, which Jamie had already approved:
no new copy is invented. `runStop`'s own no-save branch asks the same question
now, because it has the same two axes.

## M2 — `padding-right: 196px` cost the sheet 120px on every row

R18's arithmetic was right for the row's WIDTH and wrong for what the row
covers. The row is 56px tall at 16px off the bottom, so it overlaps the sheet's
bottom 72px — while the sheet is up to 60vh. A gutter that clears it takes that
width off every row: on a 390px phone the usable column falls from 314px to
194px, and the search field, breadcrumb, chips and picker all live in it.

**Fixed** by moving the clearance to the axis the row is actually on:
`padding-bottom: calc(80px + safe-area)`, right gutter back to the normal 10px.
Nothing renders in the row's band, the full width is free everywhere else, and an
EXPANDED control is handled exactly as R18 said it would be — the row sits above
the sheet and the sheet scrolls under it.

**This is a deviation from R18 (D6)** and it is a "how", so it is mine, but it
reverses a number that review wrote deliberately. Flagged here rather than
buried.

## Lows fixed

- **The armed row had no left bound.** `.controls` was anchored right with no
  `left`, so an armed "Lose all and stop?" beside Save and the pencil is about
  341px on a 320px screen and the overflow is clipped off the LEFT — taking the
  start of the question and part of the tap target. Now bounded both sides, with
  the buttons truncating inside themselves and the 56px controls pinned by
  `flex: 0 0 56px`.
- **No session control existed until both fetches resolved.** The first
  `setRow` was the first `setMode`, at the very end of `start()`. Everything the
  row needs now lives above the fetches, so `syncControlRow()` runs beside the
  first-paint `reproject()`. Discard is the stop button, and it was absent for
  exactly the window this work exists to shorten.
- **"Save & Stop" survived in `edit-mode/plugin.ts`'s terminal log, in
  `shutdown-route.ts` and in three docstrings.** Outside task 8's file list, and
  untrue.

## Lows deferred, with the reason

- **`sessionsBanked` can be seeded true without a save.** Needs a failed
  shutdown AND a reload: `runDiscard` sets `savedSignature` to `'||'`, the
  `stopFailed` branch sets `stopped` back to false, and the next `persist()`
  writes it. Closing it properly means a `banked` field in `StoredState`, and
  the plan's D-note deliberately keeps `session-store.ts` out of this work — one
  rule in one place. The cost when it bites is one sentence naming sessions that
  are not there, on a path that already failed once.
- **`draw()` fires on every scroll event** and now rewrites the two controls'
  `innerHTML` as well as the sheet's children. Pre-existing shape, marginally
  worse, no correctness impact — the click listeners are on the buttons, not
  their children.

---

# 9. da-build re-review, and the one thing it found

Re-reviewed the fix commit fresh. It confirmed **M1 and M2 are genuinely closed**
— it walked the closing-line table across all six reachable combinations and the
sheet's padding across both the keyboard-open and keyboard-closed cases — and
found **one new Medium, introduced by one of the Low fixes.**

## M3 — the early control row was visible and dead

Drawing the row before the fetches (a Low fix) put Discard on screen within a
frame. Its HANDLER is registered after both fetches, because `discardAll()`
reaches `setMode()`, which reaches the interceptor and the controls — neither of
which exists yet (brief item 116). So for the whole catalogue fetch there was a
red "Stop the server?" that did nothing when confirmed.

That is the tool's oldest complaint, in a new place: `overlay.ts` already carries
two comments about it, and Jamie's own words are "seems functionally flakey". No
button at all was at least honest.

**Fixed with the pattern already in the file 180 lines above** — the one that
holds a pencil tap landing during the same window. The tap is held and honoured
when the wiring exists. Because the panel owns the confirm gesture, anything held
is an action Jamie already confirmed, so it is honoured late rather than dropped.

Hoisting the handlers instead would have been worse: an early tap would throw a
`ReferenceError` inside a `void`-ed async call — item 116's failure in a third
variable, silent, on a phone.

## Lows fixed in the same commit

- **`--row-clearance` drops to 8px while the keyboard is up.** The row is fixed
  to the LAYOUT viewport, so the keyboard is in front of it, while the sheet has
  been lifted clear. Clearing a row that is not there cost about a third of the
  sheet's height — exactly while the class search is in use.
- **`text-overflow: ellipsis`** on an armed label, so a truncated question looks
  truncated rather than merely short.
- **The `stoppedNothingSaved` docblock moved back onto its own string.** The new
  line had been inserted between them, so a comment saying "it still names the
  fold" sat above the one string whose point is that it does not. That adjacency
  is what produced M1 in the first place.
- The apostrophe in the plugin's log line.

## Both deferrals re-checked and upheld

`sessionsBanked`'s seeding is marginally HARDER to hit than section 8 said —
`persist()` is not called on the `stopFailed` branch itself, so it needs a
subsequent tap, selection or free-CSS edit before the reload. `draw()` on scroll
now costs two SVG parses in play mode as well as edit mode; still Low.

---

# 10. da-build third pass — the held tap, ordered

## M4 — a held session action was swallowed by the held pencil tap

The two drains ran back to back, pencil first. `toggleMode()` sets `busy = true`
and holds it across an `await save()`; both session actions open with
`if (busy) return`. So with a pencil tap AND a confirmed Discard both held, the
Discard vanished — no message, no notice, and the button had already collapsed
back to its icon, so on screen it looked like it acted.

The outcome is the one this whole feature exists to prevent: the edits Jamie
confirmed throwing away get **written to the Pi** by the pencil's save, and the
server he confirmed stopping **stays up**. Section 9's sentence — "anything held
is an action Jamie already confirmed, so it is honoured late rather than
dropped" — was true only when nothing else was held.

**Fixed by draining the session action FIRST and ending the pencil's turn with
it.** Both session actions are terminal, so a held pencil tap is moot rather than
dropped: Discard sets `stopped` synchronously before its first await, and
`toggleMode`'s own first line refuses to enter the editor of a stopped server;
Save subsumes what the pencil would have done.

## Lows fixed with it

- **`text-overflow: ellipsis` was a no-op on the button**, which is a flex
  container — and worse, `justify-content: center` plus a flex item's default
  `min-width: auto` clipped an over-long armed label at BOTH ends, losing the
  start of "Lose all and stop?". The truncation moves onto the label span, which
  is now the only thing in the row allowed to shrink.
- **`--row-clearance` switched at `inset > 0`, which is the wrong threshold.**
  The row is 56px tall at 16px off the bottom and is not lifted by the keyboard
  inset, so it is only fully covered at 72px. An iPad accessory bar, a docked
  floating keyboard and every frame of the iOS open animation sit below that.
  Now `inset >= 72`.
- **The docblock move in section 9 was half done** — the new string had been
  hoisted above BOTH blocks, so `stoppedNothingSaved` was documented by the
  comment written for `stoppedNothing`, which says the opposite. Each block is
  back on its own string.

## Stated plainly, not claimed away

**The held-tap path has no test and cannot have one as written.** `overlay.ts`
exports nothing and ends in a bare `void start()`. R9 already withdrew the
"everything is unit-testable" claim for exactly this wiring. Both M3 and M4 rest
entirely on Jamie's acceptance test, item 158 — nothing in sections 9 or 10
should be read as coverage.
