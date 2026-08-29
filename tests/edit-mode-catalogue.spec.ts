import { describe, it, expect } from 'vitest';
import { createCatalogue, search, familyLabel } from '../src/edit-mode/catalogue.ts';

// B1 and B2 — the catalogue and search (brief items 35, 36, 98, 99, 110).
//
// The catalogue is what search offers. It is built from the SAME generated list
// the stylesheet compiled, so search can only ever offer a class the browser can
// actually apply. Brief item 99's other half — telling Jamie when a class did
// nothing — covers the raw field and typos, which search cannot protect.

// A small stand-in for the generated artefacts. Real data is 23,031 classes;
// these are enough to pin every rule, and keeping them here means the test does
// not need a 2-second Tailwind compile to run.
const CLASSES = [
  'mt-4', 'mt-6', 'mt-11', 'mt-px', 'mt-auto', '-mt-4', '-mt-96',
  'mb-4', 'mx-2', 'px-4', 'px-6', 'p-4',
  'text-sm', 'text-2xl', 'text-center', 'text-accent', 'text-text',
  'border-2', 'border-solid', 'border-accent',
  'bg-accent', 'bg-bg', 'rounded-lg', 'shadow-box', 'flex', 'items-center',
  // component classes, which Tailwind does not know about
  'digit-box', 'burger-btn', 'skip-link', 'toast-msg', 'warn', 'recurring',
];

const FAMILIES: Record<string, string[]> = {
  'mt-4': ['margin-top'], 'mt-6': ['margin-top'], 'mt-11': ['margin-top'],
  'mt-px': ['margin-top'], 'mt-auto': ['margin-top'],
  '-mt-4': ['margin-top'], '-mt-96': ['margin-top'],
  'mb-4': ['margin-bottom'], 'mx-2': ['margin-inline'],
  'px-4': ['padding-inline'], 'px-6': ['padding-inline'], 'p-4': ['padding'],
  'text-sm': ['font-size', 'line-height'], 'text-2xl': ['font-size', 'line-height'],
  'text-center': ['text-align'], 'text-accent': ['color'], 'text-text': ['color'],
  'border-2': ['border-style', 'border-width'], 'border-solid': ['border-style'],
  'border-accent': ['border-color'],
  'bg-accent': ['background-color'], 'bg-bg': ['background-color'],
  'rounded-lg': ['border-radius'], 'shadow-box': ['box-shadow'],
  'flex': ['display'], 'items-center': ['align-items'],
};

const catalogue = createCatalogue(CLASSES, FAMILIES);

describe('the catalogue only offers what the stylesheet contains (brief item 99)', () => {
  it('holds exactly the generated classes', () => {
    expect(catalogue.classes.sort()).toEqual([...CLASSES].sort());
  });

  it('offers no variants (brief item 98)', () => {
    // `md:mt-4` can be composed from getVariants(), and the catalogue could
    // offer it — but it is in no built set, so tapping the chip would move
    // nothing. That is exactly the "the tap looks broken" failure the replace
    // map exists to prevent, arriving by a different door.
    for (const name of catalogue.classes) {
      expect(name, `${name} carries a variant prefix`).not.toContain(':');
    }
  });

  it('includes the six component classes (brief item 110)', () => {
    for (const name of ['digit-box', 'burger-btn', 'skip-link', 'toast-msg', 'warn', 'recurring']) {
      expect(catalogue.classes).toContain(name);
    }
  });

  it('rejects a class the stylesheet does not carry', () => {
    // The generated list is the closed set. Anything outside it is a silent
    // no-op in the browser, so the catalogue must not know it either.
    expect(catalogue.has('mt-13')).toBe(false);
    expect(catalogue.has('mt-11')).toBe(true);
  });
});

