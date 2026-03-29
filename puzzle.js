// puzzle.js — shared puzzle logic (browser + Cloudflare Worker)
// Computes digit properties on-the-fly; no CSV required.

const PRIMES      = new Set([2, 3, 5, 7]);
const SQUARES     = new Set([0, 1, 4, 9]);
const CUBES       = new Set([0, 1, 8]);
const TRIANGULARS = new Set([0, 1, 3, 6]);

function getDigits(n) {
  return [Math.floor(n / 100), Math.floor((n % 100) / 10), n % 10];
}

// ─── All filterable properties ────────────────────────────────────────────────
// type:'text'    → value is boolean; operators: = !=
// type:'numeric' → value is number;  operators: <= = != >=

const PROPERTIES = {
  // Specials: 3 digits × 4 traits = 12 boolean properties
  firstIsPrime:       { label: 'The first digit is a prime number',       type: 'text',    compute: n => PRIMES.has(getDigits(n)[0]) },
  firstIsSquare:      { label: 'The first digit is a square number',      type: 'text',    compute: n => SQUARES.has(getDigits(n)[0]) },
  firstIsCube:        { label: 'The first digit is a cube number',        type: 'text',    compute: n => CUBES.has(getDigits(n)[0]) },
  firstIsTriangular:  { label: 'The first digit is a triangular number',  type: 'text',    compute: n => TRIANGULARS.has(getDigits(n)[0]) },
  secondIsPrime:      { label: 'The second digit is a prime number',      type: 'text',    compute: n => PRIMES.has(getDigits(n)[1]) },
  secondIsSquare:     { label: 'The second digit is a square number',     type: 'text',    compute: n => SQUARES.has(getDigits(n)[1]) },
  secondIsCube:       { label: 'The second digit is a cube number',       type: 'text',    compute: n => CUBES.has(getDigits(n)[1]) },
  secondIsTriangular: { label: 'The second digit is a triangular number', type: 'text',    compute: n => TRIANGULARS.has(getDigits(n)[1]) },
  thirdIsPrime:       { label: 'The third digit is a prime number',       type: 'text',    compute: n => PRIMES.has(getDigits(n)[2]) },
  thirdIsSquare:      { label: 'The third digit is a square number',      type: 'text',    compute: n => SQUARES.has(getDigits(n)[2]) },
  thirdIsCube:        { label: 'The third digit is a cube number',        type: 'text',    compute: n => CUBES.has(getDigits(n)[2]) },
  thirdIsTriangular:  { label: 'The third digit is a triangular number',  type: 'text',    compute: n => TRIANGULARS.has(getDigits(n)[2]) },

  // Sums: 4 numeric properties
  sumFS:   { label: 'The sum of the first and second digits is',  type: 'numeric', compute: n => { const [a, b]    = getDigits(n); return a + b; } },
  sumFT:   { label: 'The sum of the first and third digits is',   type: 'numeric', compute: n => { const [a, , c]  = getDigits(n); return a + c; } },
  sumST:   { label: 'The sum of the second and third digits is',  type: 'numeric', compute: n => { const [, b, c]  = getDigits(n); return b + c; } },
  sumAll:  { label: 'The sum of all three digits is',             type: 'numeric', compute: n => { const [a, b, c] = getDigits(n); return a + b + c; } },

  // Differences: 3 numeric properties
  diffFS:  { label: 'The difference between the first and second digits is',  type: 'numeric', compute: n => { const [a, b]    = getDigits(n); return Math.abs(a - b); } },
  diffFT:  { label: 'The difference between the first and third digits is',   type: 'numeric', compute: n => { const [a, , c]  = getDigits(n); return Math.abs(a - c); } },
  diffST:  { label: 'The difference between the second and third digits is',  type: 'numeric', compute: n => { const [, b, c]  = getDigits(n); return Math.abs(b - c); } },

  // Products: 4 numeric properties
  prodFS:  { label: 'The product of the first and second digits is',  type: 'numeric', compute: n => { const [a, b]    = getDigits(n); return a * b; } },
  prodFT:  { label: 'The product of the first and third digits is',   type: 'numeric', compute: n => { const [a, , c]  = getDigits(n); return a * c; } },
  prodST:  { label: 'The product of the second and third digits is',  type: 'numeric', compute: n => { const [, b, c]  = getDigits(n); return b * c; } },
  prodAll: { label: 'The product of all three digits is',             type: 'numeric', compute: n => { const [a, b, c] = getDigits(n); return a * b * c; } },

  // Means: 4 numeric properties
  meanFS:  { label: 'The mean of the first and second digits is',  type: 'numeric', compute: n => { const [a, b]    = getDigits(n); return (a + b) / 2; } },
  meanFT:  { label: 'The mean of the first and third digits is',   type: 'numeric', compute: n => { const [a, , c]  = getDigits(n); return (a + c) / 2; } },
  meanST:  { label: 'The mean of the second and third digits is',  type: 'numeric', compute: n => { const [, b, c]  = getDigits(n); return (b + c) / 2; } },
  meanAll: { label: 'The mean of all three digits is',             type: 'numeric', compute: n => { const [a, b, c] = getDigits(n); return (a + b + c) / 3; } },

  // Range: 1 numeric property
  range:   { label: 'The range of all three digits is',           type: 'numeric', compute: n => { const [a, b, c] = getDigits(n); return Math.max(a, b, c) - Math.min(a, b, c); } },
};

