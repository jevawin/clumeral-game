// Clumeral edit mode — surviving the tab going away.
//
// This is phone editing. Safari discards backgrounded tabs, the screen locks, a
// notification pulls him out. Losing twenty minutes of tweaks to an accidental
// app switch would make edit mode untrustworthy, and the fix is a few lines
// (brief item 52).
//
// ON THE PHONE, NOT THE SERVER. Jamie, 2026-08-18: "keep it on my phone not on
// the server." Nothing unfinished is sent to the Pi, so the server only ever
// holds what Done produced — which also keeps Dave's replay honest, because
// unfinished sessions do not exist outside Jamie's browser (item 54).
//
// sessionStorage rather than localStorage, deliberately: it clears with the tab
// and so cannot resurrect a stale edit days later against different source.

import type { Change } from './history.ts';

export interface StoredState {
  /** The undo stack. Without the inverses, back cannot honour the entries the
   *  browser still holds after a reload (brief item 105). */
  entries: Change[];
  /** Whether edit mode was on, so a reload does not silently drop him back
   *  into play mode (brief item 53). */
  mode: 'play' | 'edit';
  /** What was selected, by breadcrumb, so the reload does not lose his place. */
  selected: string | null;
}

const EMPTY: StoredState = { entries: [], mode: 'play', selected: null };

/**
 * Keyed to the branch.
 *
 * The browser cannot know which branch it is looking at, so the plugin injects
 * it (finding L3). Keying matters because a patch set describes elements in one
 * tree — restoring it against a different branch's markup would apply edits to
 * whatever happened to match.
 */
export function storageKey(branch: string): string {
  return `clumeral_edit_${branch}`;
}

export interface SessionStore {
  load(): StoredState;
  save(state: StoredState): void;
  clear(): void;
}

export function createSessionStore(branch: string, storage: Storage): SessionStore {
  const key = storageKey(branch);

  return {
    load() {
      try {
        const raw = storage.getItem(key);
        if (!raw) return { ...EMPTY };
        const parsed = JSON.parse(raw) as Partial<StoredState>;
        return {
          entries: Array.isArray(parsed.entries) ? parsed.entries : [],
          mode: parsed.mode === 'edit' ? 'edit' : 'play',
          selected: typeof parsed.selected === 'string' ? parsed.selected : null,
        };
      } catch {
        // Corrupt or unreadable — start clean rather than throwing on boot and
        // taking the page down with us. Losing an unfinished edit is bad; a
        // white screen is worse, and the game is underneath.
        return { ...EMPTY };
      }
    },

    save(state) {
      try {
        storage.setItem(key, JSON.stringify(state));
      } catch {
        // Private mode, or the quota is full. The edit still lives in memory
        // and Done still works — this only costs him the reload safety net.
      }
    },

    clear() {
      try {
        storage.removeItem(key);
      } catch { /* as above */ }
    },
  };
}
