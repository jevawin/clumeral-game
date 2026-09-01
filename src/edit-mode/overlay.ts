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
import { project, breadcrumbOf, findByBreadcrumb } from './project.ts';
import { readActual, detectOverwrites } from './runtime-classes.ts';
import {
  ancestry, crumb, isOverlay, elementAtPoint, nav, computedSnapshot, didNothing,
} from './select.ts';
import { captureEnvironment, type Patch } from './patches.ts';
import { signature, exitDecision, stopOutcome } from './pending.ts';
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

  // Put back what earlier sessions changed, before anything else touches the
  // page. This is Jamie's own reload safety net, not Dave's — the read-only
  // origin it was shared with is gone.
  const replay = await fetch(REPLAY_URL).then((r) => r.json()).catch(() => null);
  if (replay?.projection) {
    project(document, new Map(Object.entries(replay.projection as Record<string, string[]>)));
  }
  const { classes, families } = await fetch(CATALOGUE_URL)
    .then((r) => r.json())
    .catch(() => ({ classes: [], families: {} as FamilyMap }));
  const catalogue = createCatalogue(classes, families);

  const store = createSessionStore(branch, sessionStorage);
  const saved = store.load();
  let freeCss = saved.freeCss;
  let savedSignature = saved.savedSignature;
  // Set once the server has gone. Stops persist() writing the session back
  // after store.clear(), and stops the pill being shown again for a dead
  // server (brief item 42).
  let stopped = false;
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

  function isPending(): boolean {
    return signature(history.entries, freeCss) !== savedSignature;
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
    });
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
    onFreeCss: (value) => { freeCss = value; persist(); },
    onSearchFocus: (focused) => {
      // Brief item 33: scroll the element clear so the keyboard cannot cover
      // the very thing being edited.
      if (focused && selected) selected.scrollIntoView({ block: 'center' });
    },
  });


  function setMode(next: 'play' | 'edit'): void {
    const leavingEdit = mode === 'edit' && next === 'play';
    mode = next;
    panel.setMode(next);
    if (next === 'edit') interceptor.enable();
    else interceptor.disable();

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

    if (freeCss && selected && selectedPath) {
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
      if (res.ok) savedSignature = signature(history.entries, freeCss);
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
    if (mode !== 'edit') return setMode('edit');
    void (async () => {
      const pending = isPending();
      const ok = pending ? await save() : null;
      // A failed save keeps him in the editor. Leaving would look like it
      // worked, and the edits only exist in the phone until one succeeds.
      if (exitDecision(pending, ok) === 'leave') setMode('play');
    })();
  };

  panel.onStop(() => void stopServer());

  /**
   * Save & Stop: write the session, then ask the server to exit.
   */
  async function stopServer(): Promise<void> {
    if (isPending() && !(await save())) {
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
    store.clear();
    panel.setStopVisible(false);
    panel.notify(COPY.stopped);
  }

  // On screen in play mode for as long as the server is running — Jamie,
  // 2026-08-31: "Always visible" (brief item 61).
  panel.setStopVisible(mode !== 'edit');
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

  function reproject(): void {
    if (projecting) return;
    projecting = true;
    try {
      project(document, history.projection());
      if (selectedPath) selected = findByBreadcrumb(document, selectedPath);
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
    if (projecting || history.entries.length === 0) return;
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
