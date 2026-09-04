import { describe, it, expect, beforeAll } from 'vitest';
import { buildFamilyMap, sameFamily, type FamilyMap } from '../edit-mode/classlist.ts';

// A2 — the family map (plan D2, brief items 38, 40, 43).
//
// The brief calls the family map "the single most likely source of silent
// wrongness". Tailwind cannot supply it: ClassMetadata is { modifiers } and
// nothing else. And the obvious PREFIX rule is wrong — text-sm, text-center and
// text-2xl all share the prefix `text`, so a prefix map deletes your font size
// when you centre the text.
//
// So a utility's family is the SET OF CSS PROPERTIES IT DECLARES, read from the
// compiled output. Two classes collide when their property sets are exactly
// equal. Everything below is a case that rule has to get right.

const PROBE = [
  'mt-4', 'mt-6', 'mb-4',
  'p-4', 'px-4', 'px-6', 'py-2', 'pt-1',
  'text-sm', 'text-2xl', 'text-center', 'text-left', 'text-accent',
  'border-2', 'border-4', 'border-solid', 'border-accent',
  'rounded-lg', 'rounded-md', 'w-96', 'h-96',
];

let map: FamilyMap;

beforeAll(async () => {
  map = await buildFamilyMap(PROBE);
}, 60_000);

describe('the family map is derived from CSS properties, not prefixes (D2)', () => {
  it('reads the properties each utility actually declares', () => {
    expect(map.get('mt-4')).toEqual(['margin-top']);
    expect(map.get('p-4')).toEqual(['padding']);
    expect(map.get('px-6')).toEqual(['padding-inline']);
    expect(map.get('text-sm')).toEqual(['font-size', 'line-height']);
    expect(map.get('text-center')).toEqual(['text-align']);
    expect(map.get('text-accent')).toEqual(['color']);
  });

  it('drops Tailwind internal custom properties', () => {
    // --tw-* are implementation detail and appear across unrelated families.
    // Including them would make everything look like everything else.
    for (const props of map.values()) {
      for (const p of props) expect(p.startsWith('--tw')).toBe(false);
    }
  });
});

describe('same-family collisions replace (brief item 38)', () => {
  it('treats two margin-top steps as the same family', () => {
    expect(sameFamily(map, 'mt-4', 'mt-6')).toBe(true);
  });

  it('treats two inline-padding steps as the same family', () => {
    // The genuine collision brief item 40 kept, after dropping the cross-family rule.
    expect(sameFamily(map, 'px-4', 'px-6')).toBe(true);
  });

  it('does not confuse margin-top with margin-bottom', () => {
    expect(sameFamily(map, 'mt-4', 'mb-4')).toBe(false);
  });

  it('would have been a no-op if appended instead of replaced', () => {
    // The design asks for this asserted as the FAILING case: adding mt-6 beside
    // mt-4 leaves CSS order to pick a winner, so the tap looks broken. The map
    // saying "same family" is what stops the overlay appending.
    expect(map.get('mt-4')).toEqual(map.get('mt-6'));
    expect(sameFamily(map, 'mt-4', 'mt-6')).toBe(true);
  });
});

describe('padding shorthand and axis coexist (brief item 40)', () => {
  it('keeps p-4 and px-6 together', () => {
    // Jamie, 2026-08-18: "why do you need to add top and bottom padding if I say
    // inline only?" Tailwind emits the shorthand BEFORE the axis utility, so
    // `p-4 px-6` already means 6 inline, 4 block. Keeping both is correct.
    expect(sameFamily(map, 'p-4', 'px-6')).toBe(false);
  });

  it('keeps the two axes apart from each other', () => {
    expect(sameFamily(map, 'px-6', 'py-2')).toBe(false);
    expect(sameFamily(map, 'p-4', 'pt-1')).toBe(false);
  });
});

describe('the prefix trap (D2 — the case a prefix map gets wrong)', () => {
  it('does not let centring text delete the font size', () => {
    // A prefix map would call these both `text` and replace one with the other.
    expect(sameFamily(map, 'text-sm', 'text-center')).toBe(false);
  });

  it('splits text size from text colour (brief item 43)', () => {
    expect(sameFamily(map, 'text-sm', 'text-accent')).toBe(false);
  });

  it('still replaces one size with another', () => {
    expect(sameFamily(map, 'text-sm', 'text-2xl')).toBe(true);
  });

  it('splits border width from border colour and border style (brief item 43)', () => {
    expect(sameFamily(map, 'border-2', 'border-accent')).toBe(false);
    expect(sameFamily(map, 'border-2', 'border-solid')).toBe(false);
  });

  it('still replaces one border width with another', () => {
    expect(sameFamily(map, 'border-2', 'border-4')).toBe(true);
  });

  it('uses exact set equality, not subset', () => {
    // border-2 declares {border-style, border-width}; border-solid declares
    // {border-style}. Under a SUBSET rule adding border-solid would eat
    // border-2. Under equality both stay, and CSS settles border-style to the
    // same value either way. Brief item 42: record what Jamie did, do not be
    // clever on his behalf.
    const a = map.get('border-2')!;
    const b = map.get('border-solid')!;
    expect(b.every((p) => a.includes(p))).toBe(true);
    expect(sameFamily(map, 'border-2', 'border-solid')).toBe(false);
  });
});
