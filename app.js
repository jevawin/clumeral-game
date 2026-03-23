// Clumeral — app.js
// Production: puzzle data is injected by _worker.js as window.PUZZLE_DATA.
// Local dev (python -m http.server): falls back to importing puzzle.js directly.

// ─── Constants ────────────────────────────────────────────────────────────────

const EPOCH_DATE = "2026-03-08";
const STORAGE_HISTORY = "dlng_history";
const STORAGE_PREFS = "dlng_prefs";
const STORAGE_THEME = "dlng_theme";
const OPERATOR_SYMBOLS = { "<=": "≤", ">=": "≥", "=": "=", "!=": "≠" };

// ─── Module state ─────────────────────────────────────────────────────────────

let gameState = { answer: null, guesses: [], solved: false };
let saveScore = true;

function initPossibles() {
  return [
    new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),          // hundreds: no zero
    new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
  ];
}

let possibles = initPossibles();
let activeBox = null; // 0 | 1 | 2 | null

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

// ─── Storage ──────────────────────────────────────────────────────────────────

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

// ─── Clue helpers ─────────────────────────────────────────────────────────────

function formatClueValue(value) {
  if (typeof value !== "number" || !isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const frac = value - Math.floor(value);
  if (Math.abs(frac - 1 / 3) < 1e-9) return Math.floor(value) + ".3\u0307";
  if (Math.abs(frac - 2 / 3) < 1e-9) return Math.floor(value) + ".6\u0307";
  if (value % 0.5 === 0) return String(value);
  return value.toFixed(2);
}

function getClueTag(label) {
  const l = label.toLowerCase();
  if (l.includes("prime")) return "PRIME";
  if (l.includes("square")) return "SQUARE";
  if (l.includes("cube")) return "CUBE";
  if (l.includes("triangular")) return "TRIG";
  if (l.includes("sum")) return "SUM";
  if (l.includes("difference")) return "DIFF";
  if (l.includes("product")) return "PROD";
  if (l.includes("mean")) return "MEAN";
  if (l.includes("range")) return "RANGE";
  return "?";
}

function getClueLitDigits(label) {
  const l = label.toLowerCase();
  if (l.includes("all three")) return [true, true, true];
  if (l.includes("first and second")) return [true, true, false];
  if (l.includes("first and third")) return [true, false, true];
  if (l.includes("second and third")) return [false, true, true];
  if (l.includes("first digit")) return [true, false, false];
  if (l.includes("second digit")) return [false, true, false];
  if (l.includes("third digit")) return [false, false, true];
  return [true, true, true];
}

function renderClues(clues) {
  const container = document.querySelector(".cw-clue-container");
  if (!container) return;
  container.innerHTML = "";
  for (const { label, operator, value } of clues) {
    const tag = getClueTag(label);
    const lit = getClueLitDigits(label);
    const miniDigitsHtml = lit.map((on) => `<div class="md${on ? " lit" : ""}"></div>`).join("");

    let l1Text, l2Text;
    if (typeof value === "boolean") {
      const isAffirmative = operator === "=" ? value : !value;
      const idx = label.indexOf(" is ");
      const subject = label.slice(0, idx);
      const predicate = label.slice(idx + 4);
      l1Text = subject + " is" + (isAffirmative ? "" : " not");
      l2Text = predicate;
    } else {
      l1Text = label;
      l2Text = `${OPERATOR_SYMBOLS[operator] ?? operator} ${formatClueValue(value)}`;
    }

    const clueEl = document.createElement("div");
    clueEl.className = "cw-clue";
    clueEl.innerHTML = `
      <div class="cw-tag-cell">
        <span class="cw-tag">${tag}</span>
        <div class="mini-digits">${miniDigitsHtml}</div>
      </div>
      <div class="cw-lines">
        <div class="cw-l1"></div>
        <div class="cw-l2"></div>
      </div>
    `;
    clueEl.querySelector(".cw-l1").textContent = l1Text;
    clueEl.querySelector(".cw-l2").textContent = l2Text;
    container.appendChild(clueEl);
  }
}

// ─── Feedback / history / stats ───────────────────────────────────────────────

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
  if (!ul) return;
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

// ─── Digit boxes ──────────────────────────────────────────────────────────────

function renderBox(i) {
  const el = document.getElementById(`d${i}`);
  if (!el) return;
  const s = possibles[i];

  if (s.size === 1) {
    el.innerHTML = `<span class="db-resolved">${[...s][0]}</span>`;
  } else if (i === 0) {
    // 3×3 grid for hundreds box (digits 1–9)
    const spans = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((d) => `<span${s.has(d) ? "" : ' class="elim"'}>${d}</span>`)
      .join("");
    el.innerHTML = `<div class="db-possibles">${spans}</div>`;
  } else {
    // 4-col grid for tens/units boxes (digits 0–9); 5 and 8 span 2 cols
    const spans = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((d) => {
        const isMid = d === 5 || d === 8;
        const isElim = !s.has(d);
        const cls = [isMid && "dc-mid", isElim && "elim"].filter(Boolean).join(" ");
        return `<span${cls ? ` class="${cls}"` : ""}>${d}</span>`;
      })
      .join("");
    el.innerHTML = `<div class="db-possibles four-col">${spans}</div>`;
  }

  el.classList.toggle("active", i === activeBox);
}

function renderAllBoxes() {
  renderBox(0);
  renderBox(1);
  renderBox(2);
}

function buildKeypad() {
  const kp = document.getElementById("cw-keypad");
  if (!kp || activeBox === null) return;
  // Box 0 (hundreds) cannot be 0
  const digits = activeBox === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  kp.innerHTML = "";
  for (const d of digits) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kbtn" + (possibles[activeBox].has(d) ? "" : " elim");
    btn.textContent = d;
    btn.setAttribute("aria-label", `Toggle digit ${d}`);
    btn.addEventListener("click", () => toggleDigit(d));
    kp.appendChild(btn);
  }
}

