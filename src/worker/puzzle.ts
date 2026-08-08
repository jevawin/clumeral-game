// puzzle.js — shared puzzle logic (browser + Cloudflare Worker)
// Computes digit properties on-the-fly; no CSV required.

const PRIMES      = new Set([2, 3, 5, 7]);
const SQUARES     = new Set([0, 1, 4, 9]);
const CUBES       = new Set([0, 1, 8]);
const TRIANGULARS = new Set([0, 1, 3, 6]);
// Single-digit Fibonacci numbers. 0 and 1 are included, so this overlaps heavily
// with SQUARES/CUBES/TRIANGULARS at the low end — that is fine, the filter engine
// picks clues by how much they narrow the candidate set, not by independence.
export const FIBONACCIS = new Set([0, 1, 2, 3, 5, 8]);

function getDigits(n: number): [number, number, number] {
  return [Math.floor(n / 100), Math.floor((n % 100) / 10), n % 10];
}

// ─── All filterable properties ────────────────────────────────────────────────
// type:'text'    → value is boolean; operators: = !=
// type:'numeric' → value is number;  operators: <= = != >=

interface PropertyDef {
  label: string;
  type: string;
  compute: (n: number) => number | boolean;
}

export const PROPERTIES: Record<string, PropertyDef> = {
  // Specials: 3 digits × 5 traits = 15 boolean properties
  firstIsPrime:       { label: 'The first digit is a prime number',       type: 'text',    compute: (n: number) => PRIMES.has(getDigits(n)[0]) },
  firstIsSquare:      { label: 'The first digit is a square number',      type: 'text',    compute: (n: number) => SQUARES.has(getDigits(n)[0]) },
  firstIsCube:        { label: 'The first digit is a cube number',        type: 'text',    compute: (n: number) => CUBES.has(getDigits(n)[0]) },
  firstIsTriangular:  { label: 'The first digit is a triangular number',  type: 'text',    compute: (n: number) => TRIANGULARS.has(getDigits(n)[0]) },
  firstIsFib:         { label: 'The first digit is a Fibonacci number',   type: 'text',    compute: (n: number) => FIBONACCIS.has(getDigits(n)[0]) },
  secondIsPrime:      { label: 'The second digit is a prime number',      type: 'text',    compute: (n: number) => PRIMES.has(getDigits(n)[1]) },
  secondIsSquare:     { label: 'The second digit is a square number',     type: 'text',    compute: (n: number) => SQUARES.has(getDigits(n)[1]) },
  secondIsCube:       { label: 'The second digit is a cube number',       type: 'text',    compute: (n: number) => CUBES.has(getDigits(n)[1]) },
  secondIsTriangular: { label: 'The second digit is a triangular number', type: 'text',    compute: (n: number) => TRIANGULARS.has(getDigits(n)[1]) },
  secondIsFib:        { label: 'The second digit is a Fibonacci number',  type: 'text',    compute: (n: number) => FIBONACCIS.has(getDigits(n)[1]) },
  thirdIsPrime:       { label: 'The third digit is a prime number',       type: 'text',    compute: (n: number) => PRIMES.has(getDigits(n)[2]) },
  thirdIsSquare:      { label: 'The third digit is a square number',      type: 'text',    compute: (n: number) => SQUARES.has(getDigits(n)[2]) },
  thirdIsCube:        { label: 'The third digit is a cube number',        type: 'text',    compute: (n: number) => CUBES.has(getDigits(n)[2]) },
  thirdIsTriangular:  { label: 'The third digit is a triangular number',  type: 'text',    compute: (n: number) => TRIANGULARS.has(getDigits(n)[2]) },
  thirdIsFib:         { label: 'The third digit is a Fibonacci number',   type: 'text',    compute: (n: number) => FIBONACCIS.has(getDigits(n)[2]) },

  // Sums: 4 numeric properties
  sumFS:   { label: 'The sum of the first and second digits is',  type: 'numeric', compute: (n: number) => { const [a, b]    = getDigits(n); return a + b; } },
  sumFT:   { label: 'The sum of the first and third digits is',   type: 'numeric', compute: (n: number) => { const [a, , c]  = getDigits(n); return a + c; } },
  sumST:   { label: 'The sum of the second and third digits is',  type: 'numeric', compute: (n: number) => { const [, b, c]  = getDigits(n); return b + c; } },
  sumAll:  { label: 'The sum of all three digits is',             type: 'numeric', compute: (n: number) => { const [a, b, c] = getDigits(n); return a + b + c; } },

  // Differences: 3 numeric properties
  diffFS:  { label: 'The difference between the first and second digits is',  type: 'numeric', compute: (n: number) => { const [a, b]    = getDigits(n); return Math.abs(a - b); } },
  diffFT:  { label: 'The difference between the first and third digits is',   type: 'numeric', compute: (n: number) => { const [a, , c]  = getDigits(n); return Math.abs(a - c); } },
  diffST:  { label: 'The difference between the second and third digits is',  type: 'numeric', compute: (n: number) => { const [, b, c]  = getDigits(n); return Math.abs(b - c); } },

  // Products: 4 numeric properties
  prodFS:  { label: 'The product of the first and second digits is',  type: 'numeric', compute: (n: number) => { const [a, b]    = getDigits(n); return a * b; } },
  prodFT:  { label: 'The product of the first and third digits is',   type: 'numeric', compute: (n: number) => { const [a, , c]  = getDigits(n); return a * c; } },
  prodST:  { label: 'The product of the second and third digits is',  type: 'numeric', compute: (n: number) => { const [, b, c]  = getDigits(n); return b * c; } },
  prodAll: { label: 'The product of all three digits is',             type: 'numeric', compute: (n: number) => { const [a, b, c] = getDigits(n); return a * b * c; } },

  // Means: 4 numeric properties
  meanFS:  { label: 'The mean of the first and second digits is',  type: 'numeric', compute: (n: number) => { const [a, b]    = getDigits(n); return (a + b) / 2; } },
  meanFT:  { label: 'The mean of the first and third digits is',   type: 'numeric', compute: (n: number) => { const [a, , c]  = getDigits(n); return (a + c) / 2; } },
  meanST:  { label: 'The mean of the second and third digits is',  type: 'numeric', compute: (n: number) => { const [, b, c]  = getDigits(n); return (b + c) / 2; } },
  meanAll: { label: 'The mean of all three digits is',             type: 'numeric', compute: (n: number) => { const [a, b, c] = getDigits(n); return (a + b + c) / 3; } },

  // Range: 1 numeric property
  range:   { label: 'The range of all three digits is',           type: 'numeric', compute: (n: number) => { const [a, b, c] = getDigits(n); return Math.max(a, b, c) - Math.min(a, b, c); } },
};

