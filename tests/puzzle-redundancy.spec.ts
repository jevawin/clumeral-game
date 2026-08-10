import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MAX_ATTEMPTS,
  MAX_CLUES,
  MIN_CLUES,
  PROPERTIES,
  betterFallback,
  generatePuzzleFromRng,
  makeRng,
  survivorsFor,
  trimRedundantClues,
  type Clue,
} from '../src/worker/puzzle.ts';
import worker from '../src/worker/index.ts';

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

// FIXTURE TWO — irredundant, 3 clues, BELOW the accepted range. Answer 899,
// the trimmed output of seed 1. Dropping each clue in turn leaves 10, 60 and 2
// survivors, so nothing is removable and the sweep returns it unchanged.
// Verified against all 900 candidates on 2026-08-08.
const FIXTURE_TWO: Clue[] = [
  { propKey: 'diffST',        label: PROPERTIES.diffST.label,        operator: '=', value: 0 },
  { propKey: 'sumFS',         label: PROPERTIES.sumFS.label,         operator: '=', value: 17 },
  { propKey: 'firstIsSquare', label: PROPERTIES.firstIsSquare.label, operator: '=', value: false },
];

// FIXTURE THREE — irredundant, 4 clues, INSIDE the accepted range. Answer 323,
// the trimmed output of seed 2. Dropping each clue in turn leaves 4, 2, 5 and 2
// survivors. Verified against all 900 candidates on 2026-08-08.
const FIXTURE_THREE: Clue[] = [
  { propKey: 'diffST',        label: PROPERTIES.diffST.label,        operator: '=', value: 1 },
  { propKey: 'sumFT',         label: PROPERTIES.sumFT.label,         operator: '=', value: 6 },
  { propKey: 'prodFT',        label: PROPERTIES.prodFT.label,        operator: '=', value: 9 },
  { propKey: 'secondIsPrime', label: PROPERTIES.secondIsPrime.label, operator: '=', value: true },
];

/** A stub draw that always hands back the same clue list, and counts its calls. */
const stubDraw = (clues: Clue[]) => {
  const draw = vi.fn(() => ({ answer: survivorsFor(clues)[0], clues: [...clues] }));
  return draw;
};

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

// ─── The generator every caller uses ──────────────────────────────────────────

describe('generatePuzzleFromRng across seeds', () => {
  // One pass over 300 seeds, generating each puzzle once, asserting all three
  // properties. Measured at about 2.4 seconds here; vitest.config.ts sets no
  // testTimeout, so the 5-second default is too close for a slower machine.
  it('produces puzzles that are in range, unique, and carry no spare clue', { timeout: 30_000 }, () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { answer, clues } = generatePuzzleFromRng(makeRng(seed));

      expect(clues.length, `seed ${seed} clue count`).toBeGreaterThanOrEqual(MIN_CLUES);
      expect(clues.length, `seed ${seed} clue count`).toBeLessThanOrEqual(MAX_CLUES);

      const survivors = survivorsFor(clues);
      expect(survivors, `seed ${seed} survivors`).toEqual([answer]);

      expect(trimRedundantClues(clues), `seed ${seed} still has a spare clue`).toEqual(clues);
    }
  });

  it('gives the same puzzle for the same seed, every time', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const first = generatePuzzleFromRng(makeRng(seed));
      const second = generatePuzzleFromRng(makeRng(seed));
      expect(second, `seed ${seed}`).toEqual(first);
    }
  });
});

// ─── The two answer paths agree, driven through the real routes ───────────────
//
// A random puzzle's answer is never stored. The player is shown clues from
// `GET /api/puzzle/random`, and `POST /api/guess` re-derives the answer by
// re-running the generator from the seed inside the signed token. If those two
// routes ever reach DIFFERENT generators, every correct guess on a random
// puzzle comes back wrong.
//
// This drives the actual worker handlers rather than calling the generator
// twice from the test. Calling it twice only proves the generator is
// deterministic, which the test above already proves — it says nothing about
// how the two routes are WIRED, which is the thing that can rot. Point
// handleGetRandomPuzzle at a new generator and leave handleGuess alone, and
// this test fails while a generator-level test stays green.
//
// The env is the two routes' whole dependency: no KV, no database, no
// analytics. HMAC_SECRET only has to be consistent between the two calls.

