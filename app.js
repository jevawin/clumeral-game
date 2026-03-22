// Clumeral — app.js
// Production: puzzle data is injected by _worker.js as window.PUZZLE_DATA.
// Local dev (python -m http.server): falls back to importing puzzle.js directly.

// ─── Phase 3: Daily Puzzle ────────────────────────────────────────────────────

const EPOCH_DATE = "2026-03-08"; // Puzzle #1 launch date
const STORAGE_HISTORY = "dlng_history";
const STORAGE_PREFS = "dlng_prefs";

const OPERATOR_SYMBOLS = { "<=": "≤", ">=": "≥", "=": "=", "!=": "≠" };

let gameState = { answer: null, guesses: [], solved: false };
let saveScore = true;

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function puzzleNumber(dateStr) {
  const ms = new Date(dateStr + "T00:00:00") - new Date(EPOCH_DATE + "T00:00:00");
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Storage ───────────────────────────────────────────────────────────────────
function loadPrefs() {
  try {
    return { saveScore: true, ...JSON.parse(localStorage.getItem(STORAGE_PREFS) || "{}") };
  } catch {
    return { saveScore: true };
  }
}

function persistPrefs() {
  localStorage.setItem(STORAGE_PREFS, JSON.stringify({ saveScore }));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORY)) || [];
  } catch {
    return [];
  }
}

function recordGame(dateStr, tries) {
  const history = loadHistory().filter((h) => h.date !== dateStr);
  history.unshift({ date: dateStr, tries });
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 60)));
}

function todayEntry() {
  const today = todayLocal();
  return loadHistory().find((h) => h.date === today) || null;
}

