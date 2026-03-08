// David Lark's Lame Number Game — app.js
// Phase 1: CSV data loader
// Phase 2 will add: runFilterLoop()
// Phase 3 will add: UI event handlers

// Module-scoped data store — Phase 2 reads these directly (same file)
let gameRows = [];    // array of row objects; keys are trimmed header strings; numeric values are JS numbers
let gameHeaders = []; // trimmed header strings in CSV column order (23 total)

async function loadData() {
  document.getElementById('status').textContent = 'Loading...';

  let text;
  try {
    const response = await fetch('data.csv');
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    text = await response.text();
  } catch (err) {
    document.getElementById('status').textContent =
      'Error: could not load data.csv';
    console.error('Fetch failed:', err);
    return;
  }

  const results = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    transformHeader: h => h.trim(),
    skipEmptyLines: true,
  });

  if (results.errors.length > 0) {
    console.warn('PapaParse encountered warnings:', results.errors);
  }

  gameRows = results.data;
  gameHeaders = results.meta.fields; // already trimmed by transformHeader

  console.log(
    `data.csv loaded: ${gameRows.length} rows, ${gameHeaders.length} headers`,
    gameHeaders
  );

  document.getElementById('status').textContent = 'Ready — data loaded successfully.';
  document.getElementById('guess').removeAttribute('disabled');
  document.getElementById('submit').removeAttribute('disabled');
  document.getElementById('new-puzzle').removeAttribute('disabled');
  startPuzzle();
}

document.addEventListener('DOMContentLoaded', loadData);

// ─── Phase 2: Filtering Engine ───────────────────────────────────────────────

// Phase 2: Filtering Engine
// RANGE_GROUPS uses column indices (0-indexed) not header strings.
// Resolve to actual row object keys via: gameHeaders[colIndex]
// This avoids the PapaParse duplicate-header key ambiguity for cols 1-3 vs 4-6.
// Source: direct data.csv inspection — see .planning/phases/02-filtering-engine/02-RESEARCH.md
const RANGE_GROUPS = {
  SpecialNumbers:     [4, 5, 6],        // text columns: "a prime number", etc.
  Sums:               [7, 8, 9, 10],    // numeric
  AbsoluteDifference: [11, 12, 13],     // numeric
  Products:           [14, 15, 16, 17], // numeric
  Means:              [18, 19, 20, 21], // numeric
  Range:              [22],             // numeric
};

const ITERATION_CAP = 100;

function applyFilter(candidates, colHeader, operator, value) {
  return candidates.filter(row => {
    const v = row[colHeader];
    if (operator === '=')  return v === value;
    if (operator === '!=') return v !== value;
    if (operator === '<=') return v <= value;
    if (operator === '>=') return v >= value;
    return true;
  });
}

function runFilterLoop(rows) {
  let candidates = [...rows];            // FILT-02: start with all data rows; never mutate gameRows
  const clues = [];                      // FILT-09: accumulated clues
  const triedRanges = new Set();
  const rangeNames = Object.keys(RANGE_GROUPS);
  let iterations = 0;

  // FILT-07 + FILT-08: terminate on 1 candidate, all ranges tried, or iteration cap
  while (candidates.length > 1 && triedRanges.size < rangeNames.length) {
    if (++iterations > ITERATION_CAP) break;

    // FILT-03a: pick a random untried range
    const untriedRanges = rangeNames.filter(n => !triedRanges.has(n));
    const rangeName = untriedRanges[Math.floor(Math.random() * untriedRanges.length)];
    const colIndices = RANGE_GROUPS[rangeName];

    // FILT-03b: pick a random column within the range
    const colIndex = colIndices[Math.floor(Math.random() * colIndices.length)];
    const colHeader = gameHeaders[colIndex]; // index-based — resolves whatever PapaParse key is used

    // FILT-06: skip if column is uniform (all candidates have identical values)
    const values = candidates.map(r => r[colHeader]);
    if (new Set(values).size === 1) {
      triedRanges.add(rangeName); // range is informationally exhausted
      continue;
    }

    // FILT-03c: pick a random value from current candidates in this column
    const value = values[Math.floor(Math.random() * values.length)];

    // FILT-04: pick operator appropriate to column type
    const isText = typeof value === 'string';
    const ops = isText ? ['=', '!='] : ['<=', '=', '!=', '>='];
    const operator = ops[Math.floor(Math.random() * ops.length)];

    // FILT-05: skip if filter would eliminate all candidates; do NOT mark range tried
    const filtered = applyFilter(candidates, colHeader, operator, value);
    if (filtered.length === 0) continue;

    // Valid filter — apply and record clue (FILT-09)
    candidates = filtered;
    clues.push({ label: colHeader, operator, value });
    triedRanges.add(rangeName);
  }

  // Tiebreaker: main loop exhausted range groups but candidates not unique.
  // Sweep remaining columns with '=' (exact match on candidates[0]) until unique.
  if (candidates.length > 1) {
    const usedLabels = new Set(clues.map(c => c.label));
    for (let idx = 4; idx < gameHeaders.length && candidates.length > 1; idx++) {
      const hdr = gameHeaders[idx];
      if (usedLabels.has(hdr)) continue;
      const targetValue = candidates[0][hdr];
      const filtered = applyFilter(candidates, hdr, '=', targetValue);
      if (filtered.length > 0 && filtered.length < candidates.length) {
        candidates = filtered;
        clues.push({ label: hdr, operator: '=', value: targetValue });
        usedLabels.add(hdr);
      }
    }
  }

  // Guard: if no clue was recorded (all ranges were uniform or the loop didn't fire),
  // force one clue using the first column with any variance. (RESEARCH.md Pitfall 5)
  if (clues.length === 0) {
    const allFilterable = [...Array(19).keys()].map(i => i + 4); // indices 4-22
    for (const idx of allFilterable) {
      const hdr = gameHeaders[idx];
      const vals = candidates.map(r => r[hdr]);
      if (new Set(vals).size > 1) {
        const forcedValue = candidates[0][hdr];
        const isText = typeof forcedValue === 'string';
        const forcedOp = isText ? '=' : '=';
        clues.push({ label: hdr, operator: forcedOp, value: forcedValue });
        break;
      }
    }
  }

  // FILT-10: answer is the Number field of the surviving row
  return { answer: candidates[0]['Number'], clues };
}

