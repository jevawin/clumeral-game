import { describe, it, expect } from 'vitest';
import {
  startingBoard,
  cloneBoard,
  isStartingBoard,
  createHistory,
  HISTORY_LIMIT,
} from '../src/undo-stack.ts';
import type { Board } from '../src/undo-stack.ts';

// Boards are Set<number>[] — three boxes, hundreds first. Compared as arrays of
// sorted arrays so a failure prints the digits rather than "Set(9) !== Set(9)".
function shape(board: Board): number[][] {
  return board.map((s) => [...s].sort((a, b) => a - b));
}

describe('startingBoard', () => {
  it('gives hundreds 1-9 and tens/units 0-9', () => {
    expect(shape(startingBoard())).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    ]);
  });

  it('returns a fresh board each call — mutating one must not affect the next', () => {
    const first = startingBoard();
    first[0].delete(5);
    expect(startingBoard()[0].has(5)).toBe(true);
  });
});

describe('cloneBoard', () => {
  it('copies the digits', () => {
    const board = startingBoard();
    board[1].delete(3);
    expect(shape(cloneBoard(board))).toEqual(shape(board));
  });

  // The whole reason the history stack exists: app.ts mutates the Sets in place,
  // so storing a reference would capture nothing.
  it('is a deep copy — mutating the original leaves the clone alone', () => {
    const board = startingBoard();
    const copy = cloneBoard(board);
    board[0].delete(7);
    expect(copy[0].has(7)).toBe(true);
  });

  it('is a deep copy in the other direction too', () => {
    const board = startingBoard();
    const copy = cloneBoard(board);
    copy[2].delete(4);
    expect(board[2].has(4)).toBe(true);
  });
});

describe('isStartingBoard', () => {
  it('is true for an untouched board', () => {
    expect(isStartingBoard(startingBoard())).toBe(true);
  });

  it('is false once any digit is eliminated', () => {
    const board = startingBoard();
    board[2].delete(0);
    expect(isStartingBoard(board)).toBe(false);
  });

  it('is false when only the hundreds box has changed', () => {
    const board = startingBoard();
    board[0].delete(9);
    expect(isStartingBoard(board)).toBe(false);
  });

  // Drives the Reset button's disabled state: eliminate, then put it back by
  // re-tapping, and there is nothing left to reset even though history is non-empty.
  it('is true again after an elimination is manually undone', () => {
    const board = startingBoard();
    board[1].delete(6);
    board[1].add(6);
    expect(isStartingBoard(board)).toBe(true);
  });

  it('is false for a solved board collapsed to single digits', () => {
    const board: Board = [new Set([4]), new Set([1]), new Set([7])];
    expect(isStartingBoard(board)).toBe(false);
  });
});

// The Undo button reads "Undo reset" whenever the NEXT step back would undo a
// reset, so the stack has to remember what each entry was, not just the board.
describe('entry kinds', () => {
  it('reports no kind for an empty stack', () => {
    expect(createHistory().nextKind()).toBeNull();
  });

  it('defaults an entry to a toggle', () => {
    const history = createHistory();
    history.push(startingBoard());
    expect(history.nextKind()).toBe('toggle');
  });

  it('reports a reset entry as a reset', () => {
    const history = createHistory();
    history.push(startingBoard(), 'reset');
    expect(history.nextKind()).toBe('reset');
  });

  it('reports the most recent entry, not the oldest', () => {
    const history = createHistory();
    history.push(startingBoard(), 'reset');
    history.push(startingBoard(), 'toggle');
    expect(history.nextKind()).toBe('toggle');
  });

  // The label has to come BACK to "Undo reset" if the player toggles after a
  // reset and then steps back onto the reset entry again.
  it('returns to reset once the toggles above it are undone', () => {
    const history = createHistory();
    history.push(startingBoard(), 'reset');
    history.push(startingBoard(), 'toggle');
    expect(history.nextKind()).toBe('toggle');

    history.undo();
    expect(history.nextKind()).toBe('reset');

    history.undo();
    expect(history.nextKind()).toBeNull();
  });

  it('clear drops the kinds with the boards', () => {
    const history = createHistory();
    history.push(startingBoard(), 'reset');
    history.clear();
    expect(history.nextKind()).toBeNull();
  });
});

