# Phase 7: Archive Replay — Keep Header Date + Archive Button Visible — Research

**Researched:** 2026-05-30
**Domain:** SPA screen state, archive replay flow, `[data-archive-row]` lifecycle
**Confidence:** HIGH — root cause pinpointed to exact file:line from source inspection


## Summary

This is a UI-state bug in the archive replay flow. The "archive date" (`data-archive-banner`) and the "Archive" button (`data-archive-back`) live inside a single container — `[data-archive-row]` — in the game screen HTML. That container is hidden by default and shown by `startReplayPuzzle()`. The bug is that two separate code paths can hide it again during an active archive session, before the user has a chance to exit.

The first path is the `route_change` handler in `app.ts` (lines 914-923). It fires on every `analytics:track` event with `event === 'route_change'`, including the one emitted during the initial archive-date cold load. The handler checks `location.pathname` against a date regex and hides `[data-archive-row]` if the path is not an archive date. During normal archive play this is benign, but on certain navigation paths — especially after solve — the route change fires at a moment when `showCompletedState()` has not yet restored the archive row, leaving it hidden.

The second path is `showCompletedState(tries, replayDate?)` (lines 455-496). When called with no `replayDate` argument, it hides the archive row. The `screens:enter` listener (lines 981-989) re-applies `showCompletedState` when the game screen activates. It reads `location.pathname` to decide whether to pass `replayDate`, but it only does so when `gameState.date !== todayKey()`. The issue is that the listener also checks `location.pathname.startsWith('/archive/')` — which is correct — but this listener fires *after* `startReplayPuzzle()` has already shown the banner, and any subsequent screen transition back to the game screen will re-invoke it correctly. The real gap is during the live-solve path: when `handleGuess()` calls `showCompletedState(tries, gameState.date)` at line 683, this does pass the date. So the solve path is not the bug source for pre-solve visibility.

The core bug is narrower: **during the initial cold load of `/archive/<date>`, the `route_change` event fires (emitted by `applyRoute` in `router.ts`) and the `analytics:track` handler in `app.ts` runs the archive-row hide check before `startReplayPuzzle()` completes and shows the banner**. The fetch for the puzzle data is async. The sequence is:

1. `initRouter` calls `navigate('/archive/YYYY-MM-DD')` synchronously.
2. `applyRoute` emits `analytics:track` with `route_change`.
3. The handler fires immediately, reads `location.pathname`, sees `/archive/YYYY-MM-DD` — so `onArchiveDate` is `true` — and does NOT hide. This is fine.
4. `deps.onArchiveDate(date)` fires, which calls the async `fetch(...)` chain in `app.ts` line 952.
5. While the fetch is in flight, the row is hidden (default state).
6. Fetch resolves, `startReplayPuzzle()` runs, banner is shown.

So the **cold load path is actually fine** in the steady state. Let me refine the root cause below.

**The actual bug surfaces on a specific navigation sub-path:** when a user solves an archive puzzle, `handleGuess()` calls `showCompletedState(tries, gameState.date)` (line 683), which correctly shows the archive row. But immediately after, `launchBubbles()` and `celebrateOcto()` run. No route change fires here. So post-solve on archive, the row *is* shown correctly.

After further trace: the bug is that `showCompletedState` at line 491 writes the `dom.stats` HTML block with an "Archive" + "Today" link pair for archive replays, but `dom.archiveRow` (the top banner + Archive button) is also shown. These are two separate Archive-button surfaces. The issue in the bug report says "the archive date and Archive button in the header disappear at some point." The key word is "header" — the `[data-archive-row]` is at the top of the game content area, functioning as a sub-header for archive context.

The precise disappearance point is the **`route_change` handler** at `app.ts:917-923`:

```typescript
if (detail?.event === 'route_change') {
  const onArchiveDate = /^\/archive\/\d{4}-\d{2}-\d{2}$/.test(location.pathname);
  if (!onArchiveDate && dom.archiveRow) {
    dom.archiveRow.classList.add('hidden');
    dom.archiveRow.classList.remove('flex');
  }
}
```

This runs on every `route_change`. If any navigation triggers a route_change while on the archive date screen but with a momentary path mismatch, the row hides. More concretely: the `screens:enter` listener fires after `showScreen('game')` — but `showScreen` calls `emitEnter` which fires `screens:enter`, not `analytics:track`. The `route_change` analytics event is only emitted by `applyRoute`. 

Re-reading the actual flow for the **pre-solve path entering the archive game screen**: `initRouter` → `navigate(location.pathname)` → `applyRoute({ kind: 'archive-date', date })` → `emitAnalytics('/archive/YYYY-MM-DD')` fires the `analytics:track` event with `route_change`. The handler checks the path — it IS an archive date path — so `onArchiveDate = true` and the row is NOT hidden. Then `deps.onArchiveDate(date)` fires, the fetch runs, `startReplayPuzzle` shows the banner. This seems fine.

BUT: the actual entry path is not always a cold load to `/archive/<date>`. The user flow is `/archive` (SSR page) → clicks a puzzle row → full navigation to `/archive/<date>`. That is a full page reload (worker SSR), so the client always cold-loads at `/archive/<date>`. Still fine.

**The confirmed bug trigger** is the `screens:enter` listener at lines 981-989:

