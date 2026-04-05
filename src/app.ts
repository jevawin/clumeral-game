// Clumeral — app.ts
// Puzzle data is injected by the Worker as window.PUZZLE_DATA.

import type { GameState, ClueData } from './types.ts';
import { launchConfetti } from './confetti.ts';
import { loadPrefs, persistPrefs, loadHistory, recordGame } from './storage.ts';
import { initTheme } from './theme.ts';
import { initModal, maybeAutoShowModal, initFeedbackModal } from './modals.ts';
import { celebrateOcto, sadOcto } from './octo.ts';
import { initColours } from './colours.ts';

// ─── Analytics ───────────────────────────────────────────────────────────────

function getUid(): string {
  let uid = localStorage.getItem("dlng_uid");
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem("dlng_uid", uid);
  }
  return uid;
}

const analyticsUid = getUid();
const isNewUser = !localStorage.getItem("dlng_history");

function track(event: string, value?: number, source?: string): void {
  fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, uid: analyticsUid, value, newUser: isNewUser, source }),
  }).catch(() => {});
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EPOCH_DATE = "2026-03-08";
const OPERATOR_SYMBOLS: Record<string, string> = { "<": "<", ">": ">", "<=": "≤", ">=": "≥", "=": "=", "!=": "≠" };

// ─── DOM cache ───────────────────────────────────────────────────────────────

const $ = (sel: string) => document.querySelector(sel);

const dom = {
  hint: $('[data-hint]') as HTMLElement | null,
  feedback: $('[data-feedback]') as HTMLElement | null,
  digits: $('[data-digits]') as HTMLElement | null,
  keypadWrap: $('[data-keypad-wrap]') as HTMLElement | null,
  keypad: $('[data-keypad]') as HTMLElement | null,
  submitWrap: $('[data-submit-wrap]') as HTMLElement | null,
  submitBtn: $('[data-submit]') as HTMLButtonElement | null,
  save: $('[data-save]') as HTMLElement | null,
  saveCheck: $('[data-save-check]') as HTMLInputElement | null,
  stats: $('[data-stats]') as HTMLElement | null,
  next: $('[data-next]') as HTMLElement | null,
  nextNumber: $('[data-next-number]') as HTMLElement | null,
  again: $('[data-again]') as HTMLElement | null,
  plabel: $('[data-plabel]') as HTMLElement | null,
  history: $('[data-history]') as HTMLElement | null,
  historyList: $('[data-history-list]') as HTMLElement | null,
  clueList: $('.clue-list') as HTMLElement | null,
};

// ─── Module state ─────────────────────────────────────────────────────────────

let gameState: GameState = { answer: null, guesses: [], solved: false };
let saveScore = true;

function initPossibles(): Set<number>[] {
  return [
    new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),          // hundreds: no zero
    new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
  ];
}