// 6 groups — one filter drawn per group per main loop iteration
const PROPERTY_GROUPS = {
  Specials:    ['firstIsPrime', 'firstIsSquare', 'firstIsCube', 'firstIsTriangular',
                'secondIsPrime', 'secondIsSquare', 'secondIsCube', 'secondIsTriangular',
                'thirdIsPrime', 'thirdIsSquare', 'thirdIsCube', 'thirdIsTriangular'],
  Sums:        ['sumFS', 'sumFT', 'sumST', 'sumAll'],
  Differences: ['diffFS', 'diffFT', 'diffST'],
  Products:    ['prodFS', 'prodFT', 'prodST', 'prodAll'],
  Means:       ['meanFS', 'meanFT', 'meanST', 'meanAll'],
  Range:       ['range'],
};

// ─── Filter engine ────────────────────────────────────────────────────────────

function applyFilter(candidates, propKey, operator, value) {
  const { compute } = PROPERTIES[propKey];
  return candidates.filter(n => {
    const v = compute(n);
    if (operator === '=')  return v === value;
    if (operator === '!=') return v !== value;
    if (operator === '<=') return v <= value;
    if (operator === '>=') return v >= value;
    return true;
  });
}

export function runFilterLoop(rng = Math.random) {
  let candidates = Array.from({ length: 900 }, (_, i) => i + 100);
  const clues = [];
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
    const { label, type, compute } = PROPERTIES[propKey];

    // Compute all candidate values for this property
    const allVals = candidates.map(n => compute(n));

    // Skip if all candidates share the same value (uninformative)
    if (new Set(allVals).size === 1) {
      triedGroups.add(group);
      continue;
    }

    // Pick a random value from among the candidates
    const val = allVals[Math.floor(rng() * allVals.length)];

    // Pick operator appropriate to property type
    const ops = type === 'text' ? ['=', '!='] : ['<=', '=', '!=', '>='];
    const operator = ops[Math.floor(rng() * ops.length)];

    // Skip if filter would eliminate all candidates
    const filtered = applyFilter(candidates, propKey, operator, val);
    if (filtered.length === 0) continue;

    // Apply filter and record clue
    candidates = filtered;
    clues.push({ propKey, label, operator, value: val });
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

  // Prune redundant clues — walk backward so tiebreakers are dropped first
  const answer = candidates[0];
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = [...clues.slice(0, i), ...clues.slice(i + 1)];
    let remaining = Array.from({ length: 900 }, (_, j) => j + 100);
    for (const c of without) {
      remaining = applyFilter(remaining, c.propKey, c.operator, c.value);
    }
    if (remaining.length === 1 && remaining[0] === answer) {
      clues.splice(i, 1);
    }
  }

  return { answer, clues };
}

// ─── RNG + date helpers ───────────────────────────────────────────────────────

export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateSeedInt(dateStr) {
  return parseInt(dateStr.replace(/-/g, ''), 10);
}

const EPOCH_DATE = '2026-03-08';

export function puzzleNumber(dateStr) {
  const ms = new Date(dateStr + 'T00:00:00') - new Date(EPOCH_DATE + 'T00:00:00');
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}