function openKeypad() {
  const wrap = document.getElementById("cw-keypad-wrap");
  if (wrap) wrap.classList.add("open");
}

function closeKeypad() {
  const wrap = document.getElementById("cw-keypad-wrap");
  if (wrap) wrap.classList.remove("open");
  activeBox = null;
  renderAllBoxes();
}

// Single mutation path for both keypad click and keyboard — prevents double-firing
function toggleDigit(digit) {
  if (activeBox === null) return;
  const s = possibles[activeBox];
  if (s.has(digit)) {
    if (s.size === 1) return; // guard: cannot eliminate last digit
    s.delete(digit);
  } else {
    s.add(digit);
  }
  renderBox(activeBox);
  buildKeypad();
  checkSubmit();
}

function openBox(i) {
  activeBox = i;
  renderAllBoxes();
  buildKeypad();
  openKeypad();
}

// Called by click: toggles same box closed, otherwise switches to new box
function selectBox(i) {
  if (gameState.solved) return;
  if (activeBox === i) {
    activeBox = null;
    closeKeypad();
    return;
  }
  openBox(i);
}

function checkSubmit() {
  const allResolved = possibles.every((s) => s.size === 1);
  const wrap = document.getElementById("cw-submit-wrap");
  if (wrap) wrap.classList.toggle("visible", allResolved);
}

// ─── Game ─────────────────────────────────────────────────────────────────────

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
  if (fb) {
    fb.textContent = `You already solved today's puzzle in ${t}!`;
    fb.className = "feedback feedback--correct";
    fb.style.display = "";
  }
  const hintEl = document.getElementById("cw-hint");
  if (hintEl) hintEl.style.display = "none";
  const digitsEl = document.getElementById("cw-digits");
  if (digitsEl) digitsEl.style.display = "none";
  const submitWrap = document.getElementById("cw-submit-wrap");
  if (submitWrap) submitWrap.classList.remove("visible");
  renderStats();
  showNextPuzzle();
}

