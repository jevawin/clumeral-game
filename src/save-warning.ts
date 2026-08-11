// Clumeral — save-warning.ts
// Unticking "Save my scores on this device" warns that submitting will delete
// the stored results, and holds submit for five seconds. Pure state, no DOM.
//
// Nothing is deleted here and nothing is deleted when the countdown ends. The
// deletion happens on the next solve, in the solve path, from the stored
// preference (brief 65). This module only decides what the screen says and
// whether submit is available.
//
// Why five seconds is worth having at all: it is the whole confirmation step.
// There is no second click to catch a mis-tap, so the pause plus the visible
// warning is what stands between an accidental tap and a deletion. A later
// reader will be tempted to remove it as friction; it is load-bearing.

/** How long submit is held after an untick. */
export const COUNTDOWN_MS = 5_000;

/** Jamie's wording, used verbatim (2026-08-10). */
export const WARNING_TEXT = 'Your existing stats will be deleted when you submit.';

export interface SaveWarningState {
  /** Is the warning showing? True for as long as the box stays unticked. */
  warning: boolean;
  /** Whole seconds still to wait: 5, 4, 3, 2, 1, then 0. */
  secondsLeft: number;
  /** Can the player submit? */
  submitAvailable: boolean;
}

export interface SaveWarning {
  /** The checkbox changed. Only an untick starts a countdown. */
  setChecked(checked: boolean): void;
  /** Read the current state. Always computed from the clock, never from a timer
   *  that fired — so a tab hidden across the five seconds comes back available
   *  rather than stuck. */
  state(): SaveWarningState;
}

export function createSaveWarning(opts: { now?: () => number } = {}): SaveWarning {
  const now = opts.now ?? Date.now;

  // null means the box is ticked, or was already unticked when the screen
  // loaded. The warning belongs to the ACTION of unticking, not to the stored
  // preference: a player who opted out weeks ago has nothing to be warned about.
  let untickedAt: number | null = null;

  return {
    setChecked(checked: boolean): void {
      if (checked) { untickedAt = null; return; }
      // Untick → restart the full five seconds. Unticking, re-ticking and
      // unticking again gives a fresh countdown rather than resuming the first.
      untickedAt = now();
    },
    state(): SaveWarningState {
      if (untickedAt === null) {
        return { warning: false, secondsLeft: 0, submitAvailable: true };
      }
      const remaining = untickedAt + COUNTDOWN_MS - now();
      if (remaining <= 0) {
        return { warning: true, secondsLeft: 0, submitAvailable: true };
      }
      return {
        warning: true,
        secondsLeft: Math.ceil(remaining / 1000),
        submitAvailable: false,
      };
    },
  };
}
