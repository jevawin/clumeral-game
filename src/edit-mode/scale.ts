// Clumeral edit mode — walking the scale with the steppers.
//
// Search and steppers do different jobs and both are needed (brief item 36):
// search answers WHICH utility (flex, items-center, rounded-lg); steppers answer
// HOW MUCH (mt-4 -> mt-5). Keeping them apart is why search never has to
// enumerate every step of every scale.
//
// The scale is derived from the catalogue, not hand-written, so it cannot drift
// from what the stylesheet actually contains.

import type { Catalogue } from './catalogue.ts';

/** `mt-4` -> `mt`, `-mt-4` -> `-mt`, `text-sm` -> `text`. */
function prefixOf(name: string): string {
  const at = name.lastIndexOf('-');
  return at <= 0 ? name : name.slice(0, at);
}

/** The bit that varies: `mt-4` -> `4`, `mt-px` -> `px`. */
function suffixOf(name: string): string {
  const at = name.lastIndexOf('-');
  return at <= 0 ? '' : name.slice(at + 1);
}

/**
 * Where a class sits on its scale.
 *
 * Numeric steps sort by value, so mt-10 comes after mt-9 rather than after
 * mt-1. Named steps (px, auto, full) have no place on a number line, so they
 * sort alphabetically after the numbers — predictable, and stepping still
 * reaches them.
 *
 * Negatives sort below zero, which makes -mt-2, -mt-1, mt-0, mt-1 one
 * continuous scale. Stepping down past zero into the negatives is exactly what
 * "walk the scale" should mean.
 */
function order(name: string): [number, number, string] {
  const negative = name.startsWith('-');
  const suffix = suffixOf(name);
  const value = Number.parseFloat(suffix);
  if (Number.isNaN(value)) return [1, 0, suffix];
  return [0, negative ? -value : value, ''];
}

function compare(a: string, b: string): number {
  const [groupA, valueA, textA] = order(a);
  const [groupB, valueB, textB] = order(b);
  if (groupA !== groupB) return groupA - groupB;
  if (valueA !== valueB) return valueA - valueB;
  return textA.localeCompare(textB);
}

/**
 * Every step of the scale this class belongs to, in order.
 *
 * Matched on the PREFIX rather than the family map, and deliberately: the map
 * says mt-4 and -mt-4 are the same family (both margin-top), which is right for
 * deciding whether they fight — but the stepper needs them as one ordered line,
 * and it must not sweep in a different utility that happens to set the same
 * property.
 */
export function scaleFor(catalogue: Catalogue, className: string): string[] {
  const bare = className.startsWith('-') ? className.slice(1) : className;
  const prefix = prefixOf(bare);
  if (!prefix) return [];

  const steps = catalogue.classes.filter((candidate) => {
    const candidateBare = candidate.startsWith('-') ? candidate.slice(1) : candidate;
    return prefixOf(candidateBare) === prefix;
  });

  return steps.sort(compare);
}

export type Direction = 'up' | 'down';

/**
 * One step along the scale.
 *
 * Returns null at the ends rather than wrapping. Hitting the edge of the scale
 * is INFORMATION, not an obstacle (brief item 10): when the scale has no right
 * answer, Jamie says so in words and the token set gets discussed. Wrapping
 * round to the smallest value would hide that.
 */
export function step(catalogue: Catalogue, className: string, direction: Direction): string | null {
  const scale = scaleFor(catalogue, className);
  const at = scale.indexOf(className);
  if (at === -1) return null;
  const next = direction === 'up' ? at + 1 : at - 1;
  return scale[next] ?? null;
}

/** Is this class something the steppers can walk? */
export function isSteppable(catalogue: Catalogue, className: string): boolean {
  return scaleFor(catalogue, className).length > 1;
}