function startRandomPuzzle(puzzleData) {
  const { answer, clues } = puzzleData;

  const plabel = document.getElementById("cw-plabel");
  if (plabel) plabel.textContent = "Random puzzle";

  renderClues(clues);

  gameState = { answer, guesses: [], solved: false, isRandom: true };
  renderFeedback(null, null, 0);
  renderHistory([]);

  const statsEl = document.getElementById("stats");
  if (statsEl) statsEl.style.display = "none";
  const npEl = document.getElementById("next-puzzle");
  if (npEl) npEl.style.display = "none";
  const ragain = document.getElementById("random-again");
  if (ragain) ragain.style.display = "none";
  // No score saving for random puzzles
  const saveEl = document.getElementById("cw-save");
  if (saveEl) saveEl.style.display = "none";

  const hintEl = document.getElementById("cw-hint");
  if (hintEl) hintEl.style.display = "";
  const digitsEl = document.getElementById("cw-digits");
  if (digitsEl) digitsEl.style.display = "";

  possibles = initPossibles();
  renderAllBoxes();
  closeKeypad();
  checkSubmit();
}

function startDailyPuzzle(puzzleData) {
  const { date, puzzleNumber: num, answer, clues } = puzzleData;

  const plabel = document.getElementById("cw-plabel");
  if (plabel) plabel.textContent = `Puzzle #${num} · ${formatDate(date)}`;

  renderClues(clues);

  const entry = todayEntry();
  if (entry) {
    showCompletedState(entry.tries);
    return;
  }

  gameState = { answer, guesses: [], solved: false };
  renderFeedback(null, null, 0);
  renderHistory([]);

  const statsEl = document.getElementById("stats");
  if (statsEl) statsEl.style.display = "none";
  const npEl = document.getElementById("next-puzzle");
  if (npEl) npEl.style.display = "none";

  const hintEl = document.getElementById("cw-hint");
  if (hintEl) hintEl.style.display = "";
  const digitsEl = document.getElementById("cw-digits");
  if (digitsEl) digitsEl.style.display = "";

  possibles = initPossibles();
  renderAllBoxes();
  closeKeypad();
  checkSubmit();

  const prefs = loadPrefs();
  saveScore = prefs.saveScore;
  const ckEl = document.getElementById("cw-ck");
  if (ckEl) ckEl.checked = saveScore;
}