// 6 groups — one filter drawn per group per main loop iteration
export const PROPERTY_GROUPS: Record<string, string[]> = {
  Specials:    ['firstIsPrime', 'firstIsSquare', 'firstIsCube', 'firstIsTriangular', 'firstIsFib',
                'secondIsPrime', 'secondIsSquare', 'secondIsCube', 'secondIsTriangular', 'secondIsFib',
                'thirdIsPrime', 'thirdIsSquare', 'thirdIsCube', 'thirdIsTriangular', 'thirdIsFib'],
  Sums:        ['sumFS', 'sumFT', 'sumST', 'sumAll'],
  Differences: ['diffFS', 'diffFT', 'diffST'],
  Products:    ['prodFS', 'prodFT', 'prodST', 'prodAll'],
  Means:       ['meanFS', 'meanFT', 'meanST', 'meanAll'],
  Range:       ['range'],
};

// ─── Filter engine ────────────────────────────────────────────────────────────

export interface Clue {
  propKey: string;
  label: string;
  operator: string;
  value: number | boolean;
}

// Target: each clue keeps 15–40% of current candidates
const KEEP_MIN = 0.15;
const KEEP_MAX = 0.40;

function applyFilter(candidates: number[], propKey: string, operator: string, value: number | boolean): number[] {
  const { compute } = PROPERTIES[propKey];
  return candidates.filter((n: number) => {
    const v = compute(n);
    if (operator === '=')  return v === value;
    if (operator === '!=') return v !== value;
    if (operator === '<')  return v < value;
    if (operator === '>')  return v > value;
    if (operator === '<=') return v <= value;
    if (operator === '>=') return v >= value;
    return true;
  });
}

// Find all operator+value combos for a property that keep 15–40% of candidates
function findGoodClues(candidates: number[], propKey: string) {
  const { type, compute } = PROPERTIES[propKey];
  const uniqueVals = [...new Set(candidates.map((n: number) => compute(n)))].sort((a, b) => Number(a) - Number(b));
  if (uniqueVals.length === 1) return [];

  const ops = type === 'text' ? ['=', '!='] : ['<', '>', '=', '!='];
  const good = [];

  for (const op of ops) {
    for (const val of uniqueVals) {
      const filtered = applyFilter(candidates, propKey, op, val);
      const keepRatio = filtered.length / candidates.length;
      if (keepRatio >= KEEP_MIN && keepRatio <= KEEP_MAX) {
        good.push({ operator: op, value: val, kept: filtered.length });
      }
    }
  }
  return good;
}