// ── Render helpers ────────────────────────────────────────────────────────────
function formatClueValue(value) {
  if (typeof value !== "number" || !isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const frac = value - Math.floor(value);
  if (Math.abs(frac - 1 / 3) < 1e-9) return Math.floor(value) + ".3\u0307";
  if (Math.abs(frac - 2 / 3) < 1e-9) return Math.floor(value) + ".6\u0307";
  if (value % 0.5 === 0) return String(value);
  return value.toFixed(2);
}

function renderClues(clues) {
  const ul = document.getElementById("clues");
  ul.innerHTML = "";
  for (const { label, operator, value } of clues) {
    const li = document.createElement("li");
    li.className = "clue-row";

    if (typeof value === "boolean") {
      // Boolean clue: "The first digit is [not] a prime number"
      // Split on first ' is ' to separate subject from predicate
      const isAffirmative = operator === "=" ? value : !value;
      const [subject, ...rest] = label.split(" is ");
      const predicate = rest.join(" is ");
      li.appendChild(document.createTextNode(subject + " "));
      const strong = document.createElement("strong");
      strong.textContent = "is " + (isAffirmative ? "" : "not ") + predicate;
      li.appendChild(strong);
    } else {
      // Numeric clue: "The sum of ... is ≤ 5"
      li.appendChild(document.createTextNode(label + " "));
      const opSpan = document.createElement("span");
      opSpan.className = "clue-op";
      opSpan.textContent = OPERATOR_SYMBOLS[operator] ?? operator;
      li.appendChild(opSpan);
      li.appendChild(document.createTextNode(" "));
      const strong = document.createElement("strong");
      strong.textContent = formatClueValue(value);
      li.appendChild(strong);
    }

    ul.appendChild(li);
  }
}

function renderFeedback(type, answer, tries) {
  const el = document.getElementById("feedback");
  if (!el) return;
  if (type === "correct") {
    const t = tries === 1 ? "1 try" : `${tries} tries`;
    el.textContent = `You got it in ${t}! The answer was ${answer}.`;
    el.className = "feedback feedback--correct";
    el.style.display = "";
  } else if (type === "incorrect") {
    el.textContent = "Incorrect — try again.";
    el.className = "feedback feedback--incorrect";
    el.style.display = "";
  } else {
    el.textContent = "";
    el.className = "feedback";
    el.style.display = "none";
  }
}

function renderHistory(guesses) {
  const label = document.getElementById("history-label");
  const ul = document.getElementById("history");
  ul.innerHTML = "";
  if (guesses.length === 0) {
    if (label) label.style.display = "none";
    ul.style.display = "none";
    return;
  }
  if (label) label.style.display = "";
  ul.style.display = "";
  for (const g of guesses) {
    const li = document.createElement("li");
    li.textContent = g;
    li.className = "history-item";
    ul.appendChild(li);
  }
}

function renderStats() {
  const statsEl = document.getElementById("stats");
  if (!statsEl) return;
  const history = loadHistory();
  if (history.length === 0) {
    statsEl.style.display = "none";
    return;
  }
  const avg = (history.reduce((s, h) => s + h.tries, 0) / history.length).toFixed(1);
  const last5 = history.slice(0, 5);
  statsEl.innerHTML = `
    <p class="stats-heading">Your stats</p>
    <div class="stats-grid">
      <div class="stats-item"><span class="stats-val">${history.length}</span><span class="stats-lbl">Played</span></div>
      <div class="stats-item"><span class="stats-val">${avg}</span><span class="stats-lbl">Avg tries</span></div>
    </div>
    <p class="stats-last-lbl">Last ${last5.length} game${last5.length !== 1 ? "s" : ""}</p>
    <div class="stats-bubbles">${last5.map((h) => `<span class="stats-bubble">${h.tries}</span>`).join("")}</div>
  `;
  statsEl.style.display = "";
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
function updateCheckbox(checked) {
  saveScore = checked;
  const toggle = document.getElementById("save-toggle");
  if (!toggle) return;
  toggle.setAttribute("aria-checked", String(checked));
  toggle.querySelector(".icon-checked").style.display = checked ? "" : "none";
  toggle.querySelector(".icon-unchecked").style.display = checked ? "none" : "";
}

// ── Game ──────────────────────────────────────────────────────────────────────
function showNextPuzzle() {
  const num = puzzleNumber(todayLocal());
  const np = document.getElementById("next-puzzle");
  const nn = document.getElementById("next-number");
  if (np && nn) {
    nn.textContent = num + 1;
    np.style.display = "";
  }
}

function showCompletedState(tries) {
  const t = tries === 1 ? "1 try" : `${tries} tries`;
  const fb = document.getElementById("feedback");
  fb.textContent = `You already solved today's puzzle in ${t}!`;
  fb.className = "feedback feedback--correct";
  document.getElementById("input-area").style.display = "none";
  document.getElementById("save-row").style.display = "none";
  renderStats();
  showNextPuzzle();
}

function startRandomPuzzle(puzzleData) {
  const { answer, clues } = puzzleData;

  document.getElementById("puzzle-label").style.display = "none";
  document.getElementById("random-label").style.display = "";

  renderClues(clues);

  gameState = { answer, guesses: [], solved: false, isRandom: true };
  renderFeedback(null, null, 0);
  renderHistory([]);
  document.getElementById("stats").style.display = "none";
  document.getElementById("next-puzzle").style.display = "none";
  document.getElementById("random-again").style.display = "none";
  document.getElementById("save-row").style.display = "none";

  const guessEl = document.getElementById("guess");
  const submitEl = document.getElementById("submit");
  guessEl.value = "";
  guessEl.removeAttribute("disabled");
  submitEl.removeAttribute("disabled");
  guessEl.focus();
}

function startDailyPuzzle(puzzleData) {
  const { date, puzzleNumber: num, answer, clues } = puzzleData;

  document.getElementById("puzzle-label").style.display = "";
  document.getElementById("puzzle-number").textContent = num;
  document.getElementById("puzzle-date").textContent = formatDate(date);

  renderClues(clues);

  const entry = todayEntry();
  if (entry) {
    showCompletedState(entry.tries);
    return;
  }

  gameState = { answer, guesses: [], solved: false };
  renderFeedback(null, null, 0);
  renderHistory([]);
  document.getElementById("stats").style.display = "none";
  document.getElementById("next-puzzle").style.display = "none";

  const guessEl = document.getElementById("guess");
  const submitEl = document.getElementById("submit");
  guessEl.value = "";
  guessEl.removeAttribute("disabled");
  submitEl.removeAttribute("disabled");
  guessEl.focus();

  updateCheckbox(loadPrefs().saveScore);
}

function handleGuess() {
  if (gameState.solved) return;
  const raw = document.getElementById("guess").value.trim();
  const guess = Number(raw);
  if (!Number.isInteger(guess) || raw.length !== 3) return;

  const tries = gameState.guesses.length + 1;

  if (guess === gameState.answer) {
    gameState.solved = true;
    renderFeedback("correct", gameState.answer, tries);
    document.getElementById("guess").setAttribute("disabled", "");
    document.getElementById("submit").setAttribute("disabled", "");
    if (gameState.isRandom) {
      document.getElementById("random-again").style.display = "";
    } else {
      if (saveScore) {
        recordGame(todayLocal(), tries);
        renderStats();
      }
      showNextPuzzle();
    }
  } else {
    gameState.guesses.push(guess);
    renderFeedback("incorrect", null, 0);
    renderHistory(gameState.guesses);
    document.getElementById("guess").value = "";
    document.getElementById("guess").focus();
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function loadPuzzle() {
  const isRandomRoute = window.location.pathname === "/random";

  if (window.PUZZLE_DATA) {
    // Production: injected by _worker.js
    document.getElementById("status").style.display = "none";
    if (window.PUZZLE_DATA.isRandom) {
      startRandomPuzzle(window.PUZZLE_DATA);
    } else {
      startDailyPuzzle(window.PUZZLE_DATA);
    }
  } else {
    // Local dev fallback: import puzzle.js directly in-browser
    const { runFilterLoop, makeRng, dateSeedInt, todayLocal: tl, puzzleNumber: pn } =
      await import("./puzzle.js");
    document.getElementById("status").style.display = "none";
    if (isRandomRoute) {
      const seed = Math.floor(Math.random() * 0xFFFFFFFF);
      const { answer, clues } = runFilterLoop(makeRng(seed));
      startRandomPuzzle({ answer, clues, isRandom: true });
    } else {
      const today = tl();
      const { answer, clues } = runFilterLoop(makeRng(dateSeedInt(today)));
      startDailyPuzzle({ date: today, puzzleNumber: pn(today), answer, clues });
    }
  }
}

// Event listeners (module-level — not inside startDailyPuzzle)
document.getElementById("submit").addEventListener("click", handleGuess);
document.getElementById("guess").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleGuess();
});
document.getElementById("save-toggle").addEventListener("click", () => {
  updateCheckbox(!saveScore);
  persistPrefs();
});

loadPuzzle();