function handleGuess() {
  if (gameState.solved) return;
  if (!possibles.every((s) => s.size === 1)) return;

  const guessStr = possibles.map((s) => [...s][0]).join("");
  const guess = Number(guessStr);
  const tries = gameState.guesses.length + 1;

  if (guess === gameState.answer) {
    gameState.solved = true;
    renderFeedback("correct", gameState.answer, tries);
    closeKeypad();
    if (gameState.isRandom) {
      const ragain = document.getElementById("random-again");
      if (ragain) ragain.style.display = "";
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
    // Reset all boxes to full possibles on wrong guess
    possibles = initPossibles();
    renderAllBoxes();
    closeKeypad();
    checkSubmit();
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function loadPuzzle() {
  const isRandomRoute = window.location.pathname === "/random";

  if (window.PUZZLE_DATA) {
    if (window.PUZZLE_DATA.isRandom) {
      startRandomPuzzle(window.PUZZLE_DATA);
    } else {
      startDailyPuzzle(window.PUZZLE_DATA);
    }
  } else {
    const { runFilterLoop, makeRng, dateSeedInt, todayLocal: tl, puzzleNumber: pn } =
      await import("./puzzle.js");
    if (isRandomRoute) {
      const seed = Math.floor(Math.random() * 0xffffffff);
      const { answer, clues } = runFilterLoop(makeRng(seed));
      startRandomPuzzle({ answer, clues, isRandom: true });
    } else {
      const today = tl();
      const { answer, clues } = runFilterLoop(makeRng(dateSeedInt(today)));
      startDailyPuzzle({ date: today, puzzleNumber: pn(today), answer, clues });
    }
  }
}

// ─── Canvas dot-grid ──────────────────────────────────────────────────────────

function drawCanvas(dark) {
  const canvas = document.getElementById("cw-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dot = dark ? "rgba(255,253,247,0.07)" : "rgba(38,38,36,0.09)";
  const gap = 24;
  ctx.fillStyle = dot;
  for (let x = gap; x < canvas.width; x += gap) {
    for (let y = gap; y < canvas.height; y += gap) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function initTheme() {
  const root = document.documentElement;
  const togBtn = document.getElementById("cw-tog");
  if (!togBtn) return;

  function applyTheme(dark) {
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    togBtn.textContent = dark ? "Light" : "Dark";
    togBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    drawCanvas(dark);
  }

  const saved = localStorage.getItem(STORAGE_THEME);
  const isDark = saved !== null ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(isDark);

  togBtn.addEventListener("click", () => {
    const newDark = !root.classList.contains("dark");
    localStorage.setItem(STORAGE_THEME, newDark ? "dark" : "light");
    applyTheme(newDark);
  });

  window.addEventListener("resize", () => drawCanvas(root.classList.contains("dark")));
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function initModal() {
  const modal = document.getElementById("cw-modal");
  if (!modal) return;

  function openModal() {
    modal.style.display = "flex";
    requestAnimationFrame(() => modal.classList.add("open"));
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.addEventListener("transitionend", () => { modal.style.display = "none"; }, { once: true });
  }

  const htpBtn = document.getElementById("cw-htp-btn");
  const closeBtn = document.getElementById("cw-modal-close");
  const gotitBtn = document.getElementById("cw-modal-gotit");
  if (htpBtn) htpBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (gotitBtn) gotitBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
}

// ─── Event listeners (module-level) ───────────────────────────────────────────

// Digit box clicks
for (let i = 0; i < 3; i++) {
  const box = document.getElementById(`d${i}`);
  if (box) box.addEventListener("click", ((idx) => () => selectBox(idx))(i));
}

// Submit button
const cwSubmitEl = document.getElementById("cw-submit");
if (cwSubmitEl) cwSubmitEl.addEventListener("click", handleGuess);

// Save checkbox
const ckEl = document.getElementById("cw-ck");
if (ckEl) {
  ckEl.addEventListener("change", () => {
    saveScore = ckEl.checked;
    persistPrefs();
  });
}

// Keyboard: digit keys toggle active box; Tab/arrows navigate; Enter submits; Escape closes
document.addEventListener("keydown", (e) => {
  if (gameState.solved) return;

  const digit = parseInt(e.key, 10);
  if (!isNaN(digit) && e.key.length === 1) {
    if (activeBox === null) return;
    if (activeBox === 0 && digit === 0) return; // 0 invalid for hundreds
    e.preventDefault();
    toggleDigit(digit);
    return;
  }

  if (e.key === "Tab" && activeBox !== null) {
    const next = e.shiftKey ? activeBox - 1 : activeBox + 1;
    if (next >= 0 && next <= 2) {
      e.preventDefault();
      openBox(next);
    } else {
      closeKeypad();
      // Don't prevent default — let Tab leave the widget naturally
    }
    return;
  }

  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    if (activeBox === null) {
      openBox(dir === 1 ? 0 : 2);
    } else {
      const next = activeBox + dir;
      if (next >= 0 && next <= 2) openBox(next);
      else closeKeypad();
    }
    return;
  }

  if (e.key === "Enter" && possibles.every((s) => s.size === 1)) {
    e.preventDefault();
    handleGuess();
    return;
  }

  if (e.key === "Escape" && activeBox !== null) {
    closeKeypad();
  }
});

initTheme();
initModal();
loadPuzzle();
