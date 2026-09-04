import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  readActual, detectOverwrites, overwrittenClasses,
} from '../src/edit-mode/runtime-classes.ts';
import { COPY } from '../src/edit-mode/copy.ts';

// C8 — classes the game controls (brief items 37, 57, 73, 109).
//
// theme.ts toggles .dark; several modules toggle .hidden. An edit to one of
// those is overwritten on the next render, and its fold-back target is a
// CONDITION in code, not a literal in a template.

const CARD = 'main > div.card';

beforeEach(() => {
  document.body.innerHTML = '<main><div class="card mt-6">Card</div></main>';
});

afterEach(() => { document.body.innerHTML = ''; });

describe('detecting what the game changed behind our back (item 37)', () => {
  it('spots a class the game removed', () => {
    const expected = new Map([[CARD, ['card', 'mt-6']]]);
    // The game re-rendered and dropped the edit.
    document.querySelector('.card')!.className = 'card';

    const overwrites = detectOverwrites(expected, readActual(document, expected.keys()));
    expect(overwrites).toEqual([{ breadcrumb: CARD, removed: ['mt-6'], added: [] }]);
  });

  it('spots a class the game added', () => {
    const expected = new Map([[CARD, ['card', 'mt-6']]]);
    document.querySelector('.card')!.className = 'card mt-6 hidden';

    const overwrites = detectOverwrites(expected, readActual(document, expected.keys()));
    expect(overwrites).toEqual([{ breadcrumb: CARD, removed: [], added: ['hidden'] }]);
  });

  it('says nothing when the edit survived', () => {
    const expected = new Map([[CARD, ['card', 'mt-6']]]);
    expect(detectOverwrites(expected, readActual(document, expected.keys()))).toEqual([]);
  });

  it('ignores class order, which is not meaningful', () => {
    const expected = new Map([[CARD, ['card', 'mt-6']]]);
    document.querySelector('.card')!.className = 'mt-6 card';
    expect(detectOverwrites(expected, readActual(document, expected.keys()))).toEqual([]);
  });

  it('reports both directions at once', () => {
    // theme.ts swapping .light for .dark is exactly this shape.
    const expected = new Map([[CARD, ['card', 'light']]]);
    document.querySelector('.card')!.className = 'card dark';

    const [overwrite] = detectOverwrites(expected, readActual(document, expected.keys()));
    expect(overwrittenClasses(overwrite)).toEqual(['dark', 'light']);
  });
});

describe('an element that is simply gone', () => {
  it('is not reported as an overwrite', () => {
    // The game navigated to another screen. Crying wolf on every screen change
    // would make the flag worthless within a minute.
    const expected = new Map([['main > div.other', ['mt-6']]]);
    expect(detectOverwrites(expected, readActual(document, expected.keys()))).toEqual([]);
  });
});

describe('the observation window (brief item 109)', () => {
  it('needs a render to have happened, which is why it runs after play mode', () => {
    // Edit mode stops the game rendering, so a class the game WOULD reset never
    // gets reset while the panel is open — and the detector written for the
    // .hidden case would never fire for it. This test is the shape of that
    // correction: nothing is detected until the DOM actually changes.
    const expected = new Map([[CARD, ['card', 'mt-6']]]);

    // While edit mode holds the game still: nothing moves, nothing is flagged.
    expect(detectOverwrites(expected, readActual(document, expected.keys()))).toEqual([]);

    // Back in play mode, the game renders and resets the class.
    document.querySelector('.card')!.className = 'card';
    expect(detectOverwrites(expected, readActual(document, expected.keys()))).toHaveLength(1);
  });
});

describe('what Jamie is told (brief item 73)', () => {
  it('explains that the fold target is a condition, not a class', () => {
    // The flag has to be VISIBLE, not just recorded in the file — otherwise he
    // makes the change again and wonders why it keeps reverting.
    expect(COPY.runtimeControlled).toContain('set in code');
    expect(COPY.runtimeControlled).toContain('condition rather than a class');
  });
});
