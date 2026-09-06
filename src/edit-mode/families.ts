// Clumeral edit mode — which classes fight, and what to do about it.
//
// BROWSER SIDE. Pure. Takes the generated family map as an argument.
//
// This is the module the brief calls "the single most likely source of silent
// wrongness" (item 38), and the failure it prevents is specific: an element has
// `mt-4`, Jamie picks `mt-6`, and if both end up on the element then CSS ORDER
// decides the winner, not class order. The tap appears to do nothing. So the
// overlay replaces rather than appends — but only when the two classes really
// are fighting.
//
// "Really fighting" is decided by the CSS PROPERTIES each class declares, not by
// its name. See edit-mode/classlist.ts for how the map is built and why a prefix
// rule is wrong.

import type { FamilyMap } from './catalogue.ts';

/**
 * Do these two classes fight over the same declarations?
 *
 * Exact set equality, deliberately — not subset, not overlap.
 *
 *   mt-4 / mt-6              margin-top = margin-top                 -> fight
 *   px-4 / px-6              padding-inline = padding-inline         -> fight
 *   p-4  / px-6              padding != padding-inline               -> coexist
 *   text-sm / text-center    font-size,line-height != text-align     -> coexist
 *   border-2 / border-solid  {style,width} != {style}                -> coexist
 *
 * The last one is why subset would be wrong: `border-2` declares border-style as
 * well as border-width, so under a subset rule adding `border-solid` would eat
 * it. Under equality both stay, CSS settles border-style to the same value
 * either way, and nothing is lost. Brief item 42 — record what Jamie did, do not
 * be clever on his behalf.
 *
 * A class the map does not know (a component class, or something outside this
 * build) never fights. Brief item 99 is what tells him if it did nothing.
 */
export function collides(map: FamilyMap, a: string, b: string): boolean {
  if (a === b) return false;
  const pa = map[a];
  const pb = map[b];
  if (!pa?.length || !pb?.length) return false;
  return pa.length === pb.length && pa.every((prop, i) => prop === pb[i]);
}

/**
 * Add a class, replacing anything it fights with.
 *
 * Order is preserved: a replacement lands where the class it replaced was, so
 * the chip list does not reshuffle under Jamie's thumb every time he steps a
 * value. Adding something new appends.
 */
export function applyClass(classes: string[], incoming: string, map: FamilyMap): string[] {
  if (classes.includes(incoming)) return [...classes];

  const out: string[] = [];
  let placed = false;
  for (const existing of classes) {
    if (collides(map, existing, incoming)) {
      if (!placed) {
        out.push(incoming);
        placed = true;
      }
      // Otherwise drop it: two classes already fighting each other both lose to
      // the new one, and leaving either would put us back in CSS-order
      // roulette.
      continue;
    }
    out.push(existing);
  }
  if (!placed) out.push(incoming);
  return out;
}

/** Remove a class. Tapping a chip. */
export function removeClass(classes: string[], name: string): string[] {
  return classes.filter((c) => c !== name);
}

/**
 * What appending WOULD have produced.
 *
 * Exists for the test the design asks for by name: assert the *failing* case —
 * that appending `mt-6` beside `mt-4` is a no-op — rather than only asserting
 * that replacing works. A test that passes without the fix pins nothing.
 */
export function appendClass(classes: string[], incoming: string): string[] {
  return classes.includes(incoming) ? [...classes] : [...classes, incoming];
}

/**
 * Which of an element's classes fight with each other already?
 *
 * The game's own markup can carry a pair the overlay would never create — and
 * if it does, whatever Jamie changes there will look unpredictable, because CSS
 * order is deciding. Surfaced rather than silently normalised: this is his
 * markup and the bot's job to fold, not ours to rewrite (brief item 42).
 */
export function existingConflicts(classes: string[], map: FamilyMap): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      if (collides(map, classes[i], classes[j])) pairs.push([classes[i], classes[j]]);
    }
  }
  return pairs;
}
