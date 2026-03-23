// Clumeral — app.js
// Production: puzzle data is injected by _worker.js as window.PUZZLE_DATA.
// Local dev (python -m http.server): falls back to importing puzzle.js directly.

import { launchConfetti } from './confetti.js';

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

function getClueTag(propKey) {
  if (propKey.includes("IsPrime"))      return "PRIME";
  if (propKey.includes("IsSquare"))     return "SQUARE";
  if (propKey.includes("IsCube"))       return "CUBE";
  if (propKey.includes("IsTriangular")) return "TRIAN";
  if (propKey.startsWith("sum"))        return "SUM";
  if (propKey.startsWith("diff"))       return "DIFF";
  if (propKey.startsWith("prod"))       return "PROD";
  if (propKey.startsWith("mean"))       return "MEAN";
  if (propKey === "range")              return "RANGE";
  return "?";
}

function digitPositions(propKey) {
  if (propKey.endsWith("FS"))                           return [true, true, false];
  if (propKey.endsWith("FT"))                           return [true, false, true];
  if (propKey.endsWith("ST"))                           return [false, true, true];
  if (propKey.endsWith("All") || propKey === "range")   return [true, true, true];
  if (propKey.startsWith("first"))                      return [true, false, false];
  if (propKey.startsWith("second"))                     return [false, true, false];
  if (propKey.startsWith("third"))                      return [false, false, true];
  return [true, true, true];
}

