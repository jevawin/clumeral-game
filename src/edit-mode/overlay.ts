// Clumeral edit mode — the entry point, and the only file the injected script
// names.
//
// Everything else in this directory is a piece; this is what wires them into a
// tool. Nothing in the game imports it and it imports nothing from the game, so
// `vite build` never reaches it (brief item 60).

import { createPanel } from './panel.ts';
import { createControls } from './controls.ts';
import { createInterceptor } from './intercept.ts';
import { createCatalogue, type FamilyMap } from './catalogue.ts';
import { createHistory, nextBackAction } from './history.ts';
import { createSessionStore } from './session-store.ts';
import { applyClass, removeClass, existingConflicts } from './families.ts';
import { step } from './scale.ts';
import { project, breadcrumbOf, findByBreadcrumb, mergeProjections } from './project.ts';
import { readActual, detectOverwrites } from './runtime-classes.ts';
import {
  ancestry, crumb, isOverlay, elementAtPoint, nav, computedSnapshot, didNothing,
} from './select.ts';
import { captureEnvironment, type Patch } from './patches.ts';
import {
  signature, exitDecision, stopOutcome, controlRowState,
  countPatches, includesCssPatch, hasSomethingToSave, hasSomethingToDiscard,
  discardClosingLine,
} from './pending.ts';
import { COPY, conflictWarning } from './copy.ts';

const CATALOGUE_URL = '/__edit-mode/catalogue.json';
const REPLAY_URL = '/__edit-mode/replay.json';
const DONE_URL = '/__edit-mode/session';
// Repeated rather than imported: edit-mode/ is the Node side and the browser
// cannot reach it. This literal and SHUTDOWN_ROUTE must stay in step, and
// tests/edit-mode-safety.spec.ts asserts this exact string is absent from every
// build.
const SHUTDOWN_URL = '/__edit-mode/shutdown';