let possibles: Set<number>[] = initPossibles();
let activeBox: number | null = null; // 0 | 1 | 2 | null

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function puzzleNumber(dateStr: string): number {
  const ms = new Date(dateStr + "T00:00:00").getTime() - new Date(EPOCH_DATE + "T00:00:00").getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Storage helper (uses todayLocal, stays in app.ts) ───────────────────────

function todayEntry() {
  const today = todayLocal();
  return loadHistory().find((h) => h.date === today) || null;
}

// ─── Clue helpers ─────────────────────────────────────────────────────────────

function formatClueValue(value: number | boolean): { text?: string; html?: string } {
  if (typeof value !== "number" || !isFinite(value)) return { text: String(value) };
  if (Number.isInteger(value)) return { text: String(value) };
  const frac = value - Math.floor(value);
  if (Math.abs(frac - 1 / 3) < 1e-9)
    return { html: Math.floor(value) + '.<span class="recurring">3</span>' };
  if (Math.abs(frac - 2 / 3) < 1e-9)
    return { html: Math.floor(value) + '.<span class="recurring">6</span>' };
  if (value % 0.5 === 0) return { text: String(value) };
  return { text: value.toFixed(2) };
}

function getClueTag(propKey: string): string {
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

function digitPositions(propKey: string): boolean[] {
  if (propKey.endsWith("FS"))                           return [true, true, false];
  if (propKey.endsWith("FT"))                           return [true, false, true];
  if (propKey.endsWith("ST"))                           return [false, true, true];
  if (propKey.endsWith("All") || propKey === "range")   return [true, true, true];
  if (propKey.startsWith("first"))                      return [true, false, false];
  if (propKey.startsWith("second"))                     return [false, true, false];
  if (propKey.startsWith("third"))                      return [false, false, true];
  return [true, true, true];
}

const TAG_TIPS: Record<string, string> = {
  PRIME: "Only divisible by 1 and itself",
  SQUARE: "Square root is an integer",
  CUBE: "Cube root is an integer",
  TRIAN: "Sum of consecutive numbers from 0",
  SUM: "Digits added together",
  DIFF: "Smaller of the digits subtracted from larger",
  PROD: "Digits multiplied together",
  MEAN: "Sum of digits divided by how many digits",
  RANGE: "Largest digit minus the smallest",
};

function showTagTip(tag: string, anchor: HTMLElement): void {
  closeTagTip();
  const tip = TAG_TIPS[tag];
  if (!tip) return;
  track("tooltip_opened");

  const popover = document.createElement("div");
  popover.className = "tag-tip";
  popover.setAttribute("role", "tooltip");
  popover.innerHTML = `
    <p class="tag-tip__text">${tip}</p>
    <button class="tag-tip__close" aria-label="Close">
      <svg width="16" height="16" aria-hidden="true"><use href="/sprites.svg#icon-circle-x"/></svg>
      Close
    </button>
  `;

  anchor.closest(".clue__tag-cell")!.appendChild(popover);

  const closeBtn = popover.querySelector(".tag-tip__close")!;
  closeBtn.addEventListener("click", closeTagTip);

  const onOutside = (e: Event) => {
    if (!popover.contains(e.target as Node) && e.target !== anchor) closeTagTip();
  };
  const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") closeTagTip(); };

  setTimeout(() => {
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onEscape);
  }, 0);

  popover.dataset.cleanup = "true";
  (popover as any)._cleanup = () => {
    document.removeEventListener("click", onOutside);
    document.removeEventListener("keydown", onEscape);
  };
}

function closeTagTip(): void {
  const existing = document.querySelector(".tag-tip");
  if (existing) {
    (existing as any)._cleanup?.();
    existing.remove();
  }
}

function renderClues(clues: ClueData[]): void {
  if (!dom.clueList) return;
  dom.clueList.innerHTML = "";
  for (const { propKey, label, operator, value } of clues) {
    const tag = getClueTag(propKey);
    const lit = digitPositions(propKey);
    const miniDigitsHtml = lit.map((on) => `<div class="clue__digit${on ? " lit" : ""}"></div>`).join("");

    let l1Text, l2Text, l2Html;
    if (typeof value === "boolean") {
      const isAffirmative = operator === "=" ? value : !value;
      const idx = label.indexOf(" is ");
      const subject = label.slice(0, idx);
      const predicate = label.slice(idx + 4);
      l1Text = subject;
      l2Text = "is" + (isAffirmative ? "" : " not") + " " + predicate;
    } else {
      l1Text = label;
      const formatted = formatClueValue(value);
      const opSymbol = OPERATOR_SYMBOLS[operator] ?? operator;
      if (formatted.html) {
        l2Html = `${opSymbol} ${formatted.html}`;
      } else {
        l2Text = `${opSymbol} ${formatted.text}`;
      }
    }

    const clueEl = document.createElement("div");
    clueEl.className = "clue";
    clueEl.setAttribute("role", "listitem");
    clueEl.innerHTML = `
      <div class="clue__tag-cell">
        <button class="clue__tag" type="button" aria-label="${tag} — tap for definition">
          <span>${tag}</span>
          <svg class="clue__tag-icon" width="14" height="14" aria-hidden="true"><use href="/sprites.svg#icon-info"/></svg>
        </button>
        <div class="clue__digits" aria-hidden="true">${miniDigitsHtml}</div>
      </div>
      <div class="clue__lines">
        <div class="clue__line1"></div>
        <div class="clue__line2"></div>
      </div>
    `;

    const tagBtn = clueEl.querySelector(".clue__tag") as HTMLButtonElement;
    tagBtn.addEventListener("click", () => showTagTip(tag, tagBtn));

    const l1El = clueEl.querySelector(".clue__line1");
    const l2El = clueEl.querySelector(".clue__line2");
    if (l1El) l1El.textContent = l1Text ?? "";
    if (l2El) {
      if (l2Html) {
        l2El.innerHTML = l2Html;
      } else {
        l2El.textContent = l2Text ?? "";
      }
    }
    dom.clueList.appendChild(clueEl);
  }
}

// ─── Feedback / history / stats ───────────────────────────────────────────────

const ICON_CHECK = `<svg class="feedback__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><mask id="fc-ck"><circle cx="12" cy="12" r="10" fill="white"/><path d="m9 12 2 2 4-4" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="12" cy="12" r="10" fill="currentColor" mask="url(#fc-ck)"/></svg>`;

const ICON_CROSS = `<svg class="feedback__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><mask id="fc-cx"><circle cx="12" cy="12" r="10" fill="white"/><path d="m15 9-6 6M9 9l6 6" stroke="black" stroke-width="2.5" stroke-linecap="round" fill="none"/></mask><circle cx="12" cy="12" r="10" fill="currentColor" mask="url(#fc-cx)"/></svg>`;

function renderFeedback(type: string | null, answer?: number): void {
  if (type === "correct") {
    dom.hint?.classList.add("hidden");
    if (dom.feedback) {
      dom.feedback.innerHTML = `${ICON_CHECK} Congratulations! ${answer} is the correct answer.`;
      dom.feedback.className = "feedback feedback--correct";
      dom.feedback.classList.remove("hidden");
    }
  } else if (type === "incorrect") {
    if (dom.feedback) {
      dom.feedback.innerHTML = `${ICON_CROSS} Incorrect — try again.`;
      dom.feedback.className = "feedback feedback--incorrect";
      dom.feedback.classList.remove("hidden");
    }
  } else {
    if (dom.hint) {
      dom.hint.textContent = "Tap a box to eliminate possible numbers.";
    }
    if (dom.feedback) {
      dom.feedback.textContent = "";
      dom.feedback.classList.add("hidden");
    }
  }
}

function renderHistory(guesses: number[]): void {
  if (!dom.historyList || !dom.history) return;
  dom.historyList.innerHTML = "";
  if (guesses.length === 0) {
    dom.history.classList.add("hidden");
    return;
  }
  dom.history.classList.remove("hidden");
  for (const g of guesses) {
    const li = document.createElement("li");
    li.textContent = String(g);
    li.className = "history__item";
    dom.historyList.appendChild(li);
  }
}

function renderStats() {
  if (!dom.stats) return;
  const history = loadHistory();
  if (history.length === 0) {
    dom.stats.classList.add("hidden");
    return;
  }
  const avg = (history.reduce((s, h) => s + h.tries, 0) / history.length).toFixed(1);
  const last5 = history.slice(0, 5);
  dom.stats.innerHTML = `
    <p class="stats__heading">Your stats</p>
    <div class="stats__grid">
      <div class="stats__item"><span class="stats__val">${history.length}</span><span class="stats__lbl">Played</span></div>
      <div class="stats__item"><span class="stats__val">${avg}</span><span class="stats__lbl">Avg tries</span></div>
    </div>
    <p class="stats__last-lbl">Last ${last5.length} game${last5.length !== 1 ? "s" : ""}</p>
    <div class="stats__bubbles">${last5.map((h) => `<span class="stats__bubble">${h.tries}</span>`).join("")}</div>
  `;
  dom.stats.classList.remove("hidden");
}

// ─── Digit boxes ──────────────────────────────────────────────────────────────

function renderBox(i: number): void {
  const el = document.querySelector(`[data-digit="${i}"]`) as HTMLElement | null;
  if (!el) return;
  const s = possibles[i];

  if (s.size === 1) {
    el.innerHTML = `<span class="digit-box__resolved">${[...s][0]}</span>`;
  } else {
    // 3-4-3 grid for all boxes (1-9 then 0)
    // Box 0 (hundreds): 0 is always eliminated since numbers are 100–999
    const spans = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
      .map((d) => {
        const isElim = (i === 0 && d === 0) || !s.has(d);
        return `<span${isElim ? ' class="elim"' : ""}>${d}</span>`;
      })
      .join("");
    el.innerHTML = `<div class="digit-box__grid four-col">${spans}</div>`;
  }

  el.classList.toggle("active", i === activeBox);
}

function renderAllBoxes() {
  renderBox(0);
  renderBox(1);
  renderBox(2);
}

function buildKeypad() {
  if (!dom.keypad || activeBox === null) return;
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  dom.keypad.innerHTML = "";
  for (const d of digits) {
    const btn = document.createElement("button");
    btn.type = "button";
    const disabled = activeBox === 0 && d === 0;
    btn.className = "keypad__btn" + (disabled || !possibles[activeBox].has(d) ? " elim" : "");
    btn.textContent = String(d);
    btn.setAttribute("aria-label", `Toggle digit ${d}`);
    if (disabled) {
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => toggleDigit(d));
    }
    dom.keypad.appendChild(btn);
  }
}

