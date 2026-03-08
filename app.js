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

  document.getElementById('status').style.display = 'none';
  startDailyPuzzle();
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

function runFilterLoop(rows, rng = Math.random) {
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
    const rangeName = untriedRanges[Math.floor(rng() * untriedRanges.length)];
    const colIndices = RANGE_GROUPS[rangeName];

    // FILT-03b: pick a random column within the range
    const colIndex = colIndices[Math.floor(rng() * colIndices.length)];
    const colHeader = gameHeaders[colIndex]; // index-based — resolves whatever PapaParse key is used

    // FILT-06: skip if column is uniform (all candidates have identical values)
    const values = candidates.map(r => r[colHeader]);
    if (new Set(values).size === 1) {
      triedRanges.add(rangeName); // range is informationally exhausted
      continue;
    }

    // FILT-03c: pick a random value from current candidates in this column
    const value = values[Math.floor(rng() * values.length)];

    // FILT-04: pick operator appropriate to column type
    const isText = typeof value === 'string';
    const ops = isText ? ['=', '!='] : ['<=', '=', '!=', '>='];
    const operator = ops[Math.floor(rng() * ops.length)];

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

// ─── Phase 3: Daily Puzzle ────────────────────────────────────────────────────

const EPOCH_DATE       = '2026-03-08'; // Puzzle #1 launch date
const STORAGE_HISTORY  = 'dlng_history';
const STORAGE_PREFS    = 'dlng_prefs';

const OPERATOR_SYMBOLS = { '<=': '≤', '>=': '≥', '=': '=', '!=': '≠' };

let gameState = { answer: null, guesses: [], solved: false };
let saveScore  = true;

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function puzzleNumber(dateStr) {
  const ms = new Date(dateStr + 'T00:00:00') - new Date(EPOCH_DATE + 'T00:00:00');
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function dateSeedInt(dateStr) {
  return parseInt(dateStr.replace(/-/g, ''), 10);
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Storage ───────────────────────────────────────────────────────────────────
function loadPrefs() {
  try { return { saveScore: true, ...JSON.parse(localStorage.getItem(STORAGE_PREFS) || '{}') }; }
  catch { return { saveScore: true }; }
}

function persistPrefs() {
  localStorage.setItem(STORAGE_PREFS, JSON.stringify({ saveScore }));
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY)) || []; }
  catch { return []; }
}

function recordGame(dateStr, tries) {
  const history = loadHistory().filter(h => h.date !== dateStr);
  history.unshift({ date: dateStr, tries });
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 60)));
}

function todayEntry() {
  const today = todayLocal();
  return loadHistory().find(h => h.date === today) || null;
}

// ── Render helpers ────────────────────────────────────────────────────────────
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

function renderFeedback(type, answer, tries) {
  const el = document.getElementById('feedback');
  if (!el) return;
  if (type === 'correct') {
    const t = tries === 1 ? '1 try' : `${tries} tries`;
    el.textContent = `You got it in ${t}! The answer was ${answer}.`;
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

function renderStats() {
  const statsEl = document.getElementById('stats');
  if (!statsEl) return;
  const history = loadHistory();
  if (history.length === 0) { statsEl.style.display = 'none'; return; }
  const avg = (history.reduce((s, h) => s + h.tries, 0) / history.length).toFixed(1);
  const last5 = history.slice(0, 5);
  statsEl.innerHTML = `
    <p class="stats-heading">Your stats</p>
    <div class="stats-grid">
      <div class="stats-item"><span class="stats-val">${history.length}</span><span class="stats-lbl">Played</span></div>
      <div class="stats-item"><span class="stats-val">${avg}</span><span class="stats-lbl">Avg tries</span></div>
    </div>
    <p class="stats-last-lbl">Last ${last5.length} game${last5.length !== 1 ? 's' : ''}</p>
    <div class="stats-bubbles">${last5.map(h => `<span class="stats-bubble">${h.tries}</span>`).join('')}</div>
  `;
  statsEl.style.display = '';
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
function updateCheckbox(checked) {
  saveScore = checked;
  const toggle = document.getElementById('save-toggle');
  if (!toggle) return;
  toggle.setAttribute('aria-checked', String(checked));
  toggle.querySelector('.icon-checked').style.display   = checked ? '' : 'none';
  toggle.querySelector('.icon-unchecked').style.display = checked ? 'none' : '';
}

// ── Game ──────────────────────────────────────────────────────────────────────
function showNextPuzzle() {
  const num = puzzleNumber(todayLocal());
  const np  = document.getElementById('next-puzzle');
  const nn  = document.getElementById('next-number');
  if (np && nn) { nn.textContent = num + 1; np.style.display = ''; }
}

function showCompletedState(tries) {
  const t  = tries === 1 ? '1 try' : `${tries} tries`;
  const fb = document.getElementById('feedback');
  fb.textContent = `You already solved today's puzzle in ${t}!`;
  fb.className   = 'feedback feedback--correct';
  document.getElementById('input-area').style.display = 'none';
  document.getElementById('save-row').style.display   = 'none';
  renderStats();
  showNextPuzzle();
}

function startDailyPuzzle() {
  const today = todayLocal();
  const num   = puzzleNumber(today);

  document.getElementById('puzzle-label').style.display = '';
  document.getElementById('puzzle-number').textContent  = num;
  document.getElementById('puzzle-date').textContent    = formatDate(today);

  const rng            = makeRng(dateSeedInt(today));
  const { answer, clues } = runFilterLoop(gameRows, rng);
  renderClues(clues);

  const entry = todayEntry();
  if (entry) {
    showCompletedState(entry.tries);
    return;
  }

  gameState = { answer, guesses: [], solved: false };
  renderFeedback(null, null, 0);
  renderHistory([]);
  document.getElementById('stats').style.display        = 'none';
  document.getElementById('next-puzzle').style.display  = 'none';

  const guessEl  = document.getElementById('guess');
  const submitEl = document.getElementById('submit');
  guessEl.value  = '';
  guessEl.removeAttribute('disabled');
  submitEl.removeAttribute('disabled');
  guessEl.focus();

  updateCheckbox(loadPrefs().saveScore);
}

function handleGuess() {
  if (gameState.solved) return;
  const raw   = document.getElementById('guess').value.trim();
  const guess = Number(raw);
  if (!Number.isInteger(guess) || raw.length !== 3) return;

  const tries = gameState.guesses.length + 1;

  if (guess === gameState.answer) {
    gameState.solved = true;
    renderFeedback('correct', gameState.answer, tries);
    document.getElementById('guess').setAttribute('disabled', '');
    document.getElementById('submit').setAttribute('disabled', '');
    if (saveScore) {
      recordGame(todayLocal(), tries);
      renderStats();
    }
    showNextPuzzle();
  } else {
    gameState.guesses.push(guess);
    renderFeedback('incorrect', null, 0);
    renderHistory(gameState.guesses);
    document.getElementById('guess').value = '';
    document.getElementById('guess').focus();
  }
}

// Event listeners
document.getElementById('submit').addEventListener('click', handleGuess);
document.getElementById('guess').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleGuess();
});
document.getElementById('save-toggle').addEventListener('click', () => {
  updateCheckbox(!saveScore);
  persistPrefs();
});
