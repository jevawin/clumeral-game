import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { breadcrumbOf, findByBreadcrumb } from '../src/edit-mode/project.ts';
import { removeClass, applyClass } from '../src/edit-mode/families.ts';
import { createHistory } from '../src/edit-mode/history.ts';

// An element's identity must not change when its classes do.
//
// Found by the da-build review. A crumb is written `tag.firstClass`, so removing
// or replacing an element's FIRST class renames it. Recomputing the breadcrumb
// per change therefore gives one element two identities, and everything keyed on
// it comes apart quietly:
//
//   - two history entries for one element, so undo steps twice
//   - a projection with a stale key, so re-projection re-applies a dead edit
//   - a session file naming an element /fold cannot grep, because SOURCE still
//     has the original first class
//
// The overlay freezes the path at selection. These tests pin both halves: that
// the hazard is real, and that freezing answers it.

const MAP: Record<string, string[]> = {
  'mt-4': ['margin-top'], 'mt-6': ['margin-top'],
  'rounded-lg': ['border-radius'], 'bg-bg': ['background-color'], 'px-4': ['padding-inline'],
};

beforeEach(() => {
  document.body.innerHTML =
    '<main><div class="card"><button class="rounded-lg bg-bg px-4 mt-4">Submit</button></div></main>';
});

afterEach(() => { document.body.innerHTML = ''; });

const button = () => document.querySelector('button')!;

describe('the hazard is real', () => {
  it('renames the element when its first class is removed', () => {
    const before = breadcrumbOf(button());
    expect(before).toBe('main > div.card > button.rounded-lg');

    button().className = removeClass([...button().classList], 'rounded-lg').join(' ');

    expect(breadcrumbOf(button())).not.toBe(before);
    expect(breadcrumbOf(button())).toBe('main > div.card > button.bg-bg');
  });

  it('leaves the old name unresolvable', () => {
    const before = breadcrumbOf(button());
    button().className = removeClass([...button().classList], 'rounded-lg').join(' ');
    expect(findByBreadcrumb(document, before)).toBeNull();
  });

  it('does NOT rename when a later class is changed', () => {
    // Which is why this survived every other test: the common case is safe.
    // applyClass keeps a replacement where the old class was, so only touching
    // the FIRST one moves the identity.
    const before = breadcrumbOf(button());
    button().className = applyClass([...button().classList], 'mt-6', MAP).join(' ');
    expect(breadcrumbOf(button())).toBe(before);
  });
});

describe('freezing the path at selection answers it', () => {
  it('keeps one identity across several changes to one element', () => {
    // What the overlay does: capture once on select, reuse for every change.
    const frozen = breadcrumbOf(button());
    const history = createHistory();

    history.record({
      target: frozen, property: 'border-radius',
      before: [...button().classList],
      after: removeClass([...button().classList], 'rounded-lg'),
    }, 0);
    button().className = removeClass([...button().classList], 'rounded-lg').join(' ');

    history.record({
      target: frozen, property: 'margin-top',
      before: [...button().classList],
      after: applyClass([...button().classList], 'mt-6', MAP),
    }, 5_000);

    // One element, one key — not two.
    expect(history.entries).toHaveLength(2);
    expect(history.projection().size).toBe(1);
    expect([...history.projection().keys()]).toEqual([frozen]);
  });

  it('records the element as SOURCE still has it', () => {
    // /fold greps the before-class string in source, which still carries the
    // original first class. A post-edit breadcrumb would name something that
    // exists only in Jamie's browser.
    const frozen = breadcrumbOf(button());
    button().className = removeClass([...button().classList], 'rounded-lg').join(' ');
    expect(frozen).toContain('rounded-lg');
  });

  it('lets Reset element find the original after any number of changes', () => {
    const frozen = breadcrumbOf(button());
    const history = createHistory();
    const original = [...button().classList];

    history.record({ target: frozen, property: 'a', before: original, after: ['bg-bg'] }, 0);
    history.record({ target: frozen, property: 'b', before: ['bg-bg'], after: ['bg-bg', 'mt-6'] }, 5_000);

    expect(history.originalOf(frozen)).toEqual(original);
  });
});
