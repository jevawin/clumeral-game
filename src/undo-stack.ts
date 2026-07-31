// Undo history for the digit boxes (issue #251).
//
// app.ts holds the live board as an array of three Sets and mutates them in
// place, so an undo stack has to store *clones* — pushing a reference would
// capture nothing. Everything here is pure and DOM-free so it can be unit
// tested; app.ts owns the rendering.

export type Board = Set<number>[];

// The hundreds box has no 0: the answer is 100-999.
const STARTING_DIGITS: readonly number[][] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
];

// Far more steps than a real game needs (a board has 29 digits to eliminate),
// but toggling the same digit on and off is unbounded, so the stack is capped
// to keep a fidget session from growing it forever.
export const HISTORY_LIMIT = 100;

export function startingBoard(): Board {
  return STARTING_DIGITS.map((digits) => new Set(digits));
}

export function cloneBoard(board: Board): Board {
  return board.map((box) => new Set(box));
}

/** True when every box still holds its full starting set — nothing to reset. */
export function isStartingBoard(board: Board): boolean {
  return board.every((box, i) => {
    const starting = STARTING_DIGITS[i];
    return box.size === starting.length && starting.every((d) => box.has(d));
  });
}

/**
 * What kind of change an entry steps back over. The Undo control labels itself
 * from this, so a player always knows whether the next press unwinds a single
 * digit or the whole reset.
 */
export type EntryKind = 'toggle' | 'reset';

interface Entry {
  board: Board;
  kind: EntryKind;
}

/**
 * JSON-safe form of one entry, for the sessionStorage round trip. Keys are short
 * because the whole stack is re-serialised on every digit tap.
 */
export interface StoredEntry {
  /** One sorted digit array per box. */
  b: number[][];
  k: EntryKind;
}

export interface History {
  /** Snapshot the board as it stands *before* a change is applied. */
  push(board: Board, kind?: EntryKind): void;
  /** Step back one change. Returns the restored board, or null if empty. */
  undo(): Board | null;
  /** Kind of the change the next undo would step back over, or null if empty. */
  nextKind(): EntryKind | null;
  canUndo(): boolean;
  clear(): void;
  depth(): number;
  /** Plain JSON for persistence. Oldest entry first. */
  toJSON(): StoredEntry[];
  /** Replace the stack from persisted JSON. Callers must validate first. */
  load(entries: StoredEntry[]): void;
}

export function createHistory(limit: number = HISTORY_LIMIT): History {
  const stack: Entry[] = [];

  return {
    push(board, kind = 'toggle') {
      stack.push({ board: cloneBoard(board), kind });
      // Oldest first: the far end of the stack is the least likely to be wanted.
      if (stack.length > limit) stack.splice(0, stack.length - limit);
    },

    undo() {
      const previous = stack.pop();
      // Clone on the way out too, so the caller mutating the restored board
      // (which app.ts does, on the very next toggle) can't reach into the stack.
      return previous ? cloneBoard(previous.board) : null;
    },

    nextKind() {
      return stack.length > 0 ? stack[stack.length - 1].kind : null;
    },

    canUndo() {
      return stack.length > 0;
    },

    clear() {
      stack.length = 0;
    },

    depth() {
      return stack.length;
    },

    toJSON() {
      // Sorted so the payload is stable between saves — otherwise Set iteration
      // order (insertion order, and re-adding a digit puts it at the end) would
      // make identical boards serialise differently.
      return stack.map((e) => ({
        b: e.board.map((box) => [...box].sort((x, y) => x - y)),
        k: e.kind,
      }));
    },

    load(entries) {
      // Rebuild the Sets rather than holding the caller's arrays, so later
      // mutation of the parsed payload can't reach into the stack.
      stack.length = 0;
      for (const e of entries) {
        stack.push({ board: e.b.map((digits) => new Set(digits)), kind: e.k });
      }
      // A payload longer than the cap (an older build with a bigger limit, or a
      // forged one) is trimmed the same way a live push would trim it.
      if (stack.length > limit) stack.splice(0, stack.length - limit);
    },
  };
}