function openKeypad() {
  dom.keypadWrap?.classList.add("open");
}

function closeKeypad() {
  dom.keypadWrap?.classList.remove("open");
  activeBox = null;
  renderAllBoxes();
}

// Single mutation path for both keypad click and keyboard — prevents double-firing
function toggleDigit(digit: number): void {
  if (activeBox === null) return;
  renderFeedback(null);
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

function openBox(i: number): void {
  activeBox = i;
  renderAllBoxes();
  buildKeypad();
  openKeypad();
}

// Called by click: toggles same box closed, otherwise switches to new box
function selectBox(i: number): void {
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
  dom.submitWrap?.classList.toggle("visible", allResolved);
}

// ─── Game ─────────────────────────────────────────────────────────────────────

function showNextPuzzle() {
  if (dom.next && dom.nextNumber) {
    dom.nextNumber.textContent = String((gameState.puzzleNum ?? 0) + 1);
    dom.next.classList.remove("hidden");
  }
}

function showCompletedState(tries: number): void {
  const t = tries === 1 ? "1 try" : `${tries} tries`;
  if (dom.feedback) {
    dom.feedback.innerHTML = `${ICON_CHECK} You already solved today's puzzle in ${t}!`;
    dom.feedback.className = "feedback feedback--correct";
    dom.feedback.classList.remove("hidden");
  }
  // Show the answer digits in the boxes
  if (gameState.answer != null) {
    const digits = [Math.floor(gameState.answer / 100), Math.floor((gameState.answer % 100) / 10), gameState.answer % 10];
    digits.forEach((d, i) => { possibles[i] = new Set([d]); renderBox(i); });
  }
  dom.hint?.classList.add("hidden");
  dom.digits?.classList.add("digit-correct");
  dom.submitWrap?.classList.remove("visible");
  renderStats();
  showNextPuzzle();
}

function resetPuzzleUI() {
  renderFeedback(null);
  renderHistory([]);
  dom.stats?.classList.add("hidden");
  dom.next?.classList.add("hidden");
  dom.hint?.classList.remove("hidden");
  dom.digits?.classList.remove("hidden", "digit-correct");
  possibles = initPossibles();
  renderAllBoxes();
  closeKeypad();
  checkSubmit();
}

function startRandomPuzzle(puzzleData: { answer: number; clues: ClueData[] }): void {
  const { answer, clues } = puzzleData;

  if (dom.plabel) dom.plabel.textContent = "Random puzzle";

  renderClues(clues);

  gameState = { answer, guesses: [], solved: false, isRandom: true };
  resetPuzzleUI();
  track("puzzle_start");

  dom.again?.classList.add("hidden");
  // No score saving for random puzzles
  dom.save?.classList.add("hidden");
}

function startDailyPuzzle(puzzleData: { date: string; puzzleNumber: number; answer: number; clues: ClueData[] }): void {
  const { date, puzzleNumber: num, answer, clues } = puzzleData;

  if (dom.plabel) dom.plabel.textContent = `Puzzle #${num} · ${formatDate(date)}`;

  renderClues(clues);

  const entry = todayEntry();
  if (entry) {
    gameState = { answer, guesses: [], solved: true, puzzleNum: num };
    showCompletedState(entry.tries);
    return;
  }

  gameState = { answer, guesses: [], solved: false, puzzleNum: num };
  resetPuzzleUI();
  track("puzzle_start");
  const htpWasSeen = localStorage.getItem("cw-htp-seen");
  maybeAutoShowModal(openModal);
  if (!htpWasSeen && localStorage.getItem("cw-htp-seen")) {
    track("htp_opened", undefined, "auto");
  }

  const prefs = loadPrefs();
  saveScore = prefs.saveScore;
  if (dom.saveCheck) dom.saveCheck.checked = saveScore;
}

function handleGuess() {
  if (gameState.solved) return;
  if (!possibles.every((s) => s.size === 1)) return;

  const guessStr = possibles.map((s) => [...s][0]).join("");
  const guess = Number(guessStr);
  const tries = gameState.guesses.length + 1;

  if (guess === gameState.answer) {
    gameState.solved = true;
    track("puzzle_complete", tries);
    launchConfetti();
    renderFeedback("correct", gameState.answer ?? undefined);
    closeKeypad();
    dom.digits?.classList.add("digit-correct");
    dom.submitWrap?.classList.remove("visible");
    celebrateOcto();
    if (gameState.isRandom) {
      dom.again?.classList.remove("hidden");
    } else {
      if (saveScore) {
        recordGame(todayLocal(), tries);
        renderStats();
      }
      showNextPuzzle();
    }
  } else {
    gameState.guesses.push(guess);
    track("incorrect_guess");
    renderFeedback("incorrect");
    renderHistory(gameState.guesses);
    sadOcto();
    // Keep digits filled but hide submit — user can tap a box to change their guess
    dom.submitWrap?.classList.remove("visible");
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function loadPuzzle() {
  if (window.PUZZLE_DATA) {
    if (window.PUZZLE_DATA.isRandom) {
      startRandomPuzzle(window.PUZZLE_DATA);
    } else {
      const pd = window.PUZZLE_DATA;
      if (pd.date && pd.puzzleNumber !== undefined) {
        startDailyPuzzle({ date: pd.date, puzzleNumber: pd.puzzleNumber, answer: pd.answer, clues: pd.clues });
      }
    }
  } else {
    if (dom.feedback) {
      dom.feedback.textContent = 'Puzzle data not available. Please refresh the page.';
      dom.feedback.classList.remove('hidden');
    }
  }
}

// ─── Service worker ───────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'SW_UPDATED') window.location.reload();
  });
}

