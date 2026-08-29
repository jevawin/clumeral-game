// Clumeral edit mode — spotting classes the game controls.
//
// Some classes are set at runtime, not written in the markup: theme.ts toggles
// `.dark`, and several modules toggle `.hidden`. An edit to one of those gets
// overwritten on the next render, and its fold-back target is a CONDITION in
// code rather than a literal in a template. So the change must be flagged rather
// than silently lost (brief item 37).
//
// WHEN THIS CAN RUN, which the brief had to correct itself on (item 109): edit
// mode stops the game rendering, so a class the game would reset never gets
// reset while the panel is open — and the detector written for the `.hidden`
// case would never fire for it. The check therefore runs ACROSS A PLAY-MODE
// ROUND TRIP: on returning from play mode, re-read every edited element and see
// what moved. That is the only moment the game has actually rendered.

import { findByBreadcrumb } from './project.ts';

/** What the overlay believes each edited element's classes are. */
export type Expected = Map<string, string[]>;

export interface Overwrite {
  breadcrumb: string;
  /** Classes the overlay applied that are no longer there. */
  removed: string[];
  /** Classes the game added that the overlay did not. */
  added: string[];
}

/** Read the live class lists of the elements we have edited. */
export function readActual(doc: Document, breadcrumbs: Iterable<string>): Map<string, string[]> {
  const actual = new Map<string, string[]>();
  for (const breadcrumb of breadcrumbs) {
    const el = findByBreadcrumb(doc, breadcrumb);
    // Gone means the game navigated elsewhere, not that a class was reset.
    // Reporting that as an overwrite would cry wolf on every screen change.
    if (el) actual.set(breadcrumb, [...el.classList]);
  }
  return actual;
}

/**
 * What the game changed behind our back.
 *
 * Only elements present in BOTH maps are compared, for the reason above.
 */
export function detectOverwrites(expected: Expected, actual: Map<string, string[]>): Overwrite[] {
  const overwrites: Overwrite[] = [];

  for (const [breadcrumb, want] of expected) {
    const have = actual.get(breadcrumb);
    if (!have) continue;

    const removed = want.filter((c) => !have.includes(c));
    const added = have.filter((c) => !want.includes(c));
    if (removed.length || added.length) overwrites.push({ breadcrumb, removed, added });
  }

  return overwrites;
}

/**
 * Which of an element's classes are runtime-controlled, as far as we can tell.
 *
 * Used to decide whether a patch carries the `runtime-controlled` flag. It
 * reports what was OBSERVED to move, not a hard-coded list of `.dark` and
 * `.hidden` — a list would go stale the moment a new module toggles something,
 * and going stale silently is the failure this whole check exists to prevent.
 */
export function overwrittenClasses(overwrite: Overwrite): string[] {
  return [...overwrite.removed, ...overwrite.added].sort();
}