describe('createHistory', () => {
  it('starts empty and cannot undo', () => {
    const history = createHistory();
    expect(history.canUndo()).toBe(false);
    expect(history.depth()).toBe(0);
  });

  it('returns null when undoing an empty stack', () => {
    expect(createHistory().undo()).toBeNull();
  });

  it('can undo once something is pushed', () => {
    const history = createHistory();
    history.push(startingBoard());
    expect(history.canUndo()).toBe(true);
    expect(history.depth()).toBe(1);
  });

  it('undo returns the pushed snapshot and pops it', () => {
    const history = createHistory();
    const before = startingBoard();
    history.push(before);

    expect(shape(history.undo()!)).toEqual(shape(before));
    expect(history.canUndo()).toBe(false);
  });

  it('snapshots are taken at push time, not read time', () => {
    const history = createHistory();
    const board = startingBoard();
    history.push(board);
    board[0].delete(1);
    board[0].delete(2);

    expect(history.undo()![0].has(1)).toBe(true);
  });

  it('walks back one step per undo, most recent first', () => {
    const history = createHistory();
    const board = startingBoard();

    history.push(board); // before eliminating 5
    board[1].delete(5);
    history.push(board); // before eliminating 6
    board[1].delete(6);

    // First undo restores 6 but not 5 — one elimination per press.
    const first = history.undo()!;
    expect(first[1].has(6)).toBe(true);
    expect(first[1].has(5)).toBe(false);

    // Second undo goes all the way back.
    const second = history.undo()!;
    expect(second[1].has(5)).toBe(true);
    expect(second[1].has(6)).toBe(true);

    expect(history.canUndo()).toBe(false);
  });

  it('hands out copies — mutating an undone board does not corrupt the stack', () => {
    const history = createHistory();
    const board = startingBoard();
    history.push(board);
    history.push(board);

    const first = history.undo()!;
    first[0].delete(3);

    expect(history.undo()![0].has(3)).toBe(true);
  });

  it('clear empties the stack', () => {
    const history = createHistory();
    history.push(startingBoard());
    history.push(startingBoard());
    history.clear();

    expect(history.canUndo()).toBe(false);
    expect(history.depth()).toBe(0);
    expect(history.undo()).toBeNull();
  });

  it('caps depth and drops the OLDEST entries, keeping the newest', () => {
    // Use a small cap so the snapshots can be tagged distinctly. Each push is
    // preceded by a real elimination, so every snapshot differs — without that,
    // an implementation that dropped the newest entries would pass too.
    const history = createHistory(3);
    const board = startingBoard();

    // Push 5 states into a cap of 3: before eliminating 0, then 1, 2, 3, 4.
    for (let i = 0; i < 5; i++) {
      history.push(board);
      board[1].delete(i);
    }
    expect(history.depth()).toBe(3);

    // The three survivors must be the three most recent: the states before
    // eliminating 2, 3 and 4 respectively. Most recent pops first.
    expect(history.undo()![1].has(4)).toBe(true);  // 4 not yet eliminated
    expect(history.undo()![1].has(3)).toBe(true);
    const oldest = history.undo()!;
    expect(oldest[1].has(2)).toBe(true);
    // ...and that oldest survivor still carries the earlier eliminations, proving
    // it's the third-newest snapshot and not the original starting board.
    expect(oldest[1].has(0)).toBe(false);
    expect(oldest[1].has(1)).toBe(false);

    expect(history.canUndo()).toBe(false);
  });

  it('defaults to HISTORY_LIMIT when no cap is given', () => {
    const history = createHistory();
    const board = startingBoard();
    for (let i = 0; i < HISTORY_LIMIT + 1; i++) history.push(board);

    expect(history.depth()).toBe(HISTORY_LIMIT);
  });

  it('stays usable after the cap is hit', () => {
    const history = createHistory();
    const board = startingBoard();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) history.push(board);

    expect(history.canUndo()).toBe(true);
    for (let i = 0; i < HISTORY_LIMIT; i++) expect(history.undo()).not.toBeNull();
    expect(history.undo()).toBeNull();
  });
});

