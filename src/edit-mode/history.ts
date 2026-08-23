// Clumeral edit mode — undo, and the back gesture.
//
// Jamie, 2026-08-18: "log changes to history so back button undoes. If I ever
// accidentally fuck anything I can use back button to undo." (brief item 66)
//
// THE TRAP, and why this module is pure and heavily tested. src/router.ts:199
// listens for popstate and re-renders the screen. A re-render rebuilds DOM,
// which would throw away exactly the class changes back was supposed to step
// through — so back would WIPE every edit instead of undoing one, silently
// (brief item 67).
//
// Three things stop that, and no one of them is trusted alone:
//
//   1. Every entry is pushed AT THE CURRENT URL. So even if the router does run,
//      it resolves the screen already on display — a re-render of the same
//      screen, never a navigation to a different one.
//   2. THE PATCH SET IS THE TRUTH AND THE DOM IS A PROJECTION. Undo pops one
//      entry and re-projects. If the router rebuilt the DOM, re-projection puts
//      the remaining edits back; if it did not, re-projection is a no-op. So
//      correctness does not depend on listener order at all.
//   3. The overlay's script is injected ahead of the app entry, so its popstate
//      listener registers first and the re-render does not happen in practice.
//
// (3) is what keeps Jamie's manual check honest — "the screen does not reload" —
// and (2) is what makes it safe when (3) eventually breaks.

/** One settled change. Not one tap: see collapsing below. */
export interface Change {
  /** Which element, by breadcrumb. The DOM may be rebuilt under us. */
  target: string;
  /** What the class list was before this change, so undo can restore it. */
  before: string[];
  after: string[];
  /**
   * What this change adjusted, for collapsing rapid steps. The family key from
   * the family map — `margin-top`, `font-size, line-height` — so stepping mt-4
   * up to mt-9 collapses but changing padding in between does not.
   */
  property: string;
  /**
   * Which patch kind this becomes in the session file.
   *
   * Carried PER CHANGE, not per session. Marking every patch `raw` because the
   * raw field was used once would tell /fold that Jamie hand-typed classes he
   * picked from search — and hand him a `typed` string that belongs to a
   * different element (brief items 94, 96).
   */
  kind?: 'classes' | 'raw';
  /** What he typed, on a `raw` change only. May not be a class this build has. */
  typed?: string;
}

export interface HistoryOptions {
  /**
   * How long after a step another step still counts as the same adjustment.
   *
   * Holding `+` walks the scale, and each tap must not become its own entry or
   * backing out of a ten-tap adjustment takes ten swipes (brief item 68).
   * 600ms is a deliberate guess: long enough to cover a steady thumb, short
   * enough that a considered second change is its own entry.
   */
  collapseWindowMs?: number;
}

const DEFAULT_COLLAPSE_MS = 600;

export interface History {
  /** Settled changes, oldest first. */
  readonly entries: readonly Change[];
  readonly isEmpty: boolean;
  /**
   * Record a change. Returns true if it became a NEW entry, false if it
   * collapsed into the previous one — the caller pushes a history state only
   * when it is true, or back gets an entry with nothing behind it.
   */
  record(change: Change, now: number): boolean;
  /** Step back one. Returns the change undone, or null if there was none. */
  undo(): Change | null;
  /** Every element's current class list, which is what project() applies. */
  projection(): Map<string, string[]>;
  /** Restore a saved history — a reload must not lose the inverses (M5). */
  restore(entries: Change[]): void;
  /**
   * What this element looked like before edit mode touched it.
   *
   * The `before` of its FIRST entry, rather than a separate map: a separate map
   * lives only in memory, so after a reload Reset element would quietly restore
   * nothing.
   */
  originalOf(target: string): string[] | undefined;
}

export function createHistory(options: HistoryOptions = {}): History {
  const window = options.collapseWindowMs ?? DEFAULT_COLLAPSE_MS;
  const entries: Change[] = [];
  let lastAt = -Infinity;

  return {
    get entries() { return entries; },
    get isEmpty() { return entries.length === 0; },

    record(change, now) {
      const previous = entries[entries.length - 1];
      const sameAdjustment =
        previous !== undefined &&
        previous.target === change.target &&
        previous.property === change.property &&
        now - lastAt < window;

      lastAt = now;

      if (sameAdjustment) {
        // Keep the ORIGINAL before: undoing a ten-tap walk has to land back
        // where the walk started, not one step in.
        previous.after = change.after;
        return false;
      }

      entries.push({ ...change });
      return true;
    },

    undo() {
      const undone = entries.pop() ?? null;
      // A fresh adjustment after an undo must never collapse into whatever is
      // now on top of the stack — that would edit an entry Jamie already
      // stepped past.
      lastAt = -Infinity;
      return undone;
    },

    projection() {
      const byTarget = new Map<string, string[]>();
      for (const entry of entries) byTarget.set(entry.target, entry.after);
      return byTarget;
    },

    originalOf(target) {
      return entries.find((entry) => entry.target === target)?.before;
    },

    restore(saved) {
      entries.length = 0;
      entries.push(...saved.map((c) => ({ ...c })));
      lastAt = -Infinity;
    },
  };
}

/**
 * What the back gesture should do next.
 *
 * Brief items 69, 70 and 104, in one place because they interact:
 *
 *   - While edits remain, back undoes one. Even in PLAY mode: flipping to play
 *     to try a change is normal (item 30), and if back were handed straight to
 *     the router at that moment the first press would re-render and destroy
 *     every edit. So the interception outlives the mode (item 104).
 *   - With nothing left to undo, back returns to play mode.
 *   - From play mode with nothing left, back is the page's own — one more press
 *     leaves as normal (item 70, "back out").
 */
export type BackAction = 'undo' | 'leave-edit-mode' | 'release-to-page';

export function nextBackAction(history: History, mode: 'play' | 'edit'): BackAction {
  if (!history.isEmpty) return 'undo';
  if (mode === 'edit') return 'leave-edit-mode';
  return 'release-to-page';
}

/**
 * Should edit mode still be holding on to back?
 *
 * Once this is false the page's own history behaviour is restored, and Jamie's
 * next back press leaves the page as it always would.
 */
export function stillOwnsBack(history: History, mode: 'play' | 'edit'): boolean {
  return !history.isEmpty || mode === 'edit';
}
