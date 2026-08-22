// Clumeral edit mode — putting the patch set onto the page.
//
// The patch set is the truth; the DOM is a projection of it. This module is
// what makes that sentence true, and it has two callers that look different and
// are the same job:
//
//   - UNDO. Back pops one entry and re-projects. If the router re-rendered the
//     screen underneath us, re-projection puts the remaining edits back; if it
//     did not, re-projection is a no-op. Correctness stops depending on whose
//     popstate listener ran first (brief item 67).
//   - DAVE'S REPLAY. The dev server hands every unconsumed session to any page
//     load and this applies them, so Dave sees the edit one beat later, on his
//     own refresh (brief item 21).
//
// One mechanism, two users, which is why undo costs nothing extra.

import { ancestry, crumb, isOverlay } from './select.ts';

/**
 * Find the element a breadcrumb names.
 *
 * Breadcrumbs are the identity because element references do not survive a
 * re-render, and nothing in the browser knows an element's source location
 * (brief item 32). Walking the tree by crumb is what survives the DOM being
 * rebuilt underneath us.
 *
 * Returns null rather than guessing when the path no longer resolves — the game
 * may simply have navigated to another screen, and applying a patch to the
 * wrong element is worse than applying none.
 */
export function findByBreadcrumb(root: Document, breadcrumb: string): Element | null {
  const wanted = breadcrumb.split(' > ');
  if (wanted.length === 0) return null;

  let current: Element = root.body;
  // A breadcrumb of just "body" selects body itself.
  if (wanted.length === 1 && wanted[0] === 'body') return current;

  for (const step of wanted) {
    let found: Element | null = null;
    for (const child of current.children) {
      if (isOverlay(child)) continue;
      if (crumb(child) === step) { found = child; break; }
    }
    if (!found) return null;
    current = found;
  }
  return current;
}

/** The breadcrumb of an element, as project() and the patch set use it. */
export function breadcrumbOf(el: Element): string {
  const chain = ancestry(el);
  return chain.length ? chain.map(crumb).join(' > ') : crumb(el);
}

export interface ProjectionResult {
  applied: number;
  /** Breadcrumbs that no longer resolve — a different screen, most likely. */
  missing: string[];
}

/**
 * Apply a whole patch set to the page.
 *
 * Idempotent: applying the same projection twice leaves the same DOM, which is
 * what lets it be called on every undo and on every page load without keeping
 * track of whether it already ran.
 */
export function project(doc: Document, projection: Map<string, string[]>): ProjectionResult {
  let applied = 0;
  const missing: string[] = [];

  for (const [breadcrumb, classes] of projection) {
    const el = findByBreadcrumb(doc, breadcrumb);
    if (!el) { missing.push(breadcrumb); continue; }
    el.className = classes.join(' ');
    applied++;
  }

  return { applied, missing };
}