describe('a correct guess on a random puzzle is accepted (#193)', () => {
  const env = { HMAC_SECRET: 'test-secret-for-token-signing' } as never;
  const ctx = {} as never;

  const randomPuzzle = async () => {
    const res = await worker.fetch(new Request('https://clumeral.com/api/puzzle/random'), env, ctx);
    expect(res.status).toBe(200);
    return (await res.json()) as { clues: Clue[]; token: string };
  };

  const submit = async (guess: number, token: string) => {
    const res = await worker.fetch(
      new Request('https://clumeral.com/api/guess', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ guess, token }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    return (await res.json()) as { correct: boolean };
  };

  it('accepts the number the clues actually describe, 25 times over', { timeout: 30_000 }, async () => {
    for (let run = 1; run <= 25; run++) {
      const { clues, token } = await randomPuzzle();

      // The clues are all the player gets, so solve them the way a player would
      // have to: find the numbers that satisfy every clue. Exactly one should.
      const solutions = survivorsFor(clues);
      expect(solutions, `run ${run} had ${solutions.length} valid answers`).toHaveLength(1);

      expect((await submit(solutions[0], token)).correct, `run ${run}`).toBe(true);
    }
  });

  it('still rejects a wrong guess', async () => {
    // Without this, an endpoint that always said "correct" would pass the test
    // above and the real check would be worthless.
    const { clues, token } = await randomPuzzle();
    const answer = survivorsFor(clues)[0];
    const wrong = answer === 999 ? 998 : answer + 1;

    expect((await submit(wrong, token)).correct).toBe(false);
  });

  it('serves a puzzle that obeys the generator contract', async () => {
    const { clues } = await randomPuzzle();

    expect(clues.length).toBeGreaterThanOrEqual(MIN_CLUES);
    expect(clues.length).toBeLessThanOrEqual(MAX_CLUES);
    expect(trimRedundantClues(clues)).toEqual(clues);
  });
});

describe('nothing reaches the untrimmed generator', () => {
  // Comments are stripped before matching. This codebase documents heavily, and
  // a guard that fails because someone WROTE DOWN the rule it enforces is worse
  // than no guard. Lifted from daily-puzzle.spec.ts, which makes the same
  // argument about KV writes.
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  const workerDir = resolve(__dirname, '../src/worker');
  const sources = readdirSync(workerDir)
    .filter(f => f.endsWith('.ts'))
    .map(f => ({ file: f, src: stripComments(readFileSync(resolve(workerDir, f), 'utf8')) }));

  it('no worker module outside puzzle.ts names the raw draw', () => {
    // Repo-wide, not just the files this change edited: a call added in any
    // other worker module would publish untrimmed puzzles just as effectively,
    // and scoping the guard to the file we happened to be editing is how the
    // next one slips through.
    const leaked = sources
      .filter(s => s.file !== 'puzzle.ts' && /\bdrawClues\b/.test(s.src))
      .map(s => s.file);
    expect(leaked).toEqual([]);
  });
});

// ─── The fallback branch ──────────────────────────────────────────────────────
//
// Driven by a stub draw. No real seed reaches any of this — 3,000 seeds
// measured on 2026-08-08 all landed in range within 10 attempts, worst case 7.

describe('generatePuzzleFromRng fallback', () => {
  it('publishes the best out-of-range puzzle after the attempt cap, and warns', () => {
    const draw = stubDraw(FIXTURE_TWO);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { answer, clues } = generatePuzzleFromRng(makeRng(1), draw);

    expect(answer).toBe(899);
    expect(clues).toEqual(FIXTURE_TWO);
    expect(draw).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('ranks fallback candidates so the result is deterministic', () => {
    // Tested directly on plain objects. Building an irredundant 7-clue puzzle
    // by hand is not worth it — they are about 0.1% of the population.
    const of = (n: number) => ({ clues: Array(n).fill(A) as Clue[] });

    expect(betterFallback(of(3), null)).toBe(true);      // anything beats nothing
    expect(betterFallback(of(3), of(2))).toBe(true);     // under range: more clues wins
    expect(betterFallback(of(2), of(3))).toBe(false);
    expect(betterFallback(of(3), of(7))).toBe(true);     // under range beats over range
    expect(betterFallback(of(7), of(3))).toBe(false);
    expect(betterFallback(of(7), of(8))).toBe(true);     // over range: fewer clues wins
    expect(betterFallback(of(8), of(7))).toBe(false);
    expect(betterFallback(of(5), of(5))).toBe(false);    // a tie keeps the first one seen
  });

  it('never publishes a puzzle with more than one valid answer', () => {
    // Fixture ONE's [A,B] pair has 10 survivors and no removable clue, so no
    // attempt can rescue it. Throwing is loud and fixable; publishing would
    // silently tell correct players they are wrong.
    const draw = stubDraw([A, B]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => generatePuzzleFromRng(makeRng(1), draw)).toThrow();
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('stops at the first in-range draw rather than using all its attempts', () => {
    const draw = stubDraw(FIXTURE_THREE);

    const { answer, clues } = generatePuzzleFromRng(makeRng(1), draw);

    expect(answer).toBe(323);
    expect(clues).toEqual(FIXTURE_THREE);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('trims whatever the draw hands it, fallback included', () => {
    // The injectable draw is a test seam, not a back door: a redundant clue set
    // fed straight in still comes back trimmed.
    const draw = stubDraw([A, B, C]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { answer, clues } = generatePuzzleFromRng(makeRng(1), draw);

    expect(clues).toEqual([B, C]);
    expect(answer).toBe(323);
    // Two clues is under range, so this came back via the fallback and must
    // have warned. Without this the spy would just be silencing the output.
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });
});