// ─── Phase 3: Game Loop ───────────────────────────────────────────────────────

const OPERATOR_SYMBOLS = {
  '<=': '≤',
  '>=': '≥',
  '=':  '=',
  '!=': '≠',
};

let gameState = {
  answer: null,
  guesses: [],
  solved: false,
};

function renderClues(clues) {
  const ul = document.getElementById('clues');
  ul.innerHTML = '';
  for (const { label, operator, value } of clues) {
    const li = document.createElement('li');
    li.className = 'clue-row';
    const displayLabel = label.replace(/_\d+$/, '');
    if (typeof value === 'string') {
      li.appendChild(document.createTextNode(displayLabel + ' '));
      const strong = document.createElement('strong');
      strong.textContent = value;
      li.appendChild(strong);
    } else {
      li.appendChild(document.createTextNode(displayLabel + ' '));
      const opSpan = document.createElement('span');
      opSpan.className = 'clue-op';
      opSpan.textContent = OPERATOR_SYMBOLS[operator] ?? operator;
      li.appendChild(opSpan);
      li.appendChild(document.createTextNode(' '));
      const strong = document.createElement('strong');
      strong.textContent = value;
      li.appendChild(strong);
    }
    ul.appendChild(li);
  }
}

function renderFeedback(type, answer) {
  const el = document.getElementById('feedback');
  if (!el) return;
  if (type === 'correct') {
    el.textContent = `Correct! The answer was ${answer}.`;
    el.className = 'feedback feedback--correct';
  } else if (type === 'incorrect') {
    el.textContent = 'Incorrect — try again.';
    el.className = 'feedback feedback--incorrect';
  } else {
    el.textContent = '';
    el.className = 'feedback';
  }
}

function renderHistory(guesses) {
  const label = document.getElementById('history-label');
  const ul = document.getElementById('history');
  ul.innerHTML = '';
  if (guesses.length === 0) {
    if (label) label.style.display = 'none';
    return;
  }
  if (label) label.style.display = '';
  for (const g of guesses) {
    const li = document.createElement('li');
    li.textContent = g;
    li.className = 'history-item';
    ul.appendChild(li);
  }
}

function startPuzzle() {
  const { answer, clues } = runFilterLoop(gameRows);
  gameState = { answer, guesses: [], solved: false };
  renderClues(clues);
  renderFeedback(null, null);
  renderHistory([]);
  const guessEl = document.getElementById('guess');
  const submitEl = document.getElementById('submit');
  guessEl.value = '';
  guessEl.removeAttribute('disabled');
  submitEl.removeAttribute('disabled');
  guessEl.focus();
}

function handleGuess() {
  if (gameState.solved) return;
  const raw = document.getElementById('guess').value.trim();
  const guess = Number(raw);
  if (!Number.isInteger(guess) || raw.length !== 3) return;
  if (guess === gameState.answer) {
    gameState.solved = true;
    renderFeedback('correct', gameState.answer);
    document.getElementById('guess').setAttribute('disabled', '');
    document.getElementById('submit').setAttribute('disabled', '');
  } else {
    gameState.guesses.push(guess);
    renderFeedback('incorrect', null);
    renderHistory(gameState.guesses);
    document.getElementById('guess').value = '';
    document.getElementById('guess').focus();
  }
}

// Event listeners — attached once, never inside startPuzzle()
document.getElementById('submit').addEventListener('click', handleGuess);
document.getElementById('guess').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleGuess();
});
document.getElementById('new-puzzle').addEventListener('click', startPuzzle);