// ─── Event listeners (module-level) ───────────────────────────────────────────

// Digit box clicks
for (let i = 0; i < 3; i++) {
  const box = document.querySelector(`[data-digit="${i}"]`) as HTMLElement | null;
  if (box) box.addEventListener("click", ((idx) => () => selectBox(idx))(i));
}

// Submit button
dom.submitBtn?.addEventListener("click", handleGuess);

// Save checkbox
if (dom.saveCheck) {
  dom.saveCheck.addEventListener("change", () => {
    saveScore = dom.saveCheck!.checked;
    persistPrefs(saveScore);
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

// ─── Init ─────────────────────────────────────────────────────────────────────

initColours();
initTheme();
const openModal = initModal();
initFeedbackModal(todayLocal, puzzleNumber, formatDate);
loadPuzzle();

// ─── Analytics event listeners ───────────────────────────────────────────────

// HTP modal: opened (manual via button click)
document.querySelector('[data-htp-btn]')?.addEventListener('click', () => track('htp_opened', undefined, 'manual'));
// HTP modal: dismissed
document.querySelector('[data-modal-gotit]')?.addEventListener('click', () => track('htp_dismissed'));
// Feedback submitted
document.querySelector('[data-fb-send]')?.addEventListener('click', () => track('feedback_submitted'));
// Theme toggle
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => track('theme_toggle'));
// Colour change (event delegation — buttons are created dynamically)
document.querySelector('[data-swatches]')?.addEventListener('click', (e) => {
  if ((e.target as Element).closest('.swatch-btn')) track('colour_change');
});

// ─── Dev helpers (non-production only) ───────────────────────────────────────

window._devFillAnswer = () => {
  if (!gameState.answer) return;
  const digits = [Math.floor(gameState.answer / 100), Math.floor((gameState.answer % 100) / 10), gameState.answer % 10];
  digits.forEach((d, i) => { possibles[i] = new Set([d]); renderBox(i); });
  checkSubmit();
};