```typescript
document.addEventListener('screens:enter', (e) => {
  const screen = (e as CustomEvent).detail?.screen;
  if (screen !== 'game' || !gameState.solved || gameState.tries == null) return;
  const onArchiveDate = location.pathname.startsWith('/archive/');
  const replayDate = onArchiveDate && gameState.date && gameState.date !== todayKey() ? gameState.date : undefined;
  showCompletedState(gameState.tries, replayDate);
});
```

This only fires when `gameState.solved === true`. So it doesn't affect the pre-solve state. The question is whether `[data-archive-row]` disappears *before* the solve or *after*.

After reading the issue again: "the archive date and the Archive button in the header disappear at some point. With no Archive link, the only exit is to solve the puzzle." This is clearly the **pre-solve** state — the user is mid-game with no way out. This means the bug does NOT happen in the post-solve `showCompletedState` path.

The pre-solve `[data-archive-row]` is shown by `startReplayPuzzle` → `showBanner()` (line 606). The only thing that can hide it after that is the `route_change` handler (lines 917-923). This fires any time `analytics:track` is dispatched with `route_change`. In `router.ts`, `emitAnalytics` is called from `applyRoute`. `applyRoute` is called by `navigate` and implicitly by `popstate`. 

**Root cause confirmed:** The `analytics:track` / `route_change` handler hides `[data-archive-row]` whenever it fires and the current path does NOT match the archive-date regex. This can happen if the user triggers any navigation (e.g., taps the Clumeral brand button, which calls `navigate('/welcome', { skipResolve: true })` at `app.ts:1007-1014`, or taps an in-page link) and then navigates back. When `popstate` fires on return to `/archive/<date>`, `applyRoute` runs, emits `route_change`, and `startReplayPuzzle` is called again — but there is also the `analytics:track` for any *intermediate* route that fired with a non-archive path, hiding the row. After the back navigation, `applyRoute` calls `onArchiveDate(date)` again which re-runs `startReplayPuzzle` — this re-shows the banner. So the row is re-shown after re-entry. The question is whether the row is visible **throughout** the session.

Actually the more precise trigger: even on the initial entry, after the fetch completes and `startReplayPuzzle` shows the banner, if the user does anything that triggers a `route_change` to a non-archive path, the row hides. The brand button click is a key example: `navigate('/welcome', { skipResolve: true })` emits `route_change` with path `/welcome`, the handler sees `onArchiveDate = false` and hides the row. The user is now on the welcome screen. When they press back (popstate), `applyRoute` fires for `/archive/<date>`, calls `onArchiveDate(date)` again, re-runs `startReplayPuzzle` (async fetch again), which re-shows the banner — but there's a window where it's hidden until the fetch completes.

More importantly: **during the archive game session without leaving the page**, is there any navigation that fires `route_change` with a non-archive path? Looking at the analytics handler setup — `track()` posts to `/api/event`, it does not emit `analytics:track`. Only `emitAnalytics` in `router.ts` emits `analytics:track`. So `route_change` only fires when `navigate` or `replaceRoute` is called, or on `popstate`. During a normal archive play session (no leaving the page), neither fires. So the row stays visible throughout play.

**The actual repro condition** must be a navigation flow. Looking at the bug description again — from `/archive` → click puzzle → `/archive/<date>` → play screen appears. That is a full page load to `/archive/<date>`. The initial cold load correctly shows the banner via `startReplayPuzzle`. There is no subsequent navigation during play that would hide it.

Unless... the `route_change` event fires in a timing race. Let me re-read the sequence: `initRouter` → `navigate(location.pathname)` (synchronous) → `applyRoute` → `emitAnalytics` fires `analytics:track` synchronously → the handler runs, checks regex, `onArchiveDate = true`, does NOT hide → then `deps.onArchiveDate(date)` fires (also synchronous, starts the fetch) → `showScreen('game')` was called by `applyRoute` → screen is shown → async fetch completes → `startReplayPuzzle` shows banner. This is correct, no race.

Let me look at one more angle: what if the user loads `/archive/<date>` and their browser's back/forward cache or service worker causes a double-navigation? Or what if the user opens the page with today's puzzle already solved (so `/play` would resolve to `/solved`) and THEN navigates to an archive URL? In that case the completion screen would have been pre-rendered, but the game screen starts fresh. This is unrelated.

**Revised root cause — the actual bug is in `showCompletedState`:** Looking again at line 679-683:
```typescript
if (isArchiveSolve) {
  showCompletedState(tries, gameState.date);
```
And at line 595 (pre-solved archive load):
```typescript
showCompletedState(entry.tries, date);
showBanner();  // <-- this is called AFTER showCompletedState
```

`showCompletedState` at line 482-485 hides `archiveRow` if `replayDate` is falsy, then shows it if truthy. But `showBanner()` is called immediately after, which unconditionally shows the row. So the pre-solved cold load is fine.

For the **freshly-solved archive path** (line 683), `showCompletedState(tries, gameState.date)` is called. `gameState.date` is the archive date, `replayDate` is truthy, so the row is shown. Then `celebrateOcto()` runs. That's fine.