// The stack survives a reload via sessionStorage, so it has to convert to and
// from plain JSON. Conversion lives here (pure); the storage call lives in
// storage.ts.
describe('serialisation', () => {
  it('serialises an empty stack to an empty array', () => {
    expect(createHistory().toJSON()).toEqual([]);
  });

  it('serialises boards as sorted digit arrays with their kind', () => {
    const history = createHistory();
    const board = startingBoard();
    board[1].delete(4);
    history.push(board, 'reset');

    expect(history.toJSON()).toEqual([
      {
        b: [
          [1, 2, 3, 4, 5, 6, 7, 8, 9],
          [0, 1, 2, 3, 5, 6, 7, 8, 9],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        ],
        k: 'reset',
      },
    ]);
  });

  it('round-trips a stack through JSON', () => {
    const original = createHistory();
    const board = startingBoard();
    original.push(board, 'toggle');
    board[0].delete(7);
    original.push(board, 'reset');

    const revived = createHistory();
    revived.load(JSON.parse(JSON.stringify(original.toJSON())));

    expect(revived.depth()).toBe(2);
    expect(revived.nextKind()).toBe('reset');
    expect(shape(revived.undo()!)).toEqual([
      [1, 2, 3, 4, 5, 6, 8, 9],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    ]);
    expect(revived.nextKind()).toBe('toggle');
  });

  it('load replaces whatever was already on the stack', () => {
    const history = createHistory();
    history.push(startingBoard());
    history.push(startingBoard());
    history.load([{ b: [[1], [2], [3]], k: 'reset' }]);

    expect(history.depth()).toBe(1);
    expect(history.nextKind()).toBe('reset');
  });

  it('load([]) empties the stack', () => {
    const history = createHistory();
    history.push(startingBoard());
    history.load([]);

    expect(history.canUndo()).toBe(false);
  });

  it('load respects the cap, keeping the newest entries', () => {
    const history = createHistory(2);
    history.load([
      { b: [[1], [0], [0]], k: 'toggle' },
      { b: [[2], [0], [0]], k: 'toggle' },
      { b: [[3], [0], [0]], k: 'reset' },
    ]);

    expect(history.depth()).toBe(2);
    expect(history.nextKind()).toBe('reset');
    expect([...history.undo()![0]]).toEqual([3]);
    expect([...history.undo()![0]]).toEqual([2]);
  });

  it('does not alias the loaded data', () => {
    const history = createHistory();
    const data = [{ b: [[1, 2], [0], [0]], k: 'toggle' as const }];
    history.load(data);
    data[0].b[0].push(9);

    expect([...history.undo()![0]]).toEqual([1, 2]);
  });
});

// The board must never be restorable into a state the game itself would refuse.
// Snapshots are only ever taken of states the app already allowed, so this holds
// by construction — these tests pin that invariant so a future refactor can't
// quietly break it.
describe('the last-candidate guard across undo and reset', () => {
  it('never restores a box to zero candidates', () => {
    const history = createHistory();
    const board = startingBoard();

    // Whittle the units box down to a single digit, one legal step at a time.
    for (const d of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      history.push(board);
      board[2].delete(d);
    }
    expect(board[2].size).toBe(1);

    // Every step back is a state the game allowed, so no box is ever empty.
    let restored: Board | null;
    while ((restored = history.undo())) {
      for (const box of restored) expect(box.size).toBeGreaterThan(0);
    }
  });

  it('undoing a reset restores the whole pre-reset board in one step', () => {
    const history = createHistory();
    const board = startingBoard();
    board[0].delete(1);
    board[1].delete(2);
    board[2].delete(3);

    // Reset pushes exactly one entry, then replaces the board wholesale.
    history.push(board);
    const afterReset = startingBoard();

    expect(isStartingBoard(afterReset)).toBe(true);
    expect(history.depth()).toBe(1);

    const restored = history.undo()!;
    expect(restored[0].has(1)).toBe(false);
    expect(restored[1].has(2)).toBe(false);
    expect(restored[2].has(3)).toBe(false);
    expect(history.canUndo()).toBe(false);
  });
});