function renderClues(clues) {
  const container = document.querySelector(".cw-clue-container");
  if (!container) return;
  container.innerHTML = "";
  for (const { propKey, label, operator, value } of clues) {
    const tag = getClueTag(propKey);
    const lit = digitPositions(propKey);
    const miniDigitsHtml = lit.map((on) => `<div class="md${on ? " lit" : ""}"></div>`).join("");

    let l1Text, l2Text;
    if (typeof value === "boolean") {
      const isAffirmative = operator === "=" ? value : !value;
      const idx = label.indexOf(" is ");
      const subject = label.slice(0, idx);
      const predicate = label.slice(idx + 4);
      l1Text = subject;
      l2Text = "is" + (isAffirmative ? "" : " not") + " " + predicate;
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

function renderFeedback(type, answer) {
  const hint = document.getElementById("cw-hint");
  const fb = document.getElementById("cw-feedback");
  if (type === "correct") {
    if (hint) hint.style.display = "none";
    if (fb) {
      fb.textContent = `Congratulations! ${answer} is the correct answer.`;
      fb.className = "cw-feedback cw-feedback--correct";
      fb.style.display = "";
    }
  } else if (type === "incorrect") {
    if (hint) {
      hint.textContent = "Incorrect — try again.";
      hint.style.color = "var(--acc)";
    }
    if (fb) fb.style.display = "none";
  } else {
    if (hint) {
      hint.textContent = "Tap a box to eliminate possible numbers.";
      hint.style.color = "";
    }
    if (fb) {
      fb.textContent = "";
      fb.style.display = "none";
    }
  }
}

function renderHistory(guesses) {
  const wrap = document.getElementById("cw-history");
  const ul = document.getElementById("cw-history-list");
  if (!ul || !wrap) return;
  ul.innerHTML = "";
  if (guesses.length === 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "";
  for (const g of guesses) {
    const li = document.createElement("li");
    li.textContent = g;
    li.className = "cw-history-item";
    ul.appendChild(li);
  }
}

function renderStats() {
  const statsEl = document.getElementById("cw-stats");
  if (!statsEl) return;
  const history = loadHistory();
  if (history.length === 0) {
    statsEl.style.display = "none";
    return;
  }
  const avg = (history.reduce((s, h) => s + h.tries, 0) / history.length).toFixed(1);
  const last5 = history.slice(0, 5);
  statsEl.innerHTML = `
    <p class="cw-stats-heading">Your stats</p>
    <div class="cw-stats-grid">
      <div class="cw-stats-item"><span class="cw-stats-val">${history.length}</span><span class="cw-stats-lbl">Played</span></div>
      <div class="cw-stats-item"><span class="cw-stats-val">${avg}</span><span class="cw-stats-lbl">Avg tries</span></div>
    </div>
    <p class="cw-stats-last-lbl">Last ${last5.length} game${last5.length !== 1 ? "s" : ""}</p>
    <div class="cw-stats-bubbles">${last5.map((h) => `<span class="cw-stats-bubble">${h.tries}</span>`).join("")}</div>
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
  const np = document.getElementById("cw-next");
  const nn = document.getElementById("cw-next-number");
  if (np && nn) {
    nn.textContent = num + 1;
    np.style.display = "";
  }
}

function showCompletedState(tries) {
  const t = tries === 1 ? "1 try" : `${tries} tries`;
  const fb = document.getElementById("cw-feedback");
  if (fb) {
    fb.textContent = `You already solved today's puzzle in ${t}!`;
    fb.className = "cw-feedback cw-feedback--correct";
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
  renderFeedback(null);
  renderHistory([]);

  const statsEl = document.getElementById("cw-stats");
  if (statsEl) statsEl.style.display = "none";
  const npEl = document.getElementById("cw-next");
  if (npEl) npEl.style.display = "none";
  const ragain = document.getElementById("cw-again");
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
  renderFeedback(null);
  renderHistory([]);

  const statsEl = document.getElementById("cw-stats");
  if (statsEl) statsEl.style.display = "none";
  const npEl = document.getElementById("cw-next");
  if (npEl) npEl.style.display = "none";

  const hintEl = document.getElementById("cw-hint");
  if (hintEl) hintEl.style.display = "";
  const digitsEl = document.getElementById("cw-digits");
  if (digitsEl) digitsEl.style.display = "";

  possibles = initPossibles();
  renderAllBoxes();
  closeKeypad();
  checkSubmit();
  maybeAutoShowModal();

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
    launchConfetti();
    renderFeedback("correct", gameState.answer, tries);
    closeKeypad();
    const digitsEl = document.getElementById("cw-digits");
    if (digitsEl) digitsEl.style.display = "none";
    const submitWrap = document.getElementById("cw-submit-wrap");
    if (submitWrap) submitWrap.classList.remove("visible");
    if (gameState.isRandom) {
      const ragain = document.getElementById("cw-again");
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
    renderFeedback("incorrect");
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

let _openModal = null;

function initModal() {
  const modal = document.getElementById("cw-modal");
  if (!modal) return;
  const htpBtn = document.getElementById("cw-htp-btn");

  function openModal() {
    localStorage.setItem("cw-htp-seen", "1");
    modal.style.display = "flex";
    requestAnimationFrame(() => modal.classList.add("open"));
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.addEventListener("transitionend", () => {
      modal.style.display = "none";
      if (htpBtn) htpBtn.focus();
    }, { once: true });
  }

  _openModal = openModal;

  const closeBtn = document.getElementById("cw-modal-close");
  const gotitBtn = document.getElementById("cw-modal-gotit");
  if (htpBtn) htpBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (gotitBtn) gotitBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });
}

function maybeAutoShowModal() {
  if (localStorage.getItem("cw-htp-seen")) return;
  if (loadHistory().length > 0) return;
  if (!_openModal) return;
  setTimeout(_openModal, 400);
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

// ─── Octopus animations ───────────────────────────────────────────────────────

const octoEl     = document.getElementById('octo');
const octoWrapEl = document.getElementById('octo-wrap');
const tlts       = [...document.querySelectorAll('.tlt')];

// ── Eye tracking ──
let eyeTX = 0, eyeTY = 0, eyeX = 0, eyeY = 0;
let exprMode = 'round';

const eyeLR  = document.getElementById('eyeL-r');
const eyeRR  = document.getElementById('eyeR-r');
const eyeLS  = document.getElementById('eyeL-s');
const eyeRS  = document.getElementById('eyeR-s');
const mouthH = document.getElementById('mouth-h');
const mouthS = document.getElementById('mouth-s');

document.addEventListener('mousemove', (e) => {
  if (exprMode !== 'squint-glancing') {
    const r  = octoEl.getBoundingClientRect();
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    eyeTX = cl((e.clientX - (r.left + r.width  / 2)) / 55, -1.8,  1.8);
    eyeTY = cl((e.clientY - (r.top  + r.height / 2)) / 55, -1.5,  1.5);
  }
});

(function trackEyes() {
  eyeX += (eyeTX - eyeX) * 0.12;
  eyeY += (eyeTY - eyeY) * 0.12;
  eyeLR.setAttribute('cx', 19 + eyeX); eyeLR.setAttribute('cy', 15 + eyeY);
  eyeRR.setAttribute('cx', 33 + eyeX); eyeRR.setAttribute('cy', 15 + eyeY);
  eyeLS.setAttribute('transform', `translate(${eyeX},${eyeY})`);
  eyeRS.setAttribute('transform', `translate(${eyeX},${eyeY})`);
  requestAnimationFrame(trackEyes);
})();

// ── Blink / wink ──
let winkLeft = true;
function winkEye(eye, cb) {
  const dur = 140, s = performance.now();
  (function f(now) {
    const t = Math.min((now - s) / dur, 1);
    eye.setAttribute('r', Math.max(0.1, 3 * Math.abs(Math.cos(t * Math.PI))));
    if (t < 1) requestAnimationFrame(f);
    else { eye.setAttribute('r', 3); if (cb) cb(); }
  })(performance.now());
}
function scheduleBlink() {
  setTimeout(() => {
    if (exprMode !== 'round') { scheduleBlink(); return; }
    const fi = winkLeft ? eyeLR : eyeRR;
    const se = winkLeft ? eyeRR : eyeLR;
    winkLeft = !winkLeft;
    winkEye(fi, () => setTimeout(() => winkEye(se, scheduleBlink), 200));
  }, 2200 + Math.random() * 2000);
}
scheduleBlink();

// ── Squint-glance ──
function fadeExpr(toSquint, dur, onDone) {
  const s = performance.now();
  (function f(now) {
    const t = Math.min((now - s) / dur, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const ra = toSquint ? 1 - e : e;
    const sa = toSquint ? e : 1 - e;
    [eyeLR, eyeRR].forEach((el) => el.setAttribute('opacity', ra));
    [eyeLS, eyeRS].forEach((el) => el.setAttribute('opacity', sa));
    mouthH.setAttribute('opacity', ra);
    mouthS.setAttribute('opacity', sa);
    if (t < 1) requestAnimationFrame(f);
    else {
      [eyeLR, eyeRR].forEach((el) => el.setAttribute('opacity', toSquint ? '0' : '1'));
      [eyeLS, eyeRS].forEach((el) => el.setAttribute('opacity', toSquint ? '1' : '0'));
      mouthH.setAttribute('opacity', toSquint ? '0' : '1');
      mouthS.setAttribute('opacity', toSquint ? '1' : '0');
      if (onDone) onDone();
    }
  })(performance.now());
}

let squintBusy = false;
function doSquint() {
  if (squintBusy || exprMode !== 'round') return;
  squintBusy = true; exprMode = 'transitioning';
  eyeLR.setAttribute('r', '3'); eyeRR.setAttribute('r', '3');
  fadeExpr(true, 260, () => {
    exprMode = 'squint-glancing';
    const glances = [{ tx: -1.5, ty: -0.6 }, { tx: 1.4, ty: -0.4 }, { tx: 0.3, ty: 0.9 }, { tx: 0, ty: 0 }];
    let gi = 0;
    function glance() {
      if (gi >= glances.length) {
        exprMode = 'transitioning';
        eyeLS.removeAttribute('transform'); eyeRS.removeAttribute('transform');
        fadeExpr(false, 260, () => { exprMode = 'round'; squintBusy = false; scheduleSquint(); });
        return;
      }
      const g = glances[gi++];
      const dur = 460 + Math.random() * 360;
      const s = performance.now(), fx = eyeTX, fy = eyeTY;
      (function mv(now) {
        const t = Math.min((now - s) / dur, 1);
        const e = 1 - Math.pow(1 - t, 3);
        eyeTX = fx + (g.tx - fx) * e;
        eyeTY = fy + (g.ty - fy) * e;
        if (t < 1) requestAnimationFrame(mv);
        else setTimeout(glance, 160 + Math.random() * 180);
      })(performance.now());
    }
    glance();
  });
}
function scheduleSquint() {
  setTimeout(() => { if (exprMode === 'round') doSquint(); else scheduleSquint(); },
    5000 + Math.random() * 5000);
}
scheduleSquint();

// ── Spring bounce ──
function springBounce(cb) {
  const H = 56, dur = 660, s = performance.now();
  (function f(now) {
    const r = Math.min((now - s) / dur, 1);
    let y = 0, sx = 1, sy = 1;
    if (r < 0.38) {
      const p = r / 0.38, e = 1 - Math.pow(1 - p, 3);
      y = -e * H; sy = 1 + 0.10 * Math.sin(p * Math.PI); sx = 1 - 0.06 * Math.sin(p * Math.PI);
    } else if (r < 0.78) {
      const p = (r - 0.38) / 0.40;
      y = -(1 - p * p) * H;
    } else {
      const p = (r - 0.78) / 0.22;
      y = Math.exp(-13 * p) * Math.cos(Math.PI * p) * 10;
      const sq = Math.exp(-9 * p);
      sx = 1 + 0.28 * sq; sy = 1 - 0.22 * sq;
    }
    octoWrapEl.style.transform = `translateY(${y}px) scaleX(${sx}) scaleY(${sy})`;
    if (r < 1) requestAnimationFrame(f);
    else { octoWrapEl.style.transform = ''; if (cb) cb(); }
  })(performance.now());
}

// ── Letter reveal ──
let entryBusy = false, bobT = 0;

function resetOcto() {
  octoWrapEl.style.transition = 'none';
  octoWrapEl.style.opacity    = '0';
  octoWrapEl.style.transform  = 'translateY(-0.75rem)';
}

function revealOcto(onDone) {
  void octoWrapEl.offsetWidth;
  octoWrapEl.style.transition = 'opacity 0.2s ease-out, transform 0.4s cubic-bezier(.34,1.56,.64,1)';
  octoWrapEl.style.opacity    = '1';
  octoWrapEl.style.transform  = 'translateY(0)';
  setTimeout(() => {
    octoWrapEl.style.transition = '';
    octoWrapEl.style.transform  = '';
    if (onDone) onDone();
  }, 420);
}

function resetLetters() {
  tlts.forEach((l) => {
    l.style.transition = 'none';
    l.style.opacity    = '0';
    l.style.transform  = 'translateY(10px)';
  });
}

function revealLetters(onDone) {
  tlts.forEach((l, i) => setTimeout(() => {
    l.style.transition = 'opacity .15s ease-out, transform .22s cubic-bezier(.34,1.56,.64,1)';
    l.style.opacity    = '1';
    l.style.transform  = 'translateY(0)';
    if (i === tlts.length - 1) setTimeout(onDone, 120);
  }, i * 80));
}

function watchLetters(dur) {
  const s = performance.now();
  (function f(now) {
    const t  = Math.min((now - s) / dur, 1);
    const li = Math.min(Math.floor(t * tlts.length), tlts.length - 1);
    const el = tlts[li];
    if (el && octoEl) {
      const lr = el.getBoundingClientRect();
      const or = octoEl.getBoundingClientRect();
      if (lr.width > 0 && or.width > 0) {
        eyeTX = Math.max(-1.8, Math.min(1.8, (lr.left + lr.width  / 2 - (or.left + or.width  / 2)) / 40));
        eyeTY = Math.max(-1.5, Math.min(1.5, (lr.top  + lr.height / 2 - (or.top  + or.height / 2)) / 40));
      }
    }
    if (t < 1) requestAnimationFrame(f);
  })(performance.now());
}

function runEntry() {
  if (entryBusy) return;
  entryBusy = true;
  resetLetters();
  resetOcto();
  revealOcto(() => {
    setTimeout(() => {
      const dur = tlts.length * 80 + 120;
      watchLetters(dur);
      revealLetters(() => setTimeout(() => springBounce(() => { entryBusy = false; }), 80));
    }, 80);
  });
}

octoWrapEl.addEventListener('click', () => { if (!entryBusy) runEntry(); });

// ── Idle bob ──
(function bob() {
  if (!entryBusy) {
    bobT += 0.030;
    octoWrapEl.style.transform =
      `translateY(${Math.sin(bobT) * 2.5}px) rotate(${Math.sin(bobT * 0.45) * 0.8}deg)`;
  }
  requestAnimationFrame(bob);
})();

(document.fonts ? document.fonts.ready : Promise.resolve())
  .then(() => setTimeout(runEntry, 200))
  .catch(() => setTimeout(runEntry, 500));

initTheme();
initModal();
loadPuzzle();