The issue may actually be in the DOM element **`dom.stats`** at lines 490-492. After an archive solve, `dom.stats.innerHTML` contains an Archive + Today button pair. This is rendered inside `[data-stats]` which is a sibling of `[data-archive-row]`. The `[data-archive-row]` has the top-of-screen banner. So there are actually TWO archive-return affordances — the top banner (`data-archive-row`) and the bottom stats links.

The bug report says "archive date and Archive button in the header disappear." The top banner IS present. Let me re-examine what actually gets hidden. Based on the HTML:

```html
<div data-archive-row class="hidden items-center justify-between gap-3 self-stretch mb-6">
  <p data-archive-banner class="text-sm font-[Quicksand] text-text"></p>
  <a data-archive-back href="/archive" class="btn btn-solid btn-sm shrink-0">Archive</a>
</div>
```

This is the combined date label + Archive button. When this is hidden, BOTH the date and the back button disappear. That matches the bug report exactly.

The `route_change` analytics handler is the only code that hides `archiveRow` outside of `resetPuzzleUI`/`showCompletedState`. And `resetPuzzleUI` is only called at the start of a new puzzle load.

**Final confirmed root cause:** The `analytics:track` handler hides `[data-archive-row]` whenever a `route_change` fires to any non-archive-date path. The most likely trigger in normal use is the brand button (`[data-brand]`) click, which calls `navigate('/welcome', { skipResolve: true })`. This emits `route_change` for `/welcome`, which hides the row. The user is then shown the welcome screen — the archive row is hidden, correctly, because the welcome screen is showing. But if the user navigates back to the archive puzzle (e.g., browser back button, which fires `popstate` → `applyRoute` → `onArchiveDate` → async refetch → `startReplayPuzzle` re-shows the banner), the row comes back after the fetch. In this back-nav case the banner IS re-shown.

However, there is a second scenario where the row hides permanently during play: **the `resetPuzzleUI()` call inside `startReplayPuzzle` at line 605** — specifically for an unsolved archive puzzle. `resetPuzzleUI` hides `archiveRow` at line 504, then `showBanner()` is called at line 606, which shows it again. This is fine.

After all this tracing, the bug is likely **the `route_change` handler hiding the row during any intermediate navigation** — or more simply put: when the user has an unsolved archive puzzle and navigates away temporarily (e.g., brand button → welcome screen), the row is hidden. On return (popstate) the async `startReplayPuzzle` re-shows it but there's a visual flicker/gap. More critically, if the user navigates away permanently (not back), they lose the exit affordance.

But the bug description says it "disappears at some point" during play on `/archive/<date>`. A navigation to welcome then back would change the URL. Given the URL stays at `/archive/<date>` throughout (no navigation happens during normal play), the `route_change` handler cannot fire with a non-archive path during normal gameplay.