// PRIVATE, and deliberately so (#193). This draws clues but does not trim them,
// so a puzzle straight out of here can carry clues nobody needs. Every caller
// goes through generatePuzzleFromRng instead — including the guess checker,
// which re-runs generation from the seed. A caller reaching a different
// generator than the one the player was shown would mark correct guesses wrong.
function drawClues(rng: () => number = Math.random): { answer: number; clues: Clue[] } {
  let candidates: number[] = Array.from({ length: 900 }, (_, i) => i + 100);
  const clues: Clue[] = [];
  const triedGroups = new Set();
  const groupNames = Object.keys(PROPERTY_GROUPS);
  let iterations = 0;

  while (candidates.length > 1 && triedGroups.size < groupNames.length) {
    if (++iterations > 100) break;

    // Pick a random untried group
    const available = groupNames.filter(g => !triedGroups.has(g));
    const group = available[Math.floor(rng() * available.length)];

    // Pick a random property from that group
    const props = PROPERTY_GROUPS[group];
    const propKey = props[Math.floor(rng() * props.length)];
    const { label } = PROPERTIES[propKey];

    // Find all operator+value combos in the sweet spot
    const good = findGoodClues(candidates, propKey);

    // No good combo exists for this property — skip the group
    if (good.length === 0) {
      triedGroups.add(group);
      continue;
    }

    // Pick randomly from the good combos
    const pick = good[Math.floor(rng() * good.length)];
    candidates = applyFilter(candidates, propKey, pick.operator, pick.value);
    clues.push({ propKey, label, operator: pick.operator, value: pick.value });
    triedGroups.add(group);
  }

  // Tiebreaker: sweep all properties with exact match until unique
  if (candidates.length > 1) {
    const usedLabels = new Set(clues.map(c => c.label));
    for (const [propKey, { label, compute }] of Object.entries(PROPERTIES)) {
      if (candidates.length === 1) break;
      if (usedLabels.has(label)) continue;
      const val = compute(candidates[0]);
      const filtered = applyFilter(candidates, propKey, '=', val);
      if (filtered.length > 0 && filtered.length < candidates.length) {
        candidates = filtered;
        clues.push({ propKey, label, operator: '=', value: val });
        usedLabels.add(label);
      }
    }
  }

  return { answer: candidates[0], clues };
}

// ─── Redundant-clue sweep (#193) ──────────────────────────────────────────────

/** Soft bound. Fewer than four clues is a taste judgement, not a defect. */
export const MIN_CLUES = 4;
/** Hard bound. The game screen cannot lay out more than six clue rows. */
export const MAX_CLUES = 6;
/** Draws to try before publishing the best out-of-range puzzle seen. */
export const MAX_ATTEMPTS = 10;

/** Which of the 900 candidates satisfy every clue in the list. Exact, never
 *  sampled — 900 candidates is small enough that approximation buys nothing and
 *  costs certainty. An empty list returns all 900. */
export function survivorsFor(clues: Clue[]): number[] {
  let candidates: number[] = Array.from({ length: 900 }, (_, i) => i + 100);
  for (const { propKey, operator, value } of clues) {
    candidates = applyFilter(candidates, propKey, operator, value);
  }
  return candidates;
}

/** Drop every clue the puzzle does not need, one at a time, earliest first.
 *
 *  ONE AT A TIME IS THE WHOLE POINT. Each candidate removal is tested against
 *  the clues still REMAINING, not against the original list. Ask the original
 *  list instead and you find several clues that are each individually
 *  removable, drop them all, and publish a puzzle with several valid answers —
 *  the exact failure this change exists to prevent (see the fixture in
 *  tests/puzzle-redundancy.spec.ts, where the naive version leaves 15 answers).
 *
 *  Removal is by object IDENTITY, not by index: `kept` shrinks as clues go, so
 *  an index into `clues` stops pointing at the same clue the moment one is
 *  dropped. Getting that wrong drops the wrong clue and still passes any test
 *  that only checks the final length.
 *
 *  One pass is enough. Removing a clue can only widen the surviving set, so a
 *  clue that was not removable cannot become removable later.
 *
 *  The input array is never mutated — every step builds a new array. */