describe('search matches by prefix (brief item 35)', () => {
  const names = (query: string) => search(catalogue, query).flatMap((g) => g.matches);

  it('finds the spacing scale from a short prefix', () => {
    const found = names('mt');
    expect(found).toContain('mt-4');
    expect(found).toContain('mt-11');
    expect(found).toContain('mt-auto');
  });

  it('does not match mid-token', () => {
    // The design is explicit: prefix only, so `t-7` cannot reach `mt-7`. It
    // keeps result sets small and predictable.
    expect(names('t-4')).not.toContain('mt-4');
    expect(names('adding')).not.toContain('padding');
  });

  it('strips a leading minus, so mt finds the negatives too', () => {
    const found = names('mt');
    expect(found).toContain('-mt-4');
    expect(found).toContain('-mt-96');
  });

  it('finds a negative class from its own leading minus as well', () => {
    expect(names('-mt')).toContain('-mt-4');
  });

  it('matches the segment after the last colon', () => {
    // No variants are offered today (item 98), so nothing in the catalogue has
    // a colon. The rule is implemented anyway because the moment a variant IS
    // offered, `mt` must still find `md:mt-4` — and a rule added later, under
    // pressure, is a rule that gets this wrong.
    const withVariant = createCatalogue(['md:mt-4'], { 'md:mt-4': ['margin-top'] });
    expect(search(withVariant, 'mt').flatMap((g) => g.matches)).toContain('md:mt-4');
  });

  it('is case-insensitive', () => {
    expect(names('MT')).toContain('mt-4');
  });

  it('finds the component classes by name', () => {
    expect(names('digit')).toContain('digit-box');
  });

  it('returns nothing for a query off the end of the scale', () => {
    // Brief item 72 turns this into a next step rather than a dead end:
    // "Nothing on the scale matches. Describe what you want in words instead."
    expect(search(catalogue, 'zzz')).toEqual([]);
  });

  it('returns nothing for an empty query rather than everything', () => {
    expect(search(catalogue, '')).toEqual([]);
    expect(search(catalogue, '   ')).toEqual([]);
  });
});

describe('search groups by family and caps results (brief item 35)', () => {
  it('groups matches by what they actually do', () => {
    const groups = search(catalogue, 'text');
    const labels = groups.map((g) => g.family);
    // text- covers three unrelated jobs. Grouping is what makes that legible
    // instead of a flat list where size, alignment and colour are jumbled.
    expect(labels).toContain('font-size, line-height');
    expect(labels).toContain('text-align');
    expect(labels).toContain('color');
  });

  it('puts every match in exactly one group', () => {
    const groups = search(catalogue, 'mt');
    const all = groups.flatMap((g) => g.matches);
    expect(new Set(all).size).toBe(all.length);
  });

  it('caps each family so bg and text stay usable', () => {
    // The real catalogue has ~300 background colours. Uncapped, one query fills
    // the sheet and the phone scrolls forever.
    const many = Array.from({ length: 200 }, (_, i) => `mt-${i}`);
    const families = Object.fromEntries(many.map((n) => [n, ['margin-top']]));
    const big = createCatalogue(many, families);
    const groups = search(big, 'mt', { perFamily: 12 });
    expect(groups[0].matches.length).toBe(12);
    expect(groups[0].total).toBe(200);
  });

  it('reports the true total when it caps, so nothing looks missing', () => {
    const many = Array.from({ length: 50 }, (_, i) => `mt-${i}`);
    const families = Object.fromEntries(many.map((n) => [n, ['margin-top']]));
    const groups = search(createCatalogue(many, families), 'mt', { perFamily: 5 });
    expect(groups[0].matches).toHaveLength(5);
    expect(groups[0].total).toBe(50);
  });

  it('gives component classes a family of their own', () => {
    // They are plain CSS rules, so the design system knows no properties for
    // them. They must still be findable and must not land in a misleading group.
    const groups = search(catalogue, 'digit');
    expect(groups[0].family).toBe(familyLabel(undefined));
    expect(groups[0].matches).toEqual(['digit-box']);
  });
});

describe('family labels read as English (brief item 82)', () => {
  it('names a family by the properties it sets', () => {
    expect(familyLabel(['margin-top'])).toBe('margin-top');
    expect(familyLabel(['font-size', 'line-height'])).toBe('font-size, line-height');
  });

  it('has one honest label for classes Tailwind knows nothing about', () => {
    expect(familyLabel(undefined)).toBe('component class');
    expect(familyLabel([])).toBe('component class');
  });
});