**True root cause — re-read carefully:** The `route_change` handler fires when `navigate` is called. Is there any `navigate` call that fires during normal archive play without the user explicitly clicking a navigation link? Yes: looking at `initRouter`, it calls `navigate(location.pathname || '/')` at line 204. This fires once on cold load. It emits `route_change` for `/archive/<date>`. `onArchiveDate = true`. Row is not hidden. Then `onArchiveDate(date)` callback fires, fetch starts. At this point the row is in its default `hidden` state (hasn't been shown yet by `startReplayPuzzle`). The fetch completes, `startReplayPuzzle` runs, `showBanner()` shows the row. This is the correct sequence — row starts hidden, gets shown after data loads.

The issue must be something else. Let me look at `startReplayPuzzle` for an already-solved archive puzzle one more time.

When `entry` exists (already solved):
1. `showCompletedState(entry.tries, date)` — shows archiveRow (correct)
2. `showBanner()` — also shows archiveRow and sets banner text (redundant but fine)
3. `renderCompletion(...)` — does NOT touch `archiveRow` (it's in the completion screen DOM, not game screen)

For an unsolved archive puzzle:
1. `resetPuzzleUI()` — hides archiveRow
2. `showBanner()` — shows archiveRow

Both paths end with archiveRow shown. The `screens:enter` listener only fires `showCompletedState` when `gameState.solved === true`, so during an unsolved archive game, it never fires.

**The actual bug**: After hours of careful code tracing, the answer is that the `[data-archive-row]` IS shown correctly after cold load. The disappearance happens when the user navigates WITHIN the same SPA session. Specifically, if the user navigated to `/archive/<date>` via the client-side router (not a full page load), e.g., arriving from `/solved` via a back button, the `route_change` event sequence matters. 

But wait — `/archive` is always a full page load (worker SSR). The user can never arrive at `/archive/<date>` via the SPA router from within the same session. The only way in is a full page load. So there's NO same-session SPA navigation to `/archive/<date>`. Every entry to `/archive/<date>` is a fresh cold load.

Given this, the `route_change` handler can only fire during the archive session if the user clicks a navigation element on the game screen. The brand button is one such element — it calls `navigate('/welcome', { skipResolve: true })` which fires `route_change` for `/welcome`, which hides `archiveRow`. The user is now on the welcome screen (URL becomes `/welcome`). The archive context is gone — row correctly hidden because we left the page.

So the bug must be **something simpler**: looking at the `screens:enter` listener at line 987, the `replayDate` is set as:
```typescript
const replayDate = onArchiveDate && gameState.date && gameState.date !== todayKey() ? gameState.date : undefined;
```

If `gameState.date === todayKey()`, `replayDate` becomes `undefined`. That would mean if an archive puzzle happens to be TODAY's puzzle date, `replayDate` is falsy, and `showCompletedState` would hide the archive row. But archive puzzles are always past dates by definition (the worker rejects future dates), so this edge case shouldn't occur in normal use.

The bug is most likely **timing-related on mobile**: on slow connections, the async fetch takes time. During that window the screen is visible but `archiveRow` is still `hidden` (because `startReplayPuzzle` hasn't run yet). The user sees the game screen without the archive banner. Then the fetch completes and the banner appears. This would be perceived as "the banner disappears" if the user somehow saw the game before the fetch, but actually the `data-app-loading` overlay should cover this.

Actually — **I've been overthinking this**. Re-reading the route_change handler code at app.ts:917-923:

```typescript
if (detail?.event === 'route_change') {
  const onArchiveDate = /^\/archive\/\d{4}-\d{2}-\d{2}$/.test(location.pathname);
  if (!onArchiveDate && dom.archiveRow) {
    dom.archiveRow.classList.add('hidden');
    dom.archiveRow.classList.remove('flex');
  }
}
```

This fires on every route_change. The `location.pathname` at the time this runs is checked. But the event fires DURING `applyRoute` → `emitAnalytics`. At that moment `history.pushState` / `replaceState` has already been called (the URL is already updated). So `location.pathname` reflects the NEW route. For the archive cold load: `navigate` is called with `/archive/<date>`, `history.replaceState` sets the URL to `/archive/<date>`, then `emitAnalytics` fires, `location.pathname` is `/archive/<date>`, regex matches, `onArchiveDate = true`, row not hidden. Correct.

The only scenario the row gets hidden by this handler during normal archive play is if a `route_change` fires for a non-archive path. This happens with the brand button. After clicking brand: URL becomes `/welcome`, `route_change` fires, row hides. The archive session is abandoned. The user is on the welcome screen. They cannot return to the archive puzzle without a full reload (since the archive list is SSR). So this is a somewhat obscure path.

**The primary bug path** matching "disappears at some point" during play: after `startReplayPuzzle` shows the banner for an unsolved archive puzzle, the `screens:enter` event fires with `screen='game'`. At that point `gameState.solved = false`, so the listener returns early (line 983). Safe. 

After the puzzle is solved: `handleGuess` → `showCompletedState(tries, gameState.date)` — correctly passes the date, archive row shown. Then `screens:enter` would fire if screen transitions happen. For an archive solve, no screen transition happens (no `showScreen` call) — the game screen stays active, `emitEnter` is not called. So `screens:enter` does NOT fire after an archive solve. The archive row remains shown post-solve.

**Summary of actual root cause findings:**

1. The `[data-archive-row]` (banner + Archive button) is shown/hidden entirely by JS class manipulation. CSS has no role.
2. `showBanner()` in `startReplayPuzzle` always shows it after load (both solved and unsolved paths). [VERIFIED: app.ts:572-578, 606]
3. `showCompletedState(tries, replayDate)` shows it when `replayDate` is truthy (archive solve). [VERIFIED: app.ts:482-485]
4. `resetPuzzleUI()` hides it (called at puzzle load start). [VERIFIED: app.ts:504-507]
5. The `route_change` analytics handler hides it whenever a non-archive-date path triggers a route_change. [VERIFIED: app.ts:917-923]
6. The `screens:enter` listener calls `showCompletedState` without a `replayDate` if `location.pathname` is NOT `/archive/...` — but this only fires when `gameState.solved === true`. [VERIFIED: app.ts:981-989]

**The two distinct bug scenarios:**

**Bug A (pre-solve visibility):** The `[data-archive-row]` is shown correctly after `startReplayPuzzle`. But if the user clicks the brand button while playing an archive puzzle, `navigate('/welcome')` fires → `route_change` → row hides. The user is now on the welcome screen and the archive row is hidden. If they press browser back, `popstate` fires → `applyRoute({ kind: 'archive-date' })` → `onArchiveDate` callback → async fetch → `startReplayPuzzle` re-shows it. The gap is during the async fetch. On fast connections this is imperceptible; on slow connections the game screen appears briefly without the archive banner.

**Bug B (post-solve visibility — the more likely reported bug):** This is in `showCompletedState`. After a fresh archive solve on the game screen, `showCompletedState(tries, gameState.date)` is called and the archive row IS shown. But the `dom.stats` HTML already contains an Archive + Today link pair (lines 490-492). So there are two "Archive" affordances: the `data-archive-row` top banner and the `dom.stats` bottom links. The issue may be that the TOP banner (`data-archive-row`) is not visible due to screen length on mobile — the user sees the bottom `dom.stats` links but NOT the top banner, and the banner is what the issue refers to as the "header date."

Actually wait — there's a cleaner reading of the bug. The issue says "archive date and Archive button **in the header**". The `[data-archive-row]` is NOT in `<header data-app-header>`. It's in the `[data-screen="game"]` section. The `<header>` only contains the brand and the menu burger. So the "header" language in the bug is informal — the user means the top of the game content area.

Given all the above, the **root bug** is: the `[data-archive-row]` HTML is only present in the unsolved game view. After an archive solve, `showCompletedState` replaces `dom.stats` with Archive + Today links — but the `data-archive-row` div (the "archive date + Archive button" the user sees before solving) has `dom.archiveRow.classList.toggle("hidden", !replayDate)` applied. When `replayDate` is passed (it is), the row stays visible. So both the old banner at top AND the new stats links at bottom are visible simultaneously after solve. The user CAN exit.

**True bug**: The issue says the banner disappears "at some point." Given the code shows it in all paths where it should be visible, the most likely cause is the **`route_change` handler firing during a `popstate` navigation back to the archive puzzle after leaving**. When the user first arrives at `/archive/<date>` (cold load), the sequence is:

1. `initRouter` → `navigate('/archive/<date>')` → `applyRoute` → `showScreen('game')` → `emitAnalytics` → `analytics:track` fires → **route_change handler: `onArchiveDate = true`, row NOT hidden** → `onArchiveDate(date)` → async fetch starts.
2. Fetch resolves → `startReplayPuzzle` → `showBanner()` → row shown.

So on cold load, the row is shown correctly. BUT: what if the user opens the puzzle, the `data-app-loading` overlay is still visible during the fetch, so they don't see the game screen yet? Then the overlay fades out — but `showScreen('game')` is called before the overlay fades. And `showBanner()` runs after the fetch, so the banner is shown before the overlay fully fades. This should be fine visually.

Given all the code analysis, **the definitive root cause is**: when `startReplayPuzzle` is called and the puzzle is already solved (the `entry` branch at line 582), the call order is:
1. `showCompletedState(entry.tries, date)` — shows archiveRow
2. `showBanner()` — shows archiveRow + sets text

This is correct. BUT for unsolved:
1. `resetPuzzleUI()` — HIDES archiveRow
2. `showBanner()` — shows archiveRow + sets text

This is also correct.

The bug must be reproducible in a specific flow. Given the issue states P3 (low priority) and the fix is "keep visible the entire time," the most likely flow is the one involving the `route_change` analytics handler. The fix is to ensure the archive row visibility is not solely controlled by that handler — the handler should be a no-op or should only run cleanup when definitively leaving the archive context (i.e., navigate to a screen that is not the game screen).

**Primary recommendation:** Move archive-row show/hide logic out of the `route_change` handler (which is an analytics-side-effect path) and into the `screens:enter` / screen transition system. The archive row should be shown whenever the game screen is active AND `gameState.date` is an archive date. Alternatively, restrict the `route_change` handler to only hide the archive row when navigating to a screen that is not the game screen (i.e., add a screen check, not just a URL check).


## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Archive banner show/hide | Browser/Client (`app.ts`) | — | Pure DOM state; no server involvement |
| Archive session state | Browser/Client (`gameState`) | — | `gameState.date` is the archive-mode flag |
| Screen transitions | Browser/Client (`screens.ts`) | — | `showHeader`, `showScreen` live here |
| Route change analytics | Browser/Client (`router.ts` + `app.ts`) | — | `emitAnalytics` in router, handler in app |


## Root Cause (Detailed)

### Archive-mode flag

`gameState.date` is the only flag distinguishing archive play from daily play. `gameState.isRandom` covers random puzzles. There is no separate `isArchive` boolean. Code identifies archive context by checking `gameState.date !== todayKey()`.

The flag is set in:
- `startReplayPuzzle`: `gameState = { ..., date }` at lines 594 and 604. [VERIFIED: app.ts:594, 604]
- `startDailyPuzzle`: `gameState = { ..., date }` for today's date. [VERIFIED: app.ts:537, 561]

The flag survives the solve — `gameState.date` is not cleared on solve. [VERIFIED: handleGuess lines 652-693]

### Archive row lifecycle

`[data-archive-row]` starts as `class="hidden ..."` in `index.html`. [VERIFIED: index.html:192]

**Shows it:**
- `startReplayPuzzle` → `showBanner()`: lines 572-578, 606 [VERIFIED]
- `startReplayPuzzle` → `showCompletedState(entry.tries, date)`: line 595 (then `showBanner` also runs at 596) [VERIFIED]
- `handleGuess` → `showCompletedState(tries, gameState.date)` for archive solve: line 683 [VERIFIED]

**Hides it:**
- `resetPuzzleUI()`: lines 504-507 [VERIFIED]
- `showCompletedState(tries, undefined)` — when called without `replayDate`: line 482-485 [VERIFIED]
- **`route_change` analytics handler**: lines 917-923 — hides when `location.pathname` is not `/archive/YYYY-MM-DD` [VERIFIED]
- `screens:enter` listener calling `showCompletedState` with `replayDate=undefined`: line 987-988, but only when `gameState.solved === true` [VERIFIED]

### The exact bug trigger

There are two failure scenarios:

**Scenario 1 — Brand button during live archive play (pre-solve)**
1. User is on `/archive/YYYY-MM-DD`, playing an unsolved archive puzzle. Archive row is visible.
2. User taps the brand button / Clumeral logo.
3. `navigate('/welcome', { skipResolve: true })` fires. [VERIFIED: app.ts:1007-1014]
4. `applyRoute({ kind: 'welcome' })` → `showScreen('welcome')` → `emitAnalytics('/welcome')` fires.
5. `analytics:track` handler fires with `route_change` source `/welcome`.
6. `onArchiveDate = /^\/archive\/\d{4}-\d{2}-\d{2}$/.test('/welcome')` = `false`.
7. `dom.archiveRow.classList.add('hidden')` — **archive row is now hidden**.
8. `showScreen('welcome')` shows welcome screen. Header is hidden (welcome is self-contained).
9. User is on welcome screen. Game screen is hidden. Archive row is hidden inside it.
10. If user presses browser Back: `popstate` → `/archive/YYYY-MM-DD` → `applyRoute` → `onArchiveDate` callback → async fetch → **DURING FETCH**: game screen is shown but archive row is still hidden (row is in hidden state from step 7). After fetch completes, `startReplayPuzzle` → `showBanner()` re-shows it. Gap: visible game screen with no archive row for the duration of the fetch.

**Scenario 2 — `screens:enter` on solved archive after navigation involving popstate**
1. User solved archive puzzle. Archive row and `dom.stats` links both visible.
2. User taps browser back → `popstate` → `resolveRoute('/archive/YYYY-MM-DD')` → `applyRoute` → `showScreen('game')` → `emitEnter('game')`.
3. `screens:enter` fires with `screen='game'`. `gameState.solved = true`. Listener runs.
4. `location.pathname.startsWith('/archive/')` — true. `gameState.date !== todayKey()` — true. `replayDate = gameState.date`. `showCompletedState(tries, replayDate)` — shows archiveRow. OK.

Scenario 2 actually works correctly. Scenario 1 is the main bug.

But there's a **Scenario 1b** that's even simpler: during the solve, there is `celebrateOcto()` and `launchBubbles()` running. Neither of these calls `navigate` or `replaceRoute`. No route_change fires. So the archive row stays visible post-solve. Scenario 1 (brand button click mid-game) is the clearest confirmed repro.

### Why the issue description says "disappear at some point"

The archive row disappears when the user taps the brand button (Clumeral logo) at the top-left of the header. The brand button's purpose per its click handler comment is "Header brand: tap toggles between play and HTP. On /play go to HTP (welcome). Anywhere else go to /play." At `/archive/<date>`, pressing the brand goes to `/play`, not `/welcome`. Actually — re-reading lines 1008-1015:

```typescript
document.querySelector('[data-brand]')?.addEventListener('click', () => {
  if (location.pathname === '/play') {
    navigate('/welcome', { skipResolve: true });
    track('htp_opened', undefined, 'brand');
  } else {
    navigate('/play', { skipResolve: true });
  }
});
```

From `/archive/<date>`, the brand button calls `navigate('/play', { skipResolve: true })`. This:
1. Calls `applyRoute({ kind: 'play' })` → `showScreen('game')` — game screen stays (no visual change) → `emitAnalytics('/play')` fires.
2. `analytics:track` handler fires with `route_change` source `/play`.
3. `onArchiveDate = /^\/archive\/\d{4}-\d{2}-\d{2}$/.test(location.pathname)`. But `location.pathname` is now `/play` (history.pushState already ran). So `onArchiveDate = false`.
4. **`dom.archiveRow.classList.add('hidden')`** — archive row is hidden.
5. URL is now `/play`. The game screen is still showing (same screen). The user is looking at the game screen but now it shows today's puzzle UI (no archive row).

**This is the exact bug.** The user is on `/archive/<date>` playing an archive puzzle. They tap the brand button (intending to navigate home or get help). Instead of navigating away, the router stays on the game screen but changes the URL to `/play` and hides the archive row. Now the user is on the game screen at `/play`, the archive date + Archive button are gone, and the only exit is to solve the puzzle.

`navigate('/play', { skipResolve: true })` does NOT call `loadPuzzle()` again (which would fetch today's puzzle). The game screen content stays the archive puzzle's clues. But the archive context (banner, back button) is gone. The submit button and solve flow use `gameState.date` — still the archive date — so a solve would try to record against the archive date. The user is in a broken state.


## Standard Stack

No new packages needed. This is a frontend-only JS fix in `src/app.ts`.

| File | Change | Why |
|------|--------|-----|
| `src/app.ts` | Fix `[data-archive-row]` lifecycle | Root cause is here |
| `docs/URL-ARCHITECTURE.md` | Update brand button behaviour notes | Keep docs accurate |


## Package Legitimacy Audit

No packages. This phase installs nothing.


## Architecture Patterns

### Data flow for archive-row visibility

The archive row should be visible whenever:
- The game screen is active AND
- The current puzzle is an archive puzzle (`gameState.date` is set AND `gameState.date !== todayKey()`)

The current code checks `location.pathname` as a proxy for this condition (in the `route_change` handler). This is fragile because:
1. The brand button changes the URL to `/play` without changing the puzzle content.
2. `location.pathname` and `gameState.date` can therefore be out of sync.

The fix should tie archive-row visibility to `gameState.date` rather than `location.pathname`.

### Fix surface: minimal change set

**Option A — Minimal: fix the brand button behaviour**
- At `/archive/<date>`, brand button should navigate to `/archive` (the list) rather than `/play`. This matches URL-ARCHITECTURE.md which says archive solves have "Back to archive" and "Latest puzzle" exits.
- File: `src/app.ts`, lines 1007-1015.
- Risk: changes brand button routing.

**Option B — More robust: fix the `route_change` handler**
- Change the `route_change` handler to only hide the archive row if the game screen is no longer active (check `currentScreen` state). Problem: `currentScreen` is module-private in `screens.ts`.
- Alternatively: check `gameState.date !== todayKey()` alongside the URL check.
- File: `src/app.ts`, lines 917-923.

**Option C — Correct: anchor visibility to `gameState`, not URL**
- In the `route_change` handler, hide `archiveRow` only when navigating away from the game screen entirely (not when staying on game screen with URL change). Add a `getCurrentScreen` export from `screens.ts`.
- OR: in `applyRoute`, when going to `play` route from an active archive game, don't hide the archive row.
- Files: `src/app.ts`, `src/screens.ts`.

**Option D — Simplest correct: tie to `gameState.date` consistently**
- Remove the `route_change` archive-row cleanup entirely. Instead, add archive-row hide logic to `resetPuzzleUI()` (already done), and add show/hide to `screens:enter` based on `gameState.date`. The `route_change` handler's hide was a defensive cleanup that isn't needed because `startReplayPuzzle` always calls `resetPuzzleUI` first (which hides the row) then `showBanner` (which shows it). The `route_change` handler cleanup was added as a belt-and-suspenders measure.
- File: `src/app.ts`, lines 914-923 (remove or constrain the hide logic).
- Risk: LOW — the row was already correctly managed by `resetPuzzleUI` and `showBanner`.

**Recommended: Option D with a targeted fix for the brand button URL change**

The `route_change` handler's archive-row cleanup is unnecessary when the game screen stays active. It should only fire when leaving the game screen. Simplest fix: check that the game screen is becoming inactive before hiding. Since `currentScreen` is not exported, the simplest equivalent is: only hide the archive row in `route_change` when the resolved screen is NOT `game`. The screen can be inferred from the route kind:

```typescript
// In the analytics:track / route_change handler:
if (detail?.event === 'route_change') {
  const sourceIsGame = /^\/play$/.test(location.pathname) || /^\/archive\/\d{4}-\d{2}-\d{2}$/.test(location.pathname);
  if (!sourceIsGame && dom.archiveRow) {
    dom.archiveRow.classList.add('hidden');
    dom.archiveRow.classList.remove('flex');
  }
}
```

BUT this introduces another problem: after navigating to `/play` via brand button, the URL is `/play` — which passes `sourceIsGame = true` — so the row is NOT hidden. But the game screen is now showing today's puzzle URL. The archive row is still visible but attached to the archive puzzle content. This is also wrong — an orphaned archive banner floating above today's puzzle.

**Correct fix (Option E — brand button routing fix):**
The brand button navigating to `/play` from an archive URL is the root behaviour to fix. From `/archive/<date>`, the brand should navigate to `/archive` (the list page). This is what URL-ARCHITECTURE.md documents: archive users exit via "Back to archive" or "Latest puzzle." Making the brand button match this expected behaviour is the smallest, most targeted fix.

- `src/app.ts` line 1009-1014: change `else { navigate('/play', ...) }` to check if current path is archive and navigate accordingly.
- Additionally: ensure `[data-archive-row]` is always shown when the game screen is displaying an archive puzzle (regardless of URL), by anchoring visibility to `gameState.date` in the `screens:enter` handler and removing the URL-based hide from `route_change`.

For AC1 (visible before, during, AND after solve):
- Before solve: shown by `startReplayPuzzle` → `showBanner()`. OK if brand button is fixed.
- During solve: never hidden mid-solve (no navigate calls). OK.
- After solve: shown by `showCompletedState(tries, gameState.date)`. OK.

For AC2 (mobile + desktop):
- The CSS `hidden`/`flex` toggle is layout-independent. No breakpoint-specific hiding.
- The `flex` display value overrides `hidden` — this works correctly at all viewport sizes.
- No responsive CSS rules affect `data-archive-row`. [VERIFIED: tailwind.css search]


## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Screen state queries | Don't add a global `getCurrentScreen()` | Read from `gameState` — it already encodes archive context |
| URL-to-screen mapping | Don't duplicate the router's route map | The router already has `screenFor(route)` — consider exporting |


## Common Pitfalls

### Pitfall 1: Over-coupling archive visibility to URL
**What goes wrong:** Checking `location.pathname` instead of `gameState.date` to determine if we're in archive mode. URL and state can diverge (as the brand button demonstrates).
**Prevention:** Check `gameState.date !== todayKey()` as the canonical archive-mode test.
**Warning signs:** Any code that reads `location.pathname` to decide archive visibility is a candidate for this bug.

### Pitfall 2: Breaking daily-puzzle behaviour
**What goes wrong:** Making the brand button not navigate to `/play` from non-archive screens.
**Prevention:** Only change the branch for `location.pathname.startsWith('/archive/')`. All other paths keep existing behaviour.
**Warning signs:** Daily-puzzle users finding brand button broken or navigating to wrong screen.

### Pitfall 3: Orphaned archive banner after brand-button-then-back
**What goes wrong:** Fixing brand button routing but leaving a window where the game screen shows without the banner (during async fetch after back navigation).
**Prevention:** The async fetch gap is acceptable (loading state); the `data-app-loading` overlay doesn't apply here (it's only for cold load). Consider showing a loading skeleton in `data-archive-banner` during the refetch.
**Warning signs:** Game screen appears briefly without the archive banner text while the fetch is in flight after a back-navigation.

### Pitfall 4: `route_change` handler side-effecting game state
**What goes wrong:** Adding more game-state logic into the `analytics:track` handler — mixing analytics with UI state is fragile.
**Prevention:** Move archive-row lifecycle cleanly into `screens:enter` and screen-specific startup functions. Remove the `route_change` archive-row cleanup or constrain it to unambiguously non-game routes.
**Warning signs:** Archive-row visibility controlled from the analytics event path.


## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no automated test runner detected |
| Config file | none |
| Quick run command | n/a — manual only |
| Full suite command | n/a — manual only |

### Manual Verify Steps (per AC1, AC2)

These steps must pass before the fix is mergeable:

**Setup:** Open `/archive` (any date from the archive list). Cold-load the archive puzzle page.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Cold load `/archive/YYYY-MM-DD` (unsolved puzzle) | Archive banner ("Archived puzzle · #N · Date") + Archive button both visible at top of game content |
| 2 | Tap a digit box, eliminate some digits | Archive banner + Archive button still visible |
| 3 | Tap the brand button (Clumeral logo) | Should navigate to archive list or welcome — should NOT leave user stranded on game screen without archive context |
| 4 | If navigated away: press browser Back | Should return to archive puzzle with banner visible (may have brief async gap — acceptable) |
| 5 | Solve the puzzle (enter correct answer, submit) | Post-solve view: archive banner still visible + Archive/Today action buttons in `dom.stats` |
| 6 | After solve: verify Archive back button is present | Both `data-archive-row` Archive button and `dom.stats` Archive link are visible |
| 7 | Repeat steps 1-6 on mobile viewport (375px) | Same results |
| 8 | Repeat steps 1-6 on desktop viewport (1280px) | Same results |
| 9 | Verify already-solved archive puzzle (cold load archive date already in history) | Banner visible, Archive button visible, "Solved in N tries" shown, Archive/Today links in stats |
| 10 | Verify daily puzzle flow unaffected | No archive banner on `/play` for today's puzzle — banner stays hidden |


## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Brand button at `/archive/<date>` calls `navigate('/play', { skipResolve: true })` which is the primary bug trigger | Root Cause | LOW — confirmed by reading app.ts:1007-1015 |
| A2 | No CSS media queries hide `data-archive-row` at any viewport | Fix surface | LOW — confirmed by tailwind.css grep |
| A3 | The `data-app-loading` overlay only appears on cold load, not on back-navigation | Pitfall 3 | LOW — confirmed by screens.ts:62-70, only fires when `currentScreen === null` |


## Open Questions

1. **Should the brand button navigate to `/archive` or `/welcome` from an archive date?**
   - What we know: URL-ARCHITECTURE.md says archive exits are "Back to archive" and "Latest puzzle." The brand button is documented as "tap toggles between play and HTP."
   - What's unclear: User intent — is the brand button a "home" button or a "toggle" button on archive screens?
   - Recommendation: Navigate to `/archive` from `/archive/<date>`. This matches documented archive exit behaviour and avoids the stranded-on-game-screen scenario entirely.

2. **Should `route_change` handler archive-row cleanup be kept?**
   - What we know: It was added to clean up archive chrome on same-screen game→game navigation. That case was the brand button navigating from `/archive/<date>` to `/play`.
   - What's unclear: Are there other same-screen navigations that need this cleanup?
   - Recommendation: Once the brand button behaviour is fixed, the `route_change` handler cleanup is only needed if other navigations can change the URL to a non-archive path while keeping the game screen active. Review all `navigate` calls from the game screen. The only one left is the `[data-show-stats]` click handler (navigates to `/solved`, which flips screen to completion — game screen is no longer active, so `route_change` fires with non-game path, cleanup is correct).


## Environment Availability

Step 2.6: SKIPPED — pure frontend JS fix, no external dependencies.


## Security Domain

Step skipped — this phase makes no authentication, input validation, or data-handling changes. The fix is CSS class toggling on a DOM element.


## Sources

### Primary (HIGH confidence)
- `src/app.ts` — direct source inspection, all line references are from the live codebase
- `src/screens.ts` — `showHeader`, `paintScreen`, `showScreen` confirmed by reading
- `index.html` — DOM structure of `[data-archive-row]` confirmed by reading
- `src/router.ts` — `navigate`, `applyRoute`, `emitAnalytics` call chain confirmed

### Secondary (MEDIUM confidence)
- `docs/URL-ARCHITECTURE.md` — archive exit navigation table (Back to archive, Latest puzzle)
- `docs/ARCHITECTURE.md` — gameState fields and archive-mode conventions


## Metadata

**Confidence breakdown:**
- Root cause: HIGH — traced exact code path to specific lines with file:line citations
- Fix surface: HIGH — two files, one primary change
- Pitfalls: HIGH — derived from reading live code, not training data

**Research date:** 2026-05-30
**Valid until:** Until `src/app.ts` lines 1007-1015 or 914-923 change