export function trimRedundantClues(clues: Clue[]): Clue[] {
  let kept = [...clues];
  for (const clue of clues) {
    const trial = kept.filter(x => x !== clue);
    if (survivorsFor(trial).length === 1) kept = trial;
  }
  return kept;
}

/** Is `candidate` a better fallback than `incumbent`? Both are out of range.
 *
 *  Preference order, so the result is deterministic:
 *    1. Anything beats no incumbent.
 *    2. Under range always beats over range. Above MAX_CLUES the screen cannot
 *       lay the puzzle out; below MIN_CLUES it merely looks thin.
 *    3. Among under-range candidates, more clues wins.
 *    4. Among over-range candidates, fewer clues wins.
 *    5. On a tie, the first one seen is kept. */
export function betterFallback(
  candidate: { clues: Clue[] },
  incumbent: { clues: Clue[] } | null,
): boolean {
  if (incumbent === null) return true;

  const candidateIsUnder = candidate.clues.length < MIN_CLUES;
  const incumbentIsUnder = incumbent.clues.length < MIN_CLUES;
  if (candidateIsUnder !== incumbentIsUnder) return candidateIsUnder;

  return candidateIsUnder
    ? candidate.clues.length > incumbent.clues.length
    : candidate.clues.length < incumbent.clues.length;
}

/** The generator every caller uses. Draws, trims, and retries until the puzzle
 *  lands in the 4–6 clue range with exactly one valid answer.
 *
 *  Deterministic: `rng` is threaded through every attempt and holds its
 *  position, so the same seed replays the same draws, the same rejections and
 *  the same result. That is what makes the guess checker agree with the puzzle
 *  the player was shown.
 *
 *  `draw` is injectable purely so the fallback branch can be tested — whatever
 *  it returns is still trimmed, range-checked and uniqueness-checked, so it is
 *  not a route to an untrimmed puzzle. */
export function generatePuzzleFromRng(
  rng: () => number = Math.random,
  draw: (rng: () => number) => { answer: number; clues: Clue[] } = drawClues,
): { answer: number; clues: Clue[] } {
  let fallback: { answer: number; clues: Clue[] } | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const trimmed = trimRedundantClues(draw(rng).clues);
    const survivors = survivorsFor(trimmed);

    // The tiebreaker sweep in drawClues has no post-condition, so a draw can
    // come back with more than one valid answer. Never publish one.
    if (survivors.length !== 1) continue;

    const puzzle = { answer: survivors[0], clues: trimmed };
    if (trimmed.length >= MIN_CLUES && trimmed.length <= MAX_CLUES) return puzzle;
    if (betterFallback(puzzle, fallback)) fallback = puzzle;
  }

  // Every attempt produced several valid answers. Unreachable in 3,000 measured
  // seeds, and it should be reached LOUDLY if it ever is: a random puzzle just
  // fails one request, but a daily is seeded from its date, so this would be a
  // visible outage on that date. That beats silently telling correct players
  // they are wrong, which is the failure this whole module exists to prevent.
  if (fallback === null) {
    throw new Error(`clumeral: generator produced no uniquely-solvable puzzle in ${MAX_ATTEMPTS} attempts`);
  }

  console.warn(`clumeral: generator hit the ${MAX_ATTEMPTS}-attempt cap, publishing a ${fallback.clues.length}-clue puzzle`);
  return fallback;
}

// ─── RNG + date helpers ───────────────────────────────────────────────────────

export function makeRng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Named after the puzzle's source of truth (UTC). Workers already run in UTC
// so getFullYear/getUTCFullYear would return the same value here, but using
// the UTC methods makes the asymmetry with the browser explicit and matches
// the renamed client-side helper.
export function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// The calendar day after dateStr, in UTC. Used by the cron to pre-generate
// tomorrow (#257) — date arithmetic via Date so month/year/leap rollover is
// handled by the platform rather than by string surgery.
export function nextUTCDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function dateSeedInt(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ''), 10);
}

const EPOCH_DATE = '2026-03-08';

export function puzzleNumber(dateStr: string): number {
  const ms = new Date(dateStr + 'T00:00:00Z').getTime() - new Date(EPOCH_DATE + 'T00:00:00Z').getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

export function puzzleDate(num: number): string {
  const epoch = new Date(EPOCH_DATE + 'T00:00:00Z');
  const d = new Date(epoch.getTime() + (num - 1) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
