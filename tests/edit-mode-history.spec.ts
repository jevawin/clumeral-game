import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createHistory, nextBackAction, stillOwnsBack, type History,
} from '../src/edit-mode/history.ts';
import { project, findByBreadcrumb, breadcrumbOf } from '../src/edit-mode/project.ts';

// C6 — undo, back, and re-projection (brief items 66-70, 104, 105).
//
// The failure being prevented: back WIPES every edit instead of undoing one,
// because src/router.ts:199 re-renders on popstate and a re-render rebuilds the
// DOM. Silent, and it looks like "back wipes everything".

const BTN = 'main > div.card > button.submit-btn';
let history: History;

beforeEach(() => {
  history = createHistory({ collapseWindowMs: 600 });
});

const step = (after: string[], now: number, property = 'margin-top', target = BTN) =>
  history.record({ target, property, before: ['mt-4'], after }, now);

describe('rapid steps collapse into one entry (brief item 68)', () => {
  it('turns a ten-tap walk up the scale into one entry', () => {
    // Holding + walks the scale. If each tap were its own entry, backing out of
    // one adjustment would take ten swipes.
    for (let i = 0; i < 10; i++) step([`mt-${5 + i}`], i * 100);
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0].after).toEqual(['mt-14']);
  });

  it('undoes the whole walk, landing where it started', () => {
    // Keeping the ORIGINAL before is the point: undo must not land one step in.
    for (let i = 0; i < 10; i++) step([`mt-${5 + i}`], i * 100);
    expect(history.undo()!.before).toEqual(['mt-4']);
    expect(history.isEmpty).toBe(true);
  });

  it('starts a new entry after a pause', () => {
    step(['mt-5'], 0);
    step(['mt-6'], 100);
    step(['mt-7'], 5_000);
    expect(history.entries).toHaveLength(2);
  });

  it('starts a new entry when a different property is adjusted', () => {
    step(['mt-5'], 0);
    step(['px-6'], 50, 'padding-inline');
    expect(history.entries).toHaveLength(2);
  });

  it('starts a new entry when a different element is adjusted', () => {
    step(['mt-5'], 0);
    step(['mt-5'], 50, 'margin-top', 'main > p');
    expect(history.entries).toHaveLength(2);
  });

  it('tells the caller whether to push a history state', () => {
    // Push on a collapse and back gets an entry with nothing behind it.
    expect(step(['mt-5'], 0)).toBe(true);
    expect(step(['mt-6'], 100)).toBe(false);
    expect(step(['mt-7'], 5_000)).toBe(true);
  });

  it('does not collapse a fresh change into an entry that survived an undo', () => {
    step(['mt-5'], 0);
    step(['px-6'], 5_000, 'padding-inline');
    history.undo();
    step(['mt-9'], 5_050);
    // Would otherwise rewrite the mt entry Jamie already stepped past.
    expect(history.entries).toHaveLength(2);
  });
});

describe('what back does next (brief items 69, 70, 104)', () => {
  it('undoes while edits remain', () => {
    step(['mt-6'], 0);
    expect(nextBackAction(history, 'edit')).toBe('undo');
  });

  it('undoes while edits remain even in play mode', () => {
    // Flipping to play mode to try a change is normal (item 30). If back went
    // to the router at that moment, the first press would re-render and destroy
    // every edit. So the interception OUTLIVES the mode (item 104).
    step(['mt-6'], 0);
    expect(nextBackAction(history, 'play')).toBe('undo');
    expect(stillOwnsBack(history, 'play')).toBe(true);
  });

  it('leaves edit mode once there is nothing left to undo', () => {
    expect(nextBackAction(history, 'edit')).toBe('leave-edit-mode');
  });

  it('gives back to the page from play mode with nothing left', () => {
    // "Back out" — Jamie, 2026-08-18. Back always doing SOMETHING is the
    // expectation on a phone.
    expect(nextBackAction(history, 'play')).toBe('release-to-page');
    expect(stillOwnsBack(history, 'play')).toBe(false);
  });

  it('walks the whole way out in order', () => {
    step(['mt-6'], 0);
    step(['px-6'], 5_000, 'padding-inline');

    expect(nextBackAction(history, 'edit')).toBe('undo');
    history.undo();
    expect(nextBackAction(history, 'edit')).toBe('undo');
    history.undo();
    expect(nextBackAction(history, 'edit')).toBe('leave-edit-mode');
    expect(nextBackAction(history, 'play')).toBe('release-to-page');
  });
});

