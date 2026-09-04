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
 * The t-shirt scale, in the order a human means it.
 *
 * `text-sm`, `rounded-lg` and friends have no number to sort by, and
 * alphabetical gives `2xl, base, lg, sm, xl, xs` — which is not a scale, it is a
 * list. Jamie's report: "some cycle-able chips aren't, like font".
 */
const SIZE_ORDER = [
  '3xs', '2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl',
  '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
];

/**
 * Where a class sits on its scale.
 *
 * Three bands, in this order: numbers, named sizes, then anything else
 * alphabetically. Named steps (px, auto, full) have no place on a number line
 * but stepping must still reach them.
 *
 * Negatives sort below zero, so -mt-2, -mt-1, mt-0, mt-1 is one continuous
 * scale.
 */
function order(name: string): [number, number, string] {
  const negative = name.startsWith('-');
  const suffix = suffixOf(name);

  // The WHOLE suffix must be a number. parseFloat('2xl') is 2, which sorted
  // text-2xl as if it were the number two while text-sm sorted as text — so the
  // font scale was in no order at all.
  if (/^\d+(\.\d+)?$/.test(suffix)) {
    const value = Number.parseFloat(suffix);
    return [0, negative ? -value : value, ''];
  }

  const sizeAt = SIZE_ORDER.indexOf(suffix);
  if (sizeAt !== -1) return [1, sizeAt, ''];

  return [2, 0, suffix];
}

function compare(a: string, b: string): number {
  const [bandA, valueA, textA] = order(a);
  const [bandB, valueB, textB] = order(b);
  if (bandA !== bandB) return bandA - bandB;
  if (valueA !== valueB) return valueA - valueB;
  return textA.localeCompare(textB);
}

/** Every step of the scale this class belongs to, in order. */
export function scaleFor(catalogue: Catalogue, className: string): string[] {
  const bare = className.startsWith('-') ? className.slice(1) : className;
  const prefix = prefixOf(bare);
  if (!prefix) return [];

  // Same prefix AND the same CSS properties.
  //
  // Prefix alone was wrong, and it is what broke the font steppers: `text-sm`,
  // `text-2xl` and `text-accent` all have the prefix `text`, so the font-size
  // scale swept in several hundred colours and stepping landed anywhere.
  // Matching the family map too is the same rule used everywhere else — a
  // utility's family is what it DECLARES, not what it is called.
  const properties = catalogue.properties(className)?.join(',');
  if (!properties) return [];

  const steps = catalogue.classes.filter((candidate) => {
    const candidateBare = candidate.startsWith('-') ? candidate.slice(1) : candidate;
    if (prefixOf(candidateBare) !== prefix) return false;
    return catalogue.properties(candidate)?.join(',') === properties;
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
