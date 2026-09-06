import { describe, it, expect } from 'vitest';
import {
  collides, applyClass, appendClass, removeClass, existingConflicts,
} from '../src/edit-mode/families.ts';

// C1 — collision rules (brief items 38, 40, 42, 43).
//
// The brief calls this the single most likely source of silent wrongness, and
// the design asks for the FAILING case to be asserted: that appending would have
// produced a no-op, and that the overlay does not do it.

// Property sets as the generator produces them. Verified against the real
// compiler in tests/edit-mode-families.spec.ts; repeated here as a fixture so
// these rules can be tested without a 2-second Tailwind compile.
const MAP: Record<string, string[]> = {
  'mt-4': ['margin-top'], 'mt-6': ['margin-top'], 'mt-8': ['margin-top'],
  'mb-4': ['margin-bottom'],
  'p-4': ['padding'], 'px-4': ['padding-inline'], 'px-6': ['padding-inline'],
  'py-2': ['padding-block'],
  'text-sm': ['font-size', 'line-height'], 'text-2xl': ['font-size', 'line-height'],
  'text-center': ['text-align'], 'text-accent': ['color'],
  'border-2': ['border-style', 'border-width'], 'border-4': ['border-style', 'border-width'],
  'border-solid': ['border-style'], 'border-accent': ['border-color'],
  'rounded-lg': ['border-radius'], 'bg-accent': ['background-color'],
  'shadow-box': ['box-shadow'], 'shadow-lg': ['box-shadow'],
  // A component class: plain CSS, so the design system knows no properties.
  'digit-box': [],
};

describe('replace, do not append (brief item 38)', () => {
  it('replaces one margin step with another', () => {
    expect(applyClass(['rounded-lg', 'mt-4'], 'mt-6', MAP)).toEqual(['rounded-lg', 'mt-6']);
  });

  it('proves appending would have been a no-op', () => {
    // THE test the design names. `mt-4 mt-6` on one element leaves CSS ORDER to
    // pick the winner, not class order — so the tap looks broken. If this ever
    // starts passing with append, the overlay is silently wrong.
    const appended = appendClass(['mt-4'], 'mt-6');
    expect(appended).toEqual(['mt-4', 'mt-6']);
    expect(collides(MAP, 'mt-4', 'mt-6')).toBe(true);
    expect(applyClass(['mt-4'], 'mt-6', MAP)).not.toEqual(appended);
  });

  it('keeps the replacement where the old class was', () => {
    // So the chip list does not reshuffle under his thumb mid-adjustment.
    expect(applyClass(['mt-4', 'p-4', 'rounded-lg'], 'mt-8', MAP))
      .toEqual(['mt-8', 'p-4', 'rounded-lg']);
  });

  it('appends a class that fights with nothing present', () => {
    expect(applyClass(['mt-4'], 'rounded-lg', MAP)).toEqual(['mt-4', 'rounded-lg']);
  });

  it('is a no-op when the class is already there', () => {
    expect(applyClass(['mt-4', 'p-4'], 'mt-4', MAP)).toEqual(['mt-4', 'p-4']);
  });

  it('clears out a pre-existing fight rather than leaving half of it', () => {
    // If the markup already carried mt-4 and mt-6, adding mt-8 must remove both.
    expect(applyClass(['mt-4', 'mt-6', 'p-4'], 'mt-8', MAP)).toEqual(['mt-8', 'p-4']);
  });
});

describe('padding shorthand and axis coexist (brief item 40)', () => {
  it('keeps p-4 when px-6 is added', () => {
    // Jamie, 2026-08-18: "why do you need to add top and bottom padding if I say
    // inline only?" Tailwind emits the shorthand BEFORE the axis utility, so
    // `p-4 px-6` already means 6 inline, 4 block. Both is the correct answer.
    expect(applyClass(['p-4'], 'px-6', MAP)).toEqual(['p-4', 'px-6']);
    expect(collides(MAP, 'p-4', 'px-6')).toBe(false);
  });

  it('still replaces one inline-padding step with another', () => {
    expect(applyClass(['p-4', 'px-4'], 'px-6', MAP)).toEqual(['p-4', 'px-6']);
  });

  it('keeps the two axes apart', () => {
    expect(applyClass(['px-6'], 'py-2', MAP)).toEqual(['px-6', 'py-2']);
  });

  it('does not confuse margin-top with margin-bottom', () => {
    expect(applyClass(['mt-4'], 'mb-4', MAP)).toEqual(['mt-4', 'mb-4']);
  });
});

describe('the prefix trap (brief item 43)', () => {
  it('does not delete the font size when the text is centred', () => {
    // A prefix map would call both of these `text` and replace one with the
    // other. This is the case that makes prefix matching unusable.
    expect(applyClass(['text-sm'], 'text-center', MAP)).toEqual(['text-sm', 'text-center']);
  });

  it('does not delete the font size when a colour is picked', () => {
    expect(applyClass(['text-sm'], 'text-accent', MAP)).toEqual(['text-sm', 'text-accent']);
  });

  it('still replaces one font size with another', () => {
    expect(applyClass(['text-sm'], 'text-2xl', MAP)).toEqual(['text-2xl']);
  });

  it('splits border width, style and colour three ways', () => {
    let classes = ['border-2'];
    classes = applyClass(classes, 'border-accent', MAP);
    classes = applyClass(classes, 'border-solid', MAP);
    expect(classes).toEqual(['border-2', 'border-accent', 'border-solid']);
  });

  it('still replaces one border width with another', () => {
    expect(applyClass(['border-2', 'border-accent'], 'border-4', MAP))
      .toEqual(['border-4', 'border-accent']);
  });

  it('replaces one shadow with another, since both set box-shadow', () => {
    expect(applyClass(['shadow-box'], 'shadow-lg', MAP)).toEqual(['shadow-lg']);
  });
});

describe('classes the map knows nothing about', () => {
  it('never treats an unknown class as a collision', () => {
    // Outside this build, so applying it is already a silent no-op in the
    // browser — brief item 99 is what reports that. It must not also delete
    // something on the way past.
    expect(applyClass(['mt-4'], 'mt-13', MAP)).toEqual(['mt-4', 'mt-13']);
    expect(collides(MAP, 'mt-4', 'mt-13')).toBe(false);
  });

  it('never treats two component classes as a collision', () => {
    // Both have empty property sets. Under a naive equality check, empty equals
    // empty and every component class would replace every other one.
    expect(collides(MAP, 'digit-box', 'digit-box')).toBe(false);
    expect(applyClass(['digit-box'], 'warn', MAP)).toEqual(['digit-box', 'warn']);
  });
});

describe('removing a class', () => {
  it('drops just that one', () => {
    expect(removeClass(['mt-4', 'p-4'], 'mt-4')).toEqual(['p-4']);
  });

  it('leaves the list alone if it was not there', () => {
    expect(removeClass(['mt-4'], 'mt-6')).toEqual(['mt-4']);
  });
});

describe('conflicts already in the markup (brief item 42)', () => {
  it('surfaces a pair that was fighting before edit mode touched it', () => {
    // Not normalised away: this is Jamie's markup and the bot's to fold. But he
    // should know, because anything he changes there will look unpredictable.
    expect(existingConflicts(['mt-4', 'mt-6', 'p-4'], MAP)).toEqual([['mt-4', 'mt-6']]);
  });

  it('finds nothing in a clean list', () => {
    expect(existingConflicts(['mt-4', 'p-4', 'px-6', 'text-sm'], MAP)).toEqual([]);
  });
});