describe('a reload keeps the inverses (brief item 105)', () => {
  it('restores entries so back still has something to undo', () => {
    // The browser still holds the pushed history entries after a reload. Without
    // the inverses the overlay cannot honour them, and back would do nothing.
    step(['mt-6'], 0);
    step(['px-6'], 5_000, 'padding-inline');
    const saved = JSON.parse(JSON.stringify(history.entries));

    const fresh = createHistory();
    fresh.restore(saved);
    expect(fresh.entries).toHaveLength(2);
    expect(fresh.undo()!.after).toEqual(['px-6']);
  });

  it('does not collapse the first change after a reload into a restored entry', () => {
    step(['mt-6'], 0);
    const fresh = createHistory();
    fresh.restore(JSON.parse(JSON.stringify(history.entries)));
    fresh.record({ target: BTN, property: 'margin-top', before: ['mt-6'], after: ['mt-7'] }, 10);
    expect(fresh.entries).toHaveLength(2);
  });
});

describe('the DOM is a projection of the patch set (brief item 67)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main><div class="card"><button class="submit-btn">Submit</button></div></main>
    `;
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('finds an element by its breadcrumb', () => {
    expect(findByBreadcrumb(document, BTN)).toBe(document.querySelector('.submit-btn'));
  });

  it('round-trips an element through its own breadcrumb', () => {
    const el = document.querySelector('.submit-btn')!;
    expect(findByBreadcrumb(document, breadcrumbOf(el))).toBe(el);
  });

  it('applies the projection to the page', () => {
    step(['mt-6', 'submit-btn'], 0);
    const result = project(document, history.projection());
    expect(result.applied).toBe(1);
    expect(document.querySelector('button')!.className).toBe('mt-6 submit-btn');
  });

  it('puts the remaining edits back after the router rebuilds the DOM', () => {
    // THE test. The router re-rendering is what would silently wipe everything;
    // re-projection is what makes that survivable regardless of listener order.
    step(['mt-6', 'submit-btn'], 0);
    step(['px-6', 'submit-btn'], 5_000, 'padding-inline');
    project(document, history.projection());

    // The router re-renders: fresh DOM, original classes, edits gone.
    document.body.innerHTML = `
      <main><div class="card"><button class="submit-btn">Submit</button></div></main>
    `;
    expect(document.querySelector('button')!.className).toBe('submit-btn');

    history.undo();
    project(document, history.projection());
    // One step undone, and the earlier edit is back rather than lost.
    expect(document.querySelector('button')!.className).toBe('mt-6 submit-btn');
  });

  it('is idempotent, so it can run on every undo and every page load', () => {
    step(['mt-6', 'submit-btn'], 0);
    const projection = history.projection();
    project(document, projection);
    const once = document.querySelector('button')!.className;
    project(document, projection);
    expect(document.querySelector('button')!.className).toBe(once);
  });

  it('reports a breadcrumb that no longer resolves rather than guessing', () => {
    // The game may simply have navigated elsewhere. Applying a patch to the
    // wrong element is worse than applying none.
    const result = project(document, new Map([['main > div.gone > button', ['mt-6']]]));
    expect(result.applied).toBe(0);
    expect(result.missing).toEqual(['main > div.gone > button']);
  });

  it('never projects onto the overlay', () => {
    document.body.insertAdjacentHTML('beforeend', '<div data-clumeral-edit-mode></div>');
    expect(findByBreadcrumb(document, 'div')).toBeNull();
  });
});
