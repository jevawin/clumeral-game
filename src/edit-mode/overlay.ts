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
import { COPY, conflictWarning } from './copy.ts';

const CATALOGUE_URL = '/__edit-mode/catalogue.json';
const REPLAY_URL = '/__edit-mode/replay.json';
const DONE_URL = '/__edit-mode/session';

/**
 * Is this the read-only origin?
 *
 * Asked of the SERVER THAT SERVED THIS PAGE, by re-requesting it and reading
 * the header the proxy adds. The proxy is a separate listener with no write
 * handler, so the answer comes from which port the page came through — not from
 * anything the browser could be told to claim (brief items 25, 103).
 */
async function isReplayOrigin(): Promise<boolean> {
  try {
    const res = await fetch(location.href, { method: 'HEAD' });
    return res.headers.get('X-Clumeral-Edit-Mode') === 'replay';
  } catch {
    // Cannot tell — assume read-only. Showing Dave a pencil that cannot save is
    // worse than Jamie briefly not seeing his (brief item 103).
    return true;
  }
}

async function start(): Promise<void> {
  const script = document.currentScript as HTMLScriptElement | null;
  const branch = script?.dataset.branch ?? 'unknown';

  const replayOnly = await isReplayOrigin();
  const panel = createPanel(document, { replayOnly });

  // Dave's page: apply the saved sessions and stop. No pencil, no panel, and
  // nothing that could write.
  const replay = await fetch(REPLAY_URL).then((r) => r.json()).catch(() => null);
  if (replay?.projection) {
    project(document, new Map(Object.entries(replay.projection as Record<string, string[]>)));
  }
  if (replayOnly) return;

  const { classes, families } = await fetch(CATALOGUE_URL)
    .then((r) => r.json())
    .catch(() => ({ classes: [], families: {} as FamilyMap }));
  const catalogue = createCatalogue(classes, families);

  const store = createSessionStore(branch, sessionStorage);
  const saved = store.load();
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
  const switchedOff = new Map<string, Set<string>>();

  function offFor(path: string | null): Set<string> {
    if (!path) return new Set();
    let set = switchedOff.get(path);
    if (!set) { set = new Set(); switchedOff.set(path, set); }
    return set;
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
    store.save({ entries: [...history.entries], mode, selected: selectedPath });
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
      off: [...offFor(selectedPath)],
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

      if (off.has(name)) {
        // Back on, in its original position if we can manage it.
        off.delete(name);
        change(applyClass([...selected.classList], name, families), property);
      } else {
        off.add(name);
        change(removeClass([...selected.classList], name), property);
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
      const swapped = applyClass(removeClass([...selected.classList], name), next, families);
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
    onDone: () => void save(),
    onRawClasses: (value) => {
      if (!selected) return;
      // The kind and the typed string ride on THIS change only.
      change(value.split(/\s+/).filter(Boolean), 'raw', 'raw', value);
    },
    onFreeCss: (value) => { freeCss = value; },
    onSearchFocus: (focused) => {
      // Brief item 33: scroll the element clear so the keyboard cannot cover
      // the very thing being edited.
      if (focused && selected) selected.scrollIntoView({ block: 'center' });
    },
  });

  let freeCss = '';

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

  async function save(): Promise<void> {
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
      // until Done actually succeeds (brief items 54, 74).
      panel.say(res.ok ? COPY.saved : COPY.saveFailed);
    } catch {
      panel.say(COPY.saveFailed);
    }
  }

  panel.onToggle(() => setMode(mode === 'edit' ? 'play' : 'edit'));

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
