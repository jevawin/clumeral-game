import { describe, it, expect } from 'vitest';
import { PROPERTIES, survivorsFor, trimRedundantClues, type Clue } from '../src/worker/puzzle.ts';

// ─── Redundant-clue sweep (#193) ──────────────────────────────────────────────
//
// A clue is redundant when removing it still leaves exactly one valid answer.
// The sweep drops those clues; the generator (Task 2) then retries until the
// trimmed puzzle lands in the 4–6 clue range.
//
// FIXTURE ONE — the redundancy fixture. Answer 323, and A and B are each
// individually removable while C is not. Every count below was verified against
// all 900 candidates on 2026-08-08:
//
//   [A,B,C] → 1 (323) · [B,C] → 1 · [A,C] → 1
//   [A,B]   → 10 · [C] → 15 (includes 323 and 921) · [B] → 90 · [A] → 60
//
// [C] having 15 survivors is the counter-example that forces one-at-a-time
// removal: A and B are each removable on their own, but removing BOTH leaves
// 15 valid answers, which is precisely the bug this change exists to prevent.
//
// Labels are the exact PROPERTIES strings. They carry NO value — the number
// lives in the clue's `value` field, so a label with the value glued on is wrong.

const A: Clue = { propKey: 'sumFT',   label: PROPERTIES.sumFT.label,   operator: '=', value: 6 };
const B: Clue = { propKey: 'diffFT',  label: PROPERTIES.diffFT.label,  operator: '=', value: 0 };
const C: Clue = { propKey: 'prodAll', label: PROPERTIES.prodAll.label, operator: '=', value: 18 };

describe('survivorsFor', () => {
  it('returns all 900 candidates for an empty clue list', () => {
    const all = survivorsFor([]);
    expect(all).toHaveLength(900);
    expect(all[0]).toBe(100);
    expect(all[899]).toBe(999);
  });

  it('narrows to the single answer, and reports the wider sets exactly', () => {
    expect(survivorsFor([A, B, C])).toEqual([323]);

    const cOnly = survivorsFor([C]);
    expect(cOnly).toHaveLength(15);
    expect(cOnly).toContain(323);
    expect(cOnly).toContain(921);
  });
});

describe('trimRedundantClues', () => {
  it('drops a spare clue, and only it', () => {
    expect(trimRedundantClues([A, B, C])).toEqual([B, C]);
  });

  it('leaves the answer unchanged', () => {
    expect(survivorsFor(trimRedundantClues([A, B, C]))).toEqual([323]);
  });

  it('moves nothing when every clue is needed', () => {
    expect(trimRedundantClues([B, C])).toEqual([B, C]);
  });

  it('removes one clue at a time, never a batch', () => {
    // da-brief H1. A batch implementation asks "is this clue redundant?" of the
    // ORIGINAL list, finds A and B are both individually removable, drops both,
    // and returns [C] — 15 valid answers, a broken puzzle. Testing each removal
    // against the clues still REMAINING is what makes this correct, so do not
    // "simplify" this back to a filter over the original list.
    expect(survivorsFor(trimRedundantClues([A, B, C]))).toHaveLength(1);
  });

  it('drops the earliest removable clue first, and the order is pinned', () => {
    // Both results are correct puzzles, and they are DIFFERENT puzzles. Daily
    // puzzles are frozen in KV forever, so the drop order is part of the
    // archive's identity and is pinned deliberately.
    expect(trimRedundantClues([A, B, C])).toEqual([B, C]);
    expect(trimRedundantClues([C, B, A])).toEqual([C, A]);
  });

  it('does not mutate its input', () => {
    const input: Clue[] = [A, B, C];
    trimRedundantClues(input);
    expect(input).toEqual([A, B, C]);
  });
});
