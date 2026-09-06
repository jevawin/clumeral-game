import { describe, it, expect, beforeAll } from 'vitest';
import {
  loadClassList,
  isColourUtility,
  nonColourClasses,
  allClasses,
  COMPONENT_CLASSES,
  type ClassEntry,
} from '../edit-mode/classlist.ts';

// A2 — the generated class list and the colour predicate (plan D1, brief items
// 43, 44, 99, 110).
//
// Brief item 43 asked for colour utilities to be classified from Tailwind's own
// data rather than a hand-written list, so the split cannot drift from the
// catalogue. The predicate is "has modifiers, and every modifier is numeric" —
// the numeric part matters, because text-sm carries LINE-HEIGHT modifiers and
// would otherwise be misread as a colour.

let list: ClassEntry[];
let names: Set<string>;

beforeAll(async () => {
  list = await loadClassList();
  names = new Set(list.map(([n]) => n));
}, 30_000);

function entry(name: string): ClassEntry {
  const found = list.find(([n]) => n === name);
  if (!found) throw new Error(`${name} is not in the design system`);
  return found;
}

describe('the colour predicate (D1)', () => {
  it('reads text size as non-colour and text colour as colour', () => {
    // The same prefix carries both. Modifiers tell them apart: text-sm's are
    // line-height names, text-text's are the numeric opacity scale.
    expect(isColourUtility(entry('text-sm'))).toBe(false);
    expect(isColourUtility(entry('text-text'))).toBe(true);
  });

  it('reads border width as non-colour and border colour as colour', () => {
    expect(isColourUtility(entry('border-2'))).toBe(false);
    expect(isColourUtility(entry('border-accent'))).toBe(true);
  });

  it('is not fooled by non-numeric modifiers', () => {
    // The bug this pins: `modifiers.length > 0` alone would classify every text
    // size as a colour and drop the whole scale from the stylesheet.
    const [, meta] = entry('text-sm');
    expect(meta.modifiers.length).toBeGreaterThan(0);
    expect(isColourUtility(entry('text-sm'))).toBe(false);
  });
});

describe('the offered set, after A3 (plan A3, brief item 46)', () => {
  it('offers every class the design system knows, colours included', () => {
    // A3, 2026-08-21: the full set is comfortable on an iPhone 16 Pro, so the
    // catalogue is EVERYTHING. The non-colour filter that used to shape this
    // stylesheet has no user left.
    const all = allClasses(list);
    expect(all.length).toBeGreaterThan(20_000);
    for (const name of ['mt-11', '-mt-96', 'mt-px', 'bg-accent', 'text-text', 'shadow-box']) {
      expect(all, `${name} missing`).toContain(name);
    }
  });

  it('still classifies colours, because the family map needs it', () => {
    // The predicate no longer filters the stylesheet, but text-sm vs
    // text-accent is still what stops a colour pick deleting a font size.
    const nonColour = nonColourClasses(list);
    expect(nonColour).toContain('text-sm');
    expect(nonColour).not.toContain('text-accent');
    expect(nonColour.length).toBeLessThan(allClasses(list).length);
  });
});

describe('the component classes (brief item 110)', () => {
  it('lists the six plain-CSS component classes by hand', () => {
    // The design system does not know these — they are plain CSS rules in
    // src/tailwind.css, not utilities. Listed here rather than converted to
    // @utility, because converting edits the file that produces the PRODUCTION
    // stylesheet (brief item 55).
    expect(COMPONENT_CLASSES).toEqual([
      'digit-box', 'burger-btn', 'skip-link', 'toast-msg', 'warn', 'recurring',
    ]);
  });

  it('confirms Tailwind genuinely does not know them', () => {
    for (const name of COMPONENT_CLASSES) {
      expect(names.has(name), `${name} unexpectedly IS a utility`).toBe(false);
    }
  });

  it('confirms each one is a real rule in the stylesheet', () => {
    // Guards the other direction: a typo here offers Jamie a class that does
    // nothing, which is exactly the silent failure brief item 99 exists for.
    const css = require('node:fs').readFileSync('src/tailwind.css', 'utf-8');
    for (const name of COMPONENT_CLASSES) {
      expect(css, `.${name} not found in the stylesheet`).toContain(`.${name}`);
    }
  });
});
