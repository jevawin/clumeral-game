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
  // What each edited element started as, so Reset element can undo the lot.
  const originals = new Map<string, string[]>();

  const interceptor = createInterceptor(document, {
    isOwnUi: (target) => isOverlay(target as Node | null),
    onPointer: (event) => {
      const found = elementAtPoint(document, event.clientX, event.clientY);
      if (found) select(found);
    },
    onKey: (event) => {
      if (event.key === 'Escape') setMode('play');
    },
  });

  function persist(): void {
    store.save({
      entries: [...history.entries],
      mode,
      selected: selected ? breadcrumbOf(selected) : null,
    });
  }

  function draw(): void {
    controls.render({
      crumbs: selected ? ancestry(selected).map(crumb) : [],
      classes: selected ? [...selected.classList] : [],
      // The raw field and free-CSS box are a desktop affordance (brief item 34).
      desktop: window.matchMedia('(min-width: 768px)').matches,
    });
  }

  function select(el: Element): void {
    selected = el;
    if (!originals.has(breadcrumbOf(el))) {
      originals.set(breadcrumbOf(el), [...el.classList]);
    }
    // Brief item 42: a pair already fighting in the markup is surfaced, not
    // tidied away. Anything changed there will look unpredictable.
    const conflicts = existingConflicts([...el.classList], families);
    panel.say(conflicts.length ? conflictWarning(conflicts) : '');
    draw();
    persist();
  }

  /** Apply a new class list to the selected element and log it as one change. */
  function change(next: string[], property: string): void {
    if (!selected) return;
    const target = breadcrumbOf(selected);
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
    if (history.record({ target, before, after: next, property }, Date.now())) {
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
    onRemoveClass: (name) => {
      if (selected) change(removeClass([...selected.classList], name), name);
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
      const original = originals.get(breadcrumbOf(selected));
      if (original) change(original, 'reset');
    },
    onDone: () => void save(),
    onRawClasses: (value) => {
      if (!selected) return;
      rawTyped = value;
      change(value.split(/\s+/).filter(Boolean), 'raw');
    },
    onFreeCss: (value) => { freeCss = value; },
    onSearchFocus: (focused) => {
      // Brief item 33: scroll the element clear so the keyboard cannot cover
      // the very thing being edited.
      if (focused && selected) selected.scrollIntoView({ block: 'center' });
    },
  });

  let rawTyped = '';
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
    const patches: Patch[] = history.entries.map((entry) => ({
      kind: rawTyped ? 'raw' : 'classes',
      breadcrumb: entry.target,
      tag: findByBreadcrumb(document, entry.target)?.tagName.toLowerCase() ?? '',
      text: findByBreadcrumb(document, entry.target)?.textContent?.trim().slice(0, 40) ?? '',
      before: entry.before,
      after: entry.after,
      ...(rawTyped ? { typed: rawTyped } : {}),
    } as Patch));

    if (freeCss && selected) {
      patches.push({
        kind: 'css',
        breadcrumb: breadcrumbOf(selected),
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

  setMode(mode);
  project(document, history.projection());
}

void start();