async function start(): Promise<void> {
  // NOT document.currentScript: that is null in a module script, always, so the
  // branch never arrived and every branch shared one saved patch set under
  // `clumeral_edit_unknown` - exactly what keying it to the branch was for.
  const script = document.querySelector<HTMLScriptElement>('script[data-branch]');
  const branch = script?.dataset.branch || 'unknown';

  const panel = createPanel(document);

  // TEMPORARY DIAGNOSTIC — brief item 74, delete once the app-switch cause is
  // settled. Counts how many times this script has run in this tab. Switch away
  // from Safari and back: if the number goes UP the page reloaded, so the cause
  // is a reload (vite, a discarded tab, or the service worker). If it stays PUT
  // nothing reloaded and the re-projection is the only suspect left.
  //
  // sessionStorage rather than a variable, deliberately: it is what survives a
  // reload and a Safari tab discard, which is the whole question being asked.
  // navigation.type says WHICH kind of load this was, so one glance answers both
  // "did it reload" and "how".
  const LOAD_COUNT_KEY = 'dlng_edit_loads';
  const loads = Number(sessionStorage.getItem(LOAD_COUNT_KEY) ?? '0') + 1;
  sessionStorage.setItem(LOAD_COUNT_KEY, String(loads));
  const navType =
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type
    ?? 'unknown';
  panel.notify(`loads: ${loads} (${navType})`);

  // The pencil is drawn the moment the panel mounts, but everything it needs
  // arrives over two fetches - one of them the whole 23,000-class catalogue.
  // Tapped in that gap it used to do nothing at all, silently (Jamie,
  // 2026-08-27: "seems functionally flakey"). So take the tap now and hold it.
  let toggleMode: (() => void) | null = null;
  let toggleWaiting = false;
  panel.onToggle(() => {
    if (toggleMode) toggleMode();
    else toggleWaiting = true;
  });

  const store = createSessionStore(branch, sessionStorage);
  const saved = store.load();
  let freeCss = saved.freeCss;
  let savedSignature = saved.savedSignature;
  /**
   * Has a session file been written for this run?
   *
   * Read from the STORE at boot, not started at false, because the tab discard
   * this whole brief is about would reset an in-memory boolean and Discard
   * would then tell Jamie nothing had been banked when a session was sitting
   * on the Pi (rev 2, R12). Only Discard's closing line reads it.
   *
   * Not derived from savedSignature at the moment of use: Discard resets that
   * to signature([], ''), which is not empty, so a second Discard after a
   * failed shutdown would claim a session that was never written.
   */
  let sessionsBanked = saved.savedSignature !== '';
  // Set once the server has gone. Stops persist() writing the session back
  // after store.clear(), and stops the pill being shown again for a dead
  // server (brief item 42).
  let stopped = false;
  // A save or a stop is in flight. Without this a second tap while the first
  // POST is outstanding re-enters — isPending() is still true, because the
  // signature has not been recorded yet — and writes a second identical session
  // file. There is no in-flight feedback on a phone, which is exactly the
  // condition that produces the second tap.
  let busy = false;
  const history = createHistory();
  history.restore(saved.entries);

  let mode: 'play' | 'edit' = saved.mode;
  let selected: Element | null = saved.selected
    ? findByBreadcrumb(document, saved.selected)
    : null;
  /**
   * The selected element's identity, FROZEN when it was selected.
   *
   * Not recomputed per change, and that is load-bearing. A crumb is written
   * `tag.firstClass`, so removing or replacing an element's first class renames
   * it: the second change to the same element would record a DIFFERENT target,
   * giving one element two history entries, a projection with a stale key, and
   * a session file naming an element /fold cannot grep. Freezing it at
   * selection also means the recorded breadcrumb describes the element as
   * SOURCE still has it, which is what /fold needs.
   */
  let selectedPath: string | null = saved.selected;
  /**
   * Classes switched OFF, per element.
   *
   * Jamie's design: a chip is toggled rather than removed, so the class stays
   * listed and greyed out and one more tap brings it back. Held here rather
   * than in the DOM, because the class is genuinely absent from the element
   * while it is off — that is the whole point of switching it off.
   */
  const switchedOff = new Map<string, Map<string, number>>();

  /** Switched-off class -> the position it held, so it goes back where it was. */
  function offFor(path: string | null): Map<string, number> {
    if (!path) return new Map();
    let held = switchedOff.get(path);
    if (!held) { held = new Map(); switchedOff.set(path, held); }
    return held;
  }

  /**
   * The chip order: the element's classes, with the switched-off ones held in
   * the slots they came from.
   *
   * Jamie, 2026-08-29: "tapping them on off or -+ing them often moves them
   * around in the class list, it's really jumpy and janky".
   */
  function chipOrder(current: string[]): string[] {
    const order = [...current];
    const held = [...offFor(selectedPath)].sort((a, b) => a[1] - b[1]);
    for (const [name, index] of held) {
      if (!order.includes(name)) order.splice(Math.min(index, order.length), 0, name);
    }
    return order;
  }
  /**
   * Put the edits back after the page comes back.
   *
   * Jamie, 2026-08-24: "navigating away from and back to Safari resets
   * everything." The patch set survives — session-store.ts is tested — but
   * src/router.ts listens for `visibilitychange` and `focus` and re-renders the
   * screen, which rebuilds the DOM and throws the edits away. Nothing put them
   * back, because re-projection only ran on undo.
   *
   * Re-projecting here is the same one-line answer as everywhere else: the
   * patch set is the truth and the DOM is a projection of it.
   */
  let projecting = false;

  /**
   * Dave's replay, HELD rather than applied once.
   *
   * Held because every re-render needs it again. Applied once and forgotten,
   * the first time the game rebuilt the screen reproject() would put the live
   * history back and quietly drop every replay-only breadcrumb with it.
   *
   * Empty until the fetch resolves, which is why merging with it is safe from
   * the very first paint.
   */
  let replayProjection: ReadonlyMap<string, string[]> = new Map();

  /**
   * Is the sheet's contents built yet?
   *
   * draw() calls controls.render(), and `controls` is a const created after the
   * catalogue fetch. This function now runs BEFORE that fetch, so calling
   * draw() early would throw a ReferenceError inside a requestAnimationFrame
   * callback — swallowed, invisible, and on a phone (brief item 116).
   *
   * The projection itself needs nothing but the history, so it runs regardless.
   * That is the half that matters: the edits go back on the page.
   */
  let controlsReady = false;

  function reproject(): void {
    if (projecting) return;
    projecting = true;
    try {
      project(document, mergeProjections(replayProjection, history.projection()));
      if (selectedPath) selected = findByBreadcrumb(document, selectedPath);
      if (!controlsReady) return;
      draw();
    } finally {
      projecting = false;
    }
  }

  /**
   * Re-apply whenever the game rebuilds the page under us.
   *
   * Jamie, 2026-08-26: coming back to Safari "returns to a semi previous state
   * but with elements deselected." The cause is a race, not lost data. The
   * overlay's script runs BEFORE the app entry on purpose, and start() then
   * awaits three fetches — so by the time it restores the patch set and looks
   * up the selected element, the game has usually not rendered yet. It resolves
   * against markup that does not exist, projects onto nothing, and the load
   * event it was waiting for has long since fired.
   *
   * Watching the document answers all of it: whenever the game finishes
   * rendering — first paint, a route change, or a wake-from-background
   * re-render — the edits go back on and the selection is found again. The
   * guard above stops our own writes retriggering it.
   */
  const observer = new MutationObserver(() => {
    // Nothing of ours on the page means nothing to put back. The replay counts
    // as ours: it is what Dave's sessions changed, and it has to survive a
    // re-render even when Jamie's own history is empty.
    if (projecting || (history.entries.length === 0 && replayProjection.size === 0)) return;
    scheduleReproject();
  });

  let pending = 0;
  function scheduleReproject(): void {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      reproject();
    });
  }

  observer.observe(document.body, { childList: true, subtree: true });

  // FIRST PAINT. The restored history goes on now, before a single byte is
  // fetched. The game has usually not rendered yet, so this call is often a
  // no-op and that is fine (brief item 118) — the observer above is what
  // catches the render, and it is watching from here on.
  reproject();
  // And a way to STOP the server, in the same window. Everything the row needs
  // is above this line now, and the catalogue fetch is the 23,000-class file
  // this task exists to stop waiting for — leaving Discard, which is also the
  // stop button, absent for the whole of it.
  syncControlRow();

  // Everything above this line runs before the two fetches, and that is the
  // whole of brief item 129's fix: the edits used to be restored only AFTER the
  // catalogue arrived, which on a phone is two network round trips and the
  // whole 23,000-class file. Jamie switched back to Safari, watched the game
  // paint bare, and then watched his edits appear on top of it — the "refresh"
  // he reported. They now land on first paint.
  //
  // Dave's replay still has to wait for its fetch, because it lives on the
  // server. It is merged in when it arrives rather than projected over the top
  // (brief item 117).
  const replay = await fetch(REPLAY_URL).then((r) => r.json()).catch(() => null);
  if (replay?.projection) {
    replayProjection = new Map(Object.entries(replay.projection as Record<string, string[]>));
    project(document, mergeProjections(replayProjection, history.projection()));
  }
  const { classes, families } = await fetch(CATALOGUE_URL)
    .then((r) => r.json())
    .catch(() => ({ classes: [], families: {} as FamilyMap }));
  const catalogue = createCatalogue(classes, families);

  const interceptor = createInterceptor(document, {
    isOwnUi: (target) => isOverlay(target as Node | null),
    onPointer: (event) => {
      // While the picker is up it covers the panel, and a tap that lands
      // outside it must NOT reselect — that is what dropped the selection on
      // the way to adding a class, so the class then had nowhere to go
      // (Jamie, 2026-08-27: "seems functionally flakey").
      if (controls.pickerOpen) return;
      const found = elementAtPoint(document, event.clientX, event.clientY);
      // A tap that resolves to nothing is a tap on empty space. Keeping the
      // current selection is friendlier than silently clearing it.
      if (found) select(found);
    },
    onKey: (event) => {
      if (event.key === 'Escape') setMode('play');
    },
  });

  /**
   * Shorten the page so it can be scrolled clear of the sheet.
   *
   * Jamie, 2026-08-25: "needs to make the actual viewport above the edit window
   * shorter and scroll the full way down." The sheet is fixed over the bottom of
   * the page, so without this the last screenful of content can never be reached
   * — and it is usually the part being edited.
   *
   * An INLINE STYLE on <body>, deliberately: patches only ever record class
   * lists, so this cannot leak into the session file and reach /fold as though
   * Jamie had asked for it.
   */
  function fitPageToSheet(): void {
    const height = mode === 'edit' ? panel.sheetHeight() : 0;
    document.body.style.paddingBottom = height ? `${Math.ceil(height)}px` : '';
  }

  /**
   * Keep the sheet above the on-screen keyboard.
   *
   * iOS shrinks the VISUAL viewport when the keyboard opens and leaves the
   * layout viewport alone, so anything at `bottom: 0` ends up underneath it.
   * visualViewport is the only thing that knows how much room is really left.
   */
  function trackKeyboard(): void {
    const vv = window.visualViewport;
    if (!vv) return;
    const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    panel.setViewport(inset, vv.height);
    fitPageToSheet();
  }

  function persist(): void {
    // Once the server has stopped there is nothing left to come back to, and
    // writing here would undo store.clear() on the next setMode or select —
    // handing the next /dev a session that has already been saved.
    if (stopped) return;
    store.save({
      entries: [...history.entries], mode, selected: selectedPath,
      savedSignature, freeCss,
    });
  }

  /**
   * Push the control row's state to the panel. The ONLY thing that does.
   *
   * panel.setMode does not touch these controls, so if this is not called they
   * are shown once at startup and never again. It has to run after anything
   * that changes whether there is something to save, which is why draw() ends
   * with it.
   */
  function syncControlRow(): void {
    // Two different questions, and they diverge after a save: nothing left to
    // save, but a screenful of edits still there to lose (rev 2, H2).
    panel.setRow(
      controlRowState(stopped, isPending(), busy),
      hasSomethingToDiscard(patchCount()),
    );
  }

  /** Is anything selected? The free-CSS patch needs somewhere to hang. */
  function hasSelection(): boolean {
    return selected !== null && selectedPath !== null;
  }

  /** How many patches a save would post right now. */
  function patchCount(): number {
    return countPatches(history.entries.length, freeCss, hasSelection());
  }

  /**
   * Is there anything worth posting?
   *
   * The signature alone was not enough (brief items 76, 121). A fresh session
   * starts with savedSignature '' while the signature of an empty history is
   * '||', so they differed from the first second: the pencil posted an empty
   * session file and, with nothing yet written, the tool wedged. Undoing every
   * edit after a save reached the same place by a different road.
   */
  function isPending(): boolean {
    return hasSomethingToSave(
      patchCount(),
      signature(history.entries, freeCss) !== savedSignature,
    );
  }

  function draw(): void {
    // Brief item 61, and Jamie's first report: show which element you are on.
    panel.highlight(
      mode === 'edit' ? selected : null,
      selected ? crumb(selected) : ''
    );
    // Which classes this session added, so the chips can say so.
    const original = selectedPath ? history.originalOf(selectedPath) ?? [] : [];
    const current = selected ? [...selected.classList] : [];

    controls.render({
      crumbs: selected ? ancestry(selected).map(crumb) : [],
      classes: current,
      added: current.filter((name) => !original.includes(name)),
      off: [...offFor(selectedPath).keys()],
      order: chipOrder(current),
      // The raw field and free-CSS box are a desktop affordance (brief item 34).
      desktop: window.matchMedia('(min-width: 768px)').matches,
      // Undo and Reset only appear when they would do something (item 134).
      // Reset asks whether THIS element has an original recorded, because that
      // is exactly what onResetElement needs to find.
      hasSelection: selected !== null,
      canUndo: history.entries.length > 0,
      elementChanged: selectedPath !== null && history.originalOf(selectedPath) !== undefined,
    });
    // Save appears and disappears with there being something to save, so the
    // row has to be pushed on every redraw, not only on a mode change.
    syncControlRow();
    // After the sheet has been laid out, so the measurement is the real one.
    requestAnimationFrame(fitPageToSheet);
  }

  function select(el: Element): void {
    selected = el;
    selectedPath = breadcrumbOf(el);
    // The outline is drawn in page coordinates, so it has to follow the page.
    el.scrollIntoView({ block: 'nearest' });
    // Brief item 42: a pair already fighting in the markup is surfaced, not
    // tidied away. Anything changed there will look unpredictable.
    const conflicts = existingConflicts([...el.classList], families);
    panel.say(conflicts.length ? conflictWarning(conflicts) : '');
    draw();
    persist();
  }

  /** Apply a new class list to the selected element and log it as one change. */
  function change(
    next: string[],
    property: string,
    kind: 'classes' | 'raw' = 'classes',
    typed?: string
  ): void {
    if (!selected || !selectedPath) return;
    const target = selectedPath;
    const before = [...selected.classList];
    const wasComputed = computedSnapshot(window, selected);

    selected.className = next.join(' ');

    // Brief item 99: anything outside the built set fails silently unless we
    // look. Covers the raw field and any typo, which search cannot protect.
    if (didNothing(wasComputed, computedSnapshot(window, selected))) {
      panel.say(COPY.classNotInBuild);
    }

    // A new history entry means a new back step; a collapsed one must not push,
    // or back gets an entry with nothing behind it.
    if (history.record({ target, before, after: next, property, kind, typed }, Date.now())) {
      window.history.pushState({ clumeralEdit: history.entries.length }, '', location.href);
    }
    draw();
    persist();
  }

  const controls = createControls(document, panel.sheet, catalogue, {
    onCrumb: (index) => {
      if (selected) select(ancestry(selected)[index]);
    },
    onNav: (direction) => {
      if (!selected) return;
      const next = direction === 'parent' ? nav.parent(selected)
        : direction === 'child' ? nav.firstChild(selected)
        : direction === 'prev' ? nav.previous(selected)
        : nav.next(selected);
      if (next) select(next);
    },
    onToggleClass: (name) => {
      if (!selected || !selectedPath) return;
      const off = offFor(selectedPath);
      const property = (families[name] ?? [name]).join(', ');

      const current = [...selected.classList];
      if (off.has(name)) {
        // Back on, in the slot it left - not appended to the end.
        const index = Math.min(off.get(name) ?? current.length, current.length);
        off.delete(name);
        const back = [...current];
        back.splice(index, 0, name);
        change(back, property);
      } else {
        off.set(name, current.indexOf(name));
        change(removeClass(current, name), property);
      }
    },
    onAddClass: (name) => {
      if (selected) {
        change(applyClass([...selected.classList], name, families), (families[name] ?? [name]).join(', '));
      }
    },
    onStep: (name, direction) => {
      if (!selected) return;
      const next = step(catalogue, name, direction);
      // No next step means the edge of the scale, which is information rather
      // than an error (brief item 10). Say nothing and let him tell us in words.
      if (!next) return;
      // NOT removeClass first: applyClass puts the replacement in the slot the
      // old class held, and pre-removing it left nothing to collide with, so
      // the stepped class jumped to the end on every tap.
      const swapped = applyClass([...selected.classList], next, families);
      change(swapped, (families[name] ?? [name]).join(', '));
    },
    onUndo: () => backOneStep(),
    onResetElement: () => {
      if (!selected) return;
      // From the history rather than a separate map, so it still works after a
      // reload — which is exactly when someone reaches for Reset.
      const original = selectedPath ? history.originalOf(selectedPath) : undefined;
      if (original) change(original, 'reset');
    },
    onRawClasses: (value) => {
      if (!selected) return;
      // The kind and the typed string ride on THIS change only.
      change(value.split(/\s+/).filter(Boolean), 'raw', 'raw', value);
    },
    // The box is a patch, so typing in it can make Save appear.
    onFreeCss: (value) => { freeCss = value; persist(); syncControlRow(); },
    onSearchFocus: (focused) => {
      // Brief item 33: scroll the element clear so the keyboard cannot cover
      // the very thing being edited.
      if (focused && selected) selected.scrollIntoView({ block: 'center' });
    },
  });
  // From here draw() is safe, so re-projection can redraw the sheet as well as
  // the page. Everything before this point projected and returned.
  controlsReady = true;


  function setMode(next: 'play' | 'edit'): void {
    const leavingEdit = mode === 'edit' && next === 'play';
    mode = next;
    panel.setMode(next);
    if (next === 'edit') interceptor.enable();
    else interceptor.disable();
    syncControlRow();

    // Brief item 109: returning from play mode is the only moment the game has
    // actually rendered, so it is the only moment this check can fire.
    if (!leavingEdit) {
      const expected = history.projection();
      const overwrites = detectOverwrites(expected, readActual(document, expected.keys()));
      if (overwrites.length) panel.say(COPY.runtimeControlled);
    }
    draw();
    persist();
  }

  function backOneStep(): void {
    const undone = history.undo();
    if (!undone) return;
    // Re-project rather than restoring one element: if the router rebuilt the
    // DOM, this puts the remaining edits back too (brief item 67).
    const projection = history.projection();
    const el = findByBreadcrumb(document, undone.target);
    if (el) el.className = undone.before.join(' ');
    project(document, projection);
    draw();
    persist();
  }

  /** @returns true when the session was actually written. */
  async function save(): Promise<boolean> {
    // The server has gone; there is nothing to post to and nothing left to
    // post. Reporting failure here would tell Jamie to "check the dev server is
    // running" moments after telling him it had stopped.
    if (stopped) return false;
    const patches: Patch[] = history.entries.map((entry) => {
      const el = findByBreadcrumb(document, entry.target);
      return {
        kind: entry.kind ?? 'classes',
        breadcrumb: entry.target,
        tag: el?.tagName.toLowerCase() ?? '',
        text: el?.textContent?.trim().slice(0, 40) ?? '',
        before: entry.before,
        after: entry.after,
        // Only a raw change carries what was typed, and only its own (item 96).
        ...(entry.kind === 'raw' && entry.typed ? { typed: entry.typed } : {}),
      } as Patch;
    });

    // The SAME condition patchCount() counts with, so the count and the post
    // cannot drift apart (rev 2, R7).
    if (includesCssPatch(freeCss, hasSelection()) && selected && selectedPath) {
      patches.push({
        kind: 'css',
        breadcrumb: selectedPath,
        tag: selected.tagName.toLowerCase(),
        text: '',
        declarations: freeCss,
        note: 'not applied literally - the bot converts it',
      });
    }

    try {
      const res = await fetch(DONE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createdAt: new Date().toISOString(),
          ...captureEnvironment(document, window),
          patches,
        }),
      });
      // Any non-2xx keeps the patch set, because the edit lives on the phone
      // until the save actually succeeds (brief items 54, 74).
      if (res.ok) {
        savedSignature = signature(history.entries, freeCss);
        sessionsBanked = true;
      }
      panel.say(res.ok ? COPY.saved : COPY.saveFailed);
      persist();
      return res.ok;
    } catch {
      panel.say(COPY.saveFailed);
      return false;
    }
  }

  /**
   * The pencil. Entering edit mode is a plain flip; leaving it saves first
   * (brief items 1, 10, 11, 12).
   */
  toggleMode = () => {
    // Once the server has gone, editing is a trap: changes would be recorded,
    // persist() would no-op, and the next tap would drop them without a word.
    // The pencil goes dead with the server, and the closing message stays on
    // screen to say why.
    if (stopped) return;
    if (mode !== 'edit') return setMode('edit');
    if (busy) return;
    void (async () => {
      busy = true;
      syncControlRow();
      try {
        const pending = isPending();
        const ok = pending ? await save() : null;
        // A failed save keeps him in the editor. Leaving would look like it
        // worked, and the edits only exist in the phone until one succeeds.
        if (exitDecision(pending, ok) === 'leave') setMode('play');
      } finally {
        busy = false;
        syncControlRow();
      }
    })();
  };

  panel.onSave(() => void stopServer());
  panel.onDiscard(() => void discardAll());

  /**
   * Save: write the session, then ask the server to exit.
   */
  async function stopServer(): Promise<void> {
    if (busy) return;
    busy = true;
    syncControlRow();
    try {
      await runStop();
    } finally {
      busy = false;
      syncControlRow();
    }
  }

  async function runStop(): Promise<void> {
    const hadSomethingToSave = isPending();
    if (hadSomethingToSave && !(await save())) {
      // Stop nothing. The server has to stay up for the save to be retried
      // against (brief item 14).
      panel.notify(COPY.saveFailed);
      return;
    }

    let result: 'ok' | 'network-error' | 'http-error';
    try {
      const res = await fetch(SHUTDOWN_URL, { method: 'POST' });
      result = res.ok ? 'ok' : 'http-error';
    } catch {
      // A dead socket is what SUCCESS looks like here — the process we were
      // talking to has exited (brief item 40).
      result = 'network-error';
    }

    if (stopOutcome(result) === 'stopFailed') {
      panel.notify(COPY.stopFailed);
      return;
    }

    stopped = true;
    history.restore([]);
    // Match the marker to the now-empty history. Left as it was, isPending()
    // would compare an empty history against the signature of what was just
    // saved, decide something was pending, and send the pencil posting to a
    // server that no longer exists.
    savedSignature = signature(history.entries, freeCss);
    store.clear();
    panel.setPencilEnabled(false);
    syncControlRow();
    // Only claim a save when there was one. This is the last thing the page
    // ever says — telling him to fold a session that was never written would
    // send him looking for it. The no-save branch has the same two axes
    // Discard's does, so it asks the same question.
    panel.notify(
      hadSomethingToSave
        ? COPY.stopped
        : COPY[discardClosingLine('stopped', false, sessionsBanked)]
    );
  }


  /**
   * Discard: throw the session away, then stop the server.
   *
   * A SIBLING of stopServer, not a branch inside it (brief item 139). runStop
   * is save-then-shutdown; this is discard-then-shutdown, and the only thing
   * they share is the POST at the end.
   *
   * Jamie, 2026-09-01: "I need a way to abandon edits, sometimes I mess about
   * and want to give up." And it is the permanent stop button too - "always
   * show discard so it's a permanent stop button as well as a discard all
   * edits button" - which is why it is here even with nothing to discard.
   */
  async function discardAll(): Promise<void> {
    if (busy) return;
    busy = true;
    syncControlRow();
    try {
      await runDiscard();
    } finally {
      busy = false;
      syncControlRow();
    }
  }

  async function runDiscard(): Promise<void> {
    // Both read BEFORE anything is cleared, because clearing is what makes
    // them unanswerable.
    const anythingDiscarded = hasSomethingToDiscard(patchCount());
    const anythingBanked = sessionsBanked;

    // THE ORDER BELOW IS LOAD-BEARING (brief item 138).

    // 1. `stopped` FIRST. It is what stops persist() writing the session
    //    straight back after store.clear() - setMode and select both persist -
    //    and it is the same guard runStop already relies on.
    stopped = true;

    // 2. Put the originals back on the page while the history still knows what
    //    they were. Not a re-render: the game may never render this screen
    //    again, and the edits are on the DOM in front of him right now.
    for (const target of history.projection().keys()) {
      const original = history.originalOf(target);
      const el = findByBreadcrumb(document, target);
      if (original && el) el.className = original.join(' ');
    }

    // 3. Everything the session held.
    history.restore([]);
    freeCss = '';
    switchedOff.clear();
    selected = null;
    selectedPath = null;

    // 4. NEVER savedSignature = '': that empty string against an empty
    //    history's '||' is precisely the mismatch that wedged the pencil
    //    (brief item 82).
    store.clear();
    savedSignature = signature(history.entries, freeCss);

    // 5. Out of the editor, and the pencil goes dead with the server.
    setMode('play');
    panel.setPencilEnabled(false);
    syncControlRow();

    // 6. And only now the shutdown.
    let result: 'ok' | 'network-error' | 'http-error';
    try {
      const res = await fetch(SHUTDOWN_URL, { method: 'POST' });
      result = res.ok ? 'ok' : 'http-error';
    } catch {
      // A dead socket is what SUCCESS looks like here (brief item 40).
      result = 'network-error';
    }

    const outcome = stopOutcome(result);
    if (outcome === 'stopFailed') {
      // The server is still alive, so the page must not be left as though it
      // were: with `stopped` true and the pencil dead, nothing on screen could
      // stop it and Jamie would need /devstop (rev 2, R11). A second tap on
      // Discard now retries the shutdown.
      stopped = false;
      panel.setPencilEnabled(true);
      syncControlRow();
    }

    // notify, not say: setMode('play') above blanks the sheet, and this is the
    // last thing the page will ever say (brief item 42).
    panel.notify(COPY[discardClosingLine(outcome, anythingDiscarded, anythingBanked)]);
  }

  // A tap that landed while the catalogue was still loading, honoured late
  // rather than lost.
  if (toggleWaiting) {
    toggleWaiting = false;
    toggleMode();
  }

  // Edit mode owns back until its own entries are exhausted, even in play mode
  // (brief item 104): flipping to play to try a change is normal, and handing
  // back to the router there would re-render and destroy every edit.
  window.addEventListener('popstate', (event) => {
    const action = nextBackAction(history, mode);
    if (action === 'release-to-page') return;
    event.stopImmediatePropagation();
    if (action === 'undo') backOneStep();
    else setMode('play');
  }, { capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleReproject();
  });
  window.addEventListener('focus', scheduleReproject);
  window.addEventListener('pageshow', scheduleReproject);
  // The outline is positioned in viewport coordinates, so it has to be redrawn
  // when the page moves under it.
  window.addEventListener('scroll', () => draw(), { passive: true });
  window.addEventListener('resize', () => draw());
  // The sheet grows and shrinks as chips and steppers come and go, and the page
  // has to keep matching it.
  if ('ResizeObserver' in window) {
    new ResizeObserver(fitPageToSheet).observe(panel.sheet);
  }
  window.visualViewport?.addEventListener('resize', trackKeyboard);
  window.visualViewport?.addEventListener('scroll', trackKeyboard);
  trackKeyboard();

  setMode(mode);
  // The game may not have rendered yet — the overlay deliberately runs first.
  // The observer above catches it the moment it does.
  reproject();
}

void start();
