import { describe, it, expect } from 'vitest';
import { FIBONACCIS, PROPERTIES, PROPERTY_GROUPS, runFilterLoop, makeRng } from '../src/worker/puzzle.ts';

// ─── Fibonacci special (#81) ──────────────────────────────────────────────────
//
// Fibonacci joins prime/square/cube/triangular as the fifth "special" trait, so
// Specials goes 12 → 15 properties. The three new keys follow the existing
// first/second/third naming, which matters beyond puzzle.ts: app.ts derives both
// the FIB clue tag (getClueTag matches "IsFib") and the lit mini-digit positions
// (digitPositions matches the "first"/"second"/"third" prefix) from the key
// string. Tests below pin the key names for that reason.

describe('FIBONACCIS set', () => {
  it('contains exactly the single-digit Fibonacci numbers', () => {
    expect([...FIBONACCIS].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5, 8]);
  });

  it('excludes the single digits that are not Fibonacci', () => {
    for (const n of [4, 6, 7, 9]) {
      expect(FIBONACCIS.has(n)).toBe(false);
    }
  });
});

describe('Fibonacci properties', () => {
  it('registers all three positional keys', () => {
    for (const key of ['firstIsFib', 'secondIsFib', 'thirdIsFib']) {
      expect(PROPERTIES[key]).toBeDefined();
      expect(PROPERTIES[key].type).toBe('text');
    }
  });

  it('labels read "The [position] digit is a Fibonacci number"', () => {
    // Source labels keep "digit" — app.ts rewrites it to "box" at render time
    // (#228), so changing the wording here would break that transform's input.
    expect(PROPERTIES.firstIsFib.label).toBe('The first digit is a Fibonacci number');
    expect(PROPERTIES.secondIsFib.label).toBe('The second digit is a Fibonacci number');
    expect(PROPERTIES.thirdIsFib.label).toBe('The third digit is a Fibonacci number');
  });

  it('computes per position independently', () => {
    // 583 → first 5 (fib), second 8 (fib), third 3 (fib)
    expect(PROPERTIES.firstIsFib.compute(583)).toBe(true);
    expect(PROPERTIES.secondIsFib.compute(583)).toBe(true);
    expect(PROPERTIES.thirdIsFib.compute(583)).toBe(true);

    // 479 → first 4, second 7, third 9 — none are Fibonacci
    expect(PROPERTIES.firstIsFib.compute(479)).toBe(false);
    expect(PROPERTIES.secondIsFib.compute(479)).toBe(false);
    expect(PROPERTIES.thirdIsFib.compute(479)).toBe(false);

    // 246 → first 2 (fib), second 4, third 6 — only the first matches
    expect(PROPERTIES.firstIsFib.compute(246)).toBe(true);
    expect(PROPERTIES.secondIsFib.compute(246)).toBe(false);
    expect(PROPERTIES.thirdIsFib.compute(246)).toBe(false);
  });

  it('matches 0 in the second and third positions only', () => {
    // Puzzle answers are 100–999, so the first digit is always 1–9 and the 0 in
    // FIBONACCIS can never be reached there. Second and third can both be 0.
    expect(PROPERTIES.secondIsFib.compute(105)).toBe(true);
    expect(PROPERTIES.thirdIsFib.compute(150)).toBe(true);
  });

  it('agrees with the set for every digit in every position', () => {
    for (let n = 100; n <= 999; n++) {
      const [a, b, c] = [Math.floor(n / 100), Math.floor((n % 100) / 10), n % 10];
      expect(PROPERTIES.firstIsFib.compute(n)).toBe(FIBONACCIS.has(a));
      expect(PROPERTIES.secondIsFib.compute(n)).toBe(FIBONACCIS.has(b));
      expect(PROPERTIES.thirdIsFib.compute(n)).toBe(FIBONACCIS.has(c));
    }
  });
});

describe('Specials group', () => {
  it('holds 15 properties — 3 positions × 5 traits', () => {
    expect(PROPERTY_GROUPS.Specials).toHaveLength(15);
  });

  it('lists every Specials key as a real property', () => {
    for (const key of PROPERTY_GROUPS.Specials) {
      expect(PROPERTIES[key]).toBeDefined();
    }
  });

  it('groups the three Fibonacci keys under Specials', () => {
    expect(PROPERTY_GROUPS.Specials).toEqual(
      expect.arrayContaining(['firstIsFib', 'secondIsFib', 'thirdIsFib']),
    );
  });
});

describe('filter loop with the extra properties', () => {
  it('still produces a solvable puzzle across many seeds', () => {
    // The algorithm should absorb 3 more Specials without manual balancing, so
    // run a spread of seeds and assert every one yields a single answer whose
    // clues all actually hold for it.
    for (let seed = 1; seed <= 60; seed++) {
      const result = runFilterLoop(makeRng(seed));
      expect(result, `seed ${seed} produced no puzzle`).toBeTruthy();

      const { answer, clues } = result as { answer: number; clues: Array<{ propKey: string; operator: string; value: number | boolean }> };
      expect(answer).toBeGreaterThanOrEqual(100);
      expect(answer).toBeLessThanOrEqual(999);
      expect(clues.length).toBeGreaterThan(0);

      for (const { propKey, operator, value } of clues) {
        const actual = PROPERTIES[propKey].compute(answer);
        if (operator === '=')  expect(actual, `${propKey} = ${value}`).toBe(value);
        if (operator === '!=') expect(actual, `${propKey} != ${value}`).not.toBe(value);
      }
    }
  });

  it('can draw a Fibonacci clue at least once across those seeds', () => {
    // Guards against the new properties being registered but never reachable —
    // e.g. dropped from PROPERTY_GROUPS, which is what the loop actually reads.
    let sawFib = false;
    for (let seed = 1; seed <= 200 && !sawFib; seed++) {
      const result = runFilterLoop(makeRng(seed)) as { clues: Array<{ propKey: string }> } | null;
      if (result?.clues.some((c) => c.propKey.includes('IsFib'))) sawFib = true;
    }
    expect(sawFib).toBe(true);
  });
});
