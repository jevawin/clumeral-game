import { describe, it, expect } from 'vitest';
import { createCatalogue } from '../src/edit-mode/catalogue.ts';
import { scaleFor, step, isSteppable } from '../src/edit-mode/scale.ts';

// C5 — the steppers (brief items 10, 36).
//
// Search answers WHICH utility; steppers answer HOW MUCH. Keeping them apart is
// why search never has to enumerate every step of every scale.

const CLASSES = [
  '-mt-2', '-mt-1', 'mt-0', 'mt-0.5', 'mt-1', 'mt-2', 'mt-4', 'mt-9', 'mt-10', 'mt-96',
  'mt-px', 'mt-auto',
  'mb-4', 'px-4', 'px-6',
  'text-sm', 'text-lg', 'flex',
];

const FAMILIES: Record<string, string[]> = Object.fromEntries([
  ...CLASSES.filter((c) => c.includes('mt-')).map((c) => [c, ['margin-top']]),
  ['mb-4', ['margin-bottom']],
  ['px-4', ['padding-inline']], ['px-6', ['padding-inline']],
  ['text-sm', ['font-size', 'line-height']], ['text-lg', ['font-size', 'line-height']],
  ['flex', ['display']],
]);

const catalogue = createCatalogue(CLASSES, FAMILIES);

describe('the scale is ordered like a number line', () => {
  it('sorts numerically, not alphabetically', () => {
    // Alphabetically, mt-10 sorts between mt-1 and mt-2 — so + from mt-9 would
    // jump somewhere unpredictable.
    const scale = scaleFor(catalogue, 'mt-4');
    expect(scale.indexOf('mt-9')).toBeLessThan(scale.indexOf('mt-10'));
    expect(scale.indexOf('mt-2')).toBeLessThan(scale.indexOf('mt-9'));
  });

  it('handles fractional steps', () => {
    const scale = scaleFor(catalogue, 'mt-4');
    expect(scale.indexOf('mt-0')).toBeLessThan(scale.indexOf('mt-0.5'));
    expect(scale.indexOf('mt-0.5')).toBeLessThan(scale.indexOf('mt-1'));
  });

  it('runs the negatives below zero as one continuous line', () => {
    // Stepping down past zero into the negatives is what "walk the scale"
    // should mean.
    const scale = scaleFor(catalogue, 'mt-1');
    expect(scale.slice(0, 4)).toEqual(['-mt-2', '-mt-1', 'mt-0', 'mt-0.5']);
  });

  it('puts named steps after the numbers, where they can still be reached', () => {
    // px and auto have no place on a number line, but stepping must still get
    // to them rather than pretending they do not exist.
    const scale = scaleFor(catalogue, 'mt-4');
    expect(scale.slice(-2)).toEqual(['mt-auto', 'mt-px']);
  });

  it('keeps different utilities apart even when they set the same property', () => {
    // The family map says mt-4 and -mt-4 are both margin-top, which is right
    // for deciding whether they fight. The stepper needs one ordered line and
    // must not sweep in mb-4.
    expect(scaleFor(catalogue, 'mt-4')).not.toContain('mb-4');
  });
});

describe('stepping', () => {
  it('goes up one', () => {
    expect(step(catalogue, 'mt-1', 'up')).toBe('mt-2');
    expect(step(catalogue, 'mt-9', 'up')).toBe('mt-10');
  });

  it('goes down one', () => {
    expect(step(catalogue, 'mt-2', 'down')).toBe('mt-1');
  });

  it('steps down through zero into the negatives', () => {
    expect(step(catalogue, 'mt-0', 'down')).toBe('-mt-1');
    expect(step(catalogue, '-mt-1', 'down')).toBe('-mt-2');
  });

  it('steps back up out of the negatives', () => {
    expect(step(catalogue, '-mt-1', 'up')).toBe('mt-0');
  });

  it('stops at the ends rather than wrapping', () => {
    // Hitting the edge of the scale is INFORMATION (brief item 10): when the
    // scale has no right answer, Jamie says so in words and the token set gets
    // discussed. Wrapping round to the smallest value would hide that.
    expect(step(catalogue, '-mt-2', 'down')).toBeNull();
    expect(step(catalogue, 'mt-px', 'up')).toBeNull();
  });

  it('says nothing for a class that is not on a scale', () => {
    expect(step(catalogue, 'flex', 'up')).toBeNull();
    expect(isSteppable(catalogue, 'flex')).toBe(false);
  });

  it('says nothing for a class outside this build', () => {
    expect(step(catalogue, 'mt-13', 'up')).toBeNull();
  });

  it('knows which classes the steppers can walk', () => {
    expect(isSteppable(catalogue, 'mt-4')).toBe(true);
    expect(isSteppable(catalogue, 'text-sm')).toBe(true);
    expect(isSteppable(catalogue, 'mb-4')).toBe(false);
  });
});

describe('the text-size scale', () => {
  it('walks named sizes even with no numbers in them', () => {
    // Alphabetical is the only order available here, and it is at least
    // predictable. Jamie is looking at the result while he taps.
    expect(scaleFor(catalogue, 'text-sm')).toEqual(['text-lg', 'text-sm']);
  });
});
