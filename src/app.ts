// Clumeral — app.ts
// Puzzle data is fetched from the API. The answer never reaches the client.

import type { GameState, ClueData } from './types.ts';
import { launchBubbles } from './bubbles.ts';
import { loadPrefs, persistPrefs, loadHistory, recordGame } from './storage.ts';
import { initTheme } from './theme.ts';
import { initColours } from './colours.ts';
import { initFeedbackModal } from './modals.ts';
import { celebrateOcto, sadOcto } from './octo.ts';
import { showScreen } from './screens.ts';
import { navigate, replaceRoute, initRouter } from './router.ts';
import { initWelcome } from './welcome.ts';
import { renderCompletion } from './completion.ts';

// ─── Analytics ───────────────────────────────────────────────────────────────

function getUid(): string {
  let uid = localStorage.getItem("dlng_uid");
  if (!uid) {
    // crypto.randomUUID is only defined in secure contexts (HTTPS / localhost).
    // Fall back to a manual v4 UUID for non-secure dev hosts and older browsers.
    uid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : fallbackUuid();
    localStorage.setItem("dlng_uid", uid);
  }
  return uid;
}

function fallbackUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  archiveBanner: $('[data-archive-banner]') as HTMLElement | null,
  archiveBack: $('[data-archive-back]') as HTMLElement | null,
  history: $('[data-history]') as HTMLElement | null,
  historyList: $('[data-history-list]') as HTMLElement | null,
  clueList: $('[data-clue-list]') as HTMLElement | null,
};

// ─── Module state ─────────────────────────────────────────────────────────────

let gameState: GameState = { answer: null, guesses: [], solved: false };
let saveScore = true;
let submitting = false; // guard against double-submit during API call

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
  const ms = new Date(dateStr + "T00:00:00Z").getTime() - new Date(EPOCH_DATE + "T00:00:00Z").getTime();
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
  popover.className = "absolute left-0 bottom-full mb-2 min-w-[18rem] p-3 bg-surface rounded-md z-50";
  popover.setAttribute("role", "tooltip");
  popover.setAttribute("data-tag-tip", "");
  popover.innerHTML = `
    <button class="absolute top-1.5 right-1.5 p-0.5 rounded border border-border text-text hover:text-text" type="button" aria-label="Close">
      <svg width="14" height="14" class="stroke-[2]"><use href="/sprites.svg#icon-circle-x"/></svg>
    </button>
    <p class="text-base text-text leading-snug pr-6 font-[Quicksand]">${tip}</p>
  `;

  // Anchor to the parent flex column (tag + position indicators wrapper)
  const wrapper = anchor.parentElement;
  if (wrapper) {
    wrapper.classList.add("relative");
    wrapper.appendChild(popover);
  }

  // Flip tooltip below if it would be hidden behind the sticky header
  const headerH = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const rect = popover.getBoundingClientRect();
  if (rect.top < headerH) {
    popover.classList.remove("bottom-full", "mb-2");
    // Position 0.5rem below the tag button, not the wrapper
    popover.style.top = `${anchor.offsetTop + anchor.offsetHeight + 8}px`;
  }

  const closeBtn = popover.querySelector("button")!;
  closeBtn.addEventListener("click", closeTagTip);

  const onOutside = (e: Event) => {
    if (!popover.contains(e.target as Node) && e.target !== anchor) closeTagTip();
  };
  const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") closeTagTip(); };

  setTimeout(() => {
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onEscape);
  }, 0);

  (popover as any)._cleanup = () => {
    document.removeEventListener("click", onOutside);
    document.removeEventListener("keydown", onEscape);
  };
}

function closeTagTip(): void {
  const existing = document.querySelector("[data-tag-tip]");
  if (existing) {
    (existing as any)._cleanup?.();
    existing.remove();
  }
}

function renderClues(clues: ClueData[]): void {
  if (!dom.clueList) return;
  dom.clueList.removeAttribute("aria-busy");
  dom.clueList.innerHTML = "";
  for (const { propKey, label, operator, value } of clues) {
    const tag = getClueTag(propKey);
    const lit = digitPositions(propKey);
    const miniDigitsHtml = lit.map((on) =>
      `<span class="w-[1.375rem] h-[1.375rem] rounded-[1px] border ${on ? 'border-accent bg-accent/50' : 'border-accent bg-accent/5'}"></span>`
    ).join("");

    let leadText: string;
    let emphHtml: string;
    if (typeof value === "boolean") {
      const isAffirmative = operator === "=" ? value : !value;
      const idx = label.indexOf(" is ");
      const subject = label.slice(0, idx);
      const predicate = label.slice(idx + 4);
      leadText = subject + " is";
      emphHtml = (isAffirmative ? "" : "not ") + predicate;
    } else {
      leadText = operator === "=" ? label.replace(/\s+is$/, "") : label;
      const formatted = formatClueValue(value);
      const opSymbol = OPERATOR_SYMBOLS[operator] ?? operator;
      const valuePart = formatted.html ?? formatted.text;
      emphHtml = `${opSymbol} ${valuePart}`;
    }

    const clueEl = document.createElement("div");
    clueEl.className = "contents";
    clueEl.setAttribute("role", "listitem");
    clueEl.innerHTML = `
      <div class="flex flex-col gap-2">
        <button class="flex items-center justify-between gap-1 px-1 h-[1.375rem] rounded border border-accent bg-accent/5 text-accent font-mono text-base font-bold uppercase tracking-wide" type="button" data-clue-tag aria-label="${tag} — tap for definition">
          <span>${tag}</span>
          <svg width="14" height="14" class="stroke-[2.5]" aria-hidden="true"><use href="/sprites.svg#icon-info"/></svg>
        </button>
        <div class="flex justify-between gap-1" data-clue-digits aria-hidden="true">${miniDigitsHtml}</div>
      </div>
      <div class="text-lg text-text font-[Quicksand]" data-clue-line1></div>
    `;

    const tagBtn = clueEl.querySelector("[data-clue-tag]") as HTMLButtonElement;
    tagBtn.addEventListener("click", () => showTagTip(tag, tagBtn));

    const l1El = clueEl.querySelector("[data-clue-line1]");
    const leadHtml = leadText.replace(/\b(all three|mean|sum|range|product|difference|first|second|third)\b/gi, '<span class="font-bold">$1</span>');
    if (l1El) l1El.innerHTML = `${leadHtml} <span class="font-bold text-accent whitespace-nowrap">${emphHtml}</span>`;
    dom.clueList.appendChild(clueEl);
  }
}

// ─── Feedback / history / stats ───────────────────────────────────────────────

const ICON_CHECK = `<svg class="w-8 h-8 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><mask id="fc-ck"><circle cx="12" cy="12" r="10" fill="white"/><path d="m9 12 2 2 4-4" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="12" cy="12" r="10" fill="currentColor" mask="url(#fc-ck)"/></svg>`;

const ICON_CROSS = `<svg class="w-8 h-8 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><mask id="fc-cx"><circle cx="12" cy="12" r="10" fill="white"/><path d="m15 9-6 6M9 9l6 6" stroke="black" stroke-width="2.5" stroke-linecap="round" fill="none"/></mask><circle cx="12" cy="12" r="10" fill="currentColor" mask="url(#fc-cx)"/></svg>`;

function renderFeedback(type: string | null, answer?: number): void {
  if (type === "correct") {
    if (dom.feedback) {
      dom.feedback.innerHTML = `${ICON_CHECK} Correct! That's puzzle #${gameState.puzzleNum ?? ''}.`;
      dom.feedback.className = "flex items-center gap-2 text-base font-bold leading-snug mt-4 text-[#1a7a3a] dark:text-[#4cc990] font-[Quicksand]";
    }
  } else if (type === "incorrect") {
    if (dom.feedback) {
      dom.feedback.innerHTML = `${ICON_CROSS} Not quite — try again.`;
      dom.feedback.className = "flex items-center gap-2 text-base font-bold leading-snug mt-4 text-[#c03030] dark:text-[#f07070] font-[Quicksand]";
    }
  } else if (type === "error") {
    if (dom.feedback) {
      dom.feedback.innerHTML = `${ICON_CROSS} Something went wrong — please try again.`;
      dom.feedback.className = "flex items-center gap-2 text-base font-bold leading-snug mt-4 text-[#c03030] dark:text-[#f07070] font-[Quicksand]";
    }
  } else {
    if (dom.feedback) {
      dom.feedback.textContent = "";
      dom.feedback.className = "text-base font-bold leading-snug mt-4 hidden font-[Quicksand]";
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
    li.className = "font-mono text-base font-normal px-2 py-1 rounded-sm border border-border bg-surface text-text";
    dom.historyList.appendChild(li);
  }
}

// ─── Digit boxes ──────────────────────────────────────────────────────────────

function renderBox(i: number): void {
  const el = document.querySelector(`[data-digit="${i}"]`) as HTMLElement | null;
  if (!el) return;
  const s = possibles[i];

  if (s.size === 1) {
    el.innerHTML = `<span class="font-mono text-3xl font-bold text-text">${[...s][0]}</span>`;
  } else {
    // 3/4/3 layout — matches HTP digit-box (via .digit-box__grid.four-col CSS in tailwind.css)
    const spans = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((d) => {
        const isElim = (i === 0 && d === 0) || !s.has(d);
        return `<span class="${isElim ? 'elim' : ''}">${d}</span>`;
      })
      .join("");
    el.innerHTML = `<div class="digit-box__grid four-col">${spans}</div>`;
  }

  // Active state: accent border + accent shadow
  el.classList.toggle("border-accent", i === activeBox);
  el.classList.toggle("shadow-[3px_3px_0_rgba(10,133,10,0.3)]", i === activeBox);
  // Restore default border+shadow when not active
  el.classList.toggle("border-border", i !== activeBox);
  el.classList.toggle("shadow-[3px_3px_0_rgba(38,38,36,0.12)]", i !== activeBox);
  el.classList.toggle("dark:shadow-[3px_3px_0_rgba(0,0,0,0.25)]", i !== activeBox);

  el.setAttribute("aria-expanded", i === activeBox ? "true" : "false");
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
    const elim = disabled || !possibles[activeBox].has(d);
    btn.className = `h-12 rounded-sm font-mono text-lg font-normal border-[1.5px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
      elim
        ? 'bg-surface text-text/25 border-border shadow-none'
        : 'bg-surface text-text border-border shadow-[2px_2px_0_rgba(38,38,36,0.12)] dark:shadow-[2px_2px_0_rgba(0,0,0,0.25)]'
    }`;
    btn.textContent = String(d);
    btn.setAttribute("data-key", String(d));
    btn.setAttribute("aria-label", `Toggle digit ${d}`);
    if (elim) btn.setAttribute("aria-pressed", "true");
    if (disabled) {
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => toggleDigit(d));
    }
    dom.keypad.appendChild(btn);
  }
}

function openKeypad() {
  dom.keypadWrap?.classList.remove("hidden");
}

function closeKeypad() {
  dom.keypadWrap?.classList.add("hidden");
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
  if (dom.submitWrap) {
    dom.submitWrap.classList.toggle("hidden", !allResolved);
  }
}

// ─── Game ─────────────────────────────────────────────────────────────────────

function showNextPuzzle() {
  if (dom.next && dom.nextNumber) {
    dom.nextNumber.textContent = String((gameState.puzzleNum ?? 0) + 1);
    dom.next.classList.remove("hidden");
  }
}

function showCompletedState(tries: number, replayDate?: string): void {
  // /play in solved-replay mode is the same minimal view for today and archive:
  // clues + revealed digits + "Solved in N tries!" + a context-specific link.
  // Stats panel never appears here — it lives on /solved.
  const t = tries === 1 ? "1 try" : `${tries} tries`;
  if (dom.feedback) {
    dom.feedback.innerHTML = `${ICON_CHECK} Solved in ${t}!`;
    dom.feedback.className = "flex items-center gap-2 text-base font-bold leading-snug mt-4 text-[#1a7a3a] dark:text-[#4cc990] font-[Quicksand]";
    dom.feedback.classList.remove("hidden");
  }
  // Show the answer digits in the boxes
  if (gameState.answer != null) {
    const digits = [Math.floor(gameState.answer / 100), Math.floor((gameState.answer % 100) / 10), gameState.answer % 10];
    digits.forEach((d, i) => { possibles[i] = new Set([d]); renderBox(i); });
  }
  // Apply correct state to all digit boxes
  for (let i = 0; i < 3; i++) {
    const el = document.querySelector(`[data-digit="${i}"]`) as HTMLElement | null;
    if (el) {
      el.classList.add("bg-[rgba(46,139,87,0.12)]", "border-[rgba(46,139,87,0.4)]", "pointer-events-none");
    }
  }
  dom.submitWrap?.classList.add("hidden");
  dom.next?.classList.add("hidden");
  dom.history?.classList.add("hidden");

  if (dom.stats) {
    // Archive solved: Back-to-archive returns to the list; Latest goes to
    // today's puzzle via /play, which the resolver routes to /solved (if today
    // is solved), /welcome (no data yet), or /play (game) as appropriate.
    // Today's solved-replay: Show stats deep-links to /solved.
    const linksHtml = replayDate
      ? `<p class="mt-3 font-[Quicksand]"><a href="/archive" class="text-accent underline">Back to archive</a></p>
         <p class="mt-2 font-[Quicksand]"><a href="/play" class="text-accent underline">Latest puzzle</a></p>`
      : `<p class="mt-3 font-[Quicksand]"><a href="/solved" data-show-stats class="text-accent underline">Show stats</a></p>`;
    dom.stats.innerHTML = linksHtml;
    dom.stats.classList.remove("hidden");
  }
}

function resetPuzzleUI() {
  renderFeedback(null);
  renderHistory([]);
  dom.stats?.classList.add("hidden");
  dom.next?.classList.add("hidden");
  // Hide archive banner by default; startReplayPuzzle re-enables it for dated replays.
  if (dom.archiveBanner) {
    dom.archiveBanner.classList.add("hidden");
    dom.archiveBanner.classList.remove("inline-flex");
    dom.archiveBanner.innerHTML = "";
  }
  if (dom.archiveBack) {
    dom.archiveBack.classList.add("hidden");
    dom.archiveBack.classList.remove("inline-flex");
  }
  // Remove correct state from digit boxes
  for (let i = 0; i < 3; i++) {
    const el = document.querySelector(`[data-digit="${i}"]`) as HTMLElement | null;
    if (el) {
      el.classList.remove("bg-[rgba(46,139,87,0.12)]", "border-[rgba(46,139,87,0.4)]", "pointer-events-none");
    }
  }
  possibles = initPossibles();
  renderAllBoxes();
  closeKeypad();
  checkSubmit();
}

function startRandomPuzzle(clues: ClueData[], token: string): void {
  renderClues(clues);

  gameState = { answer: null, guesses: [], solved: false, isRandom: true, token };
  resetPuzzleUI();
  track("puzzle_start");

  dom.again?.classList.add("hidden");
}

function startDailyPuzzle(date: string, num: number, clues: ClueData[]): void {
  renderClues(clues);

  const entry = todayEntry();
  if (entry) {
    gameState = { answer: entry.answer ?? null, guesses: [], solved: true, tries: entry.tries, puzzleNum: num, date };
    showCompletedState(entry.tries);
    return;
  }

  gameState = { answer: null, guesses: [], solved: false, puzzleNum: num, date };
  resetPuzzleUI();
  track("puzzle_start");

  const prefs = loadPrefs();
  saveScore = prefs.saveScore;
  if (dom.saveCheck) dom.saveCheck.checked = saveScore;
}

async function startReplayPuzzle(date: string, num: number, clues: ClueData[]): Promise<void> {
  renderClues(clues);
  const showBanner = () => {
    if (!dom.archiveBanner) return;
    dom.archiveBanner.innerHTML = `<svg width="14" height="14" class="text-text shrink-0" aria-hidden="true"><use href="/sprites.svg#icon-archive"/></svg><span>Archived puzzle · #${num} · ${formatDate(date)}</span>`;
    dom.archiveBanner.classList.remove("hidden");
    dom.archiveBanner.classList.add("inline-flex");
    if (dom.archiveBack) {
      dom.archiveBack.classList.remove("hidden");
      dom.archiveBack.classList.add("inline-flex");
    }
  };

  // Check if already solved
  const entry = loadHistory().find(h => h.date === date);
  if (entry) {
    let answer = entry.answer ?? null;
    // Old history entries may not have the answer stored — fetch it
    if (answer == null) {
      try {
        const res = await fetch(`/api/puzzle/${num}/solution`);
        if (res.ok) {
          const data = await res.json() as { answer: number };
          answer = data.answer;
        }
      } catch { /* leave as null */ }
    }
    gameState = { answer, guesses: [], solved: true, tries: entry.tries, puzzleNum: num, date };
    showCompletedState(entry.tries, date);
    showBanner();
    // ARC-02: pre-render completion view with activeDate so the back-link shape is correct
    // when the user reaches the completion screen via /archive/<date>. The renderCompletion
    // signature accepting opts ships in Plan 06 — this call site depends on that change.
    renderCompletion(num, entry.tries, false, { activeDate: date, todayLocal: todayLocal() });
    return;
  }

  gameState = { answer: null, guesses: [], solved: false, puzzleNum: num, date };
  resetPuzzleUI();
  showBanner();
  track("puzzle_start");

  // Save score for replays
  const prefs = loadPrefs();
  saveScore = prefs.saveScore;
  if (dom.saveCheck) dom.saveCheck.checked = saveScore;
  dom.again?.classList.add("hidden");
}

async function handleGuess() {
  if (gameState.solved || submitting) return;
  if (!possibles.every((s) => s.size === 1)) return;

  const guessStr = possibles.map((s) => [...s][0]).join("");
  const guess = Number(guessStr);
  const tries = gameState.guesses.length + 1;

  // Build request body
  const body: { guess: number; date?: string; token?: string } = { guess };
  if (gameState.token) {
    body.token = gameState.token;
  } else if (gameState.date) {
    body.date = gameState.date;
  } else {
    renderFeedback("error");
    return;
  }

  submitting = true;
  dom.submitBtn?.setAttribute("disabled", "true");

  try {
    const res = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      renderFeedback("error");
      return;
    }

    const result = await res.json() as { correct: boolean };

    if (result.correct) {
      gameState.solved = true;
      gameState.tries = tries;
      gameState.answer = guess; // now we know the answer (it was our correct guess)
      track("puzzle_complete", tries);
      renderFeedback("correct", guess);
      closeKeypad();
      // Apply correct state to all digit boxes
      for (let i = 0; i < 3; i++) {
        const el = document.querySelector(`[data-digit="${i}"]`) as HTMLElement | null;
        if (el) el.classList.add("bg-[rgba(46,139,87,0.12)]", "border-[rgba(46,139,87,0.4)]", "pointer-events-none");
      }
      dom.submitWrap?.classList.add("hidden");

      // Record game before rendering completion so loadHistory includes today's entry
      if (!gameState.isRandom && saveScore && gameState.date) {
        recordGame(gameState.date, tries, guess);
      }

      const isArchiveSolve = !!gameState.date && gameState.date !== todayLocal();

      if (isArchiveSolve) {
        // Archive solve stays on /archive/<date> the whole way — no /solved hop.
        // /solved is reserved for today's puzzle (overall stats live there).
        // Render the minimal solved-replay view inline.
        showCompletedState(tries, gameState.date);
      } else {
        // Today's solve: paint the completion screen and replace history (no /play
        // entry to back into; back from /solved goes to /welcome, which itself
        // redirects to /solved post-solve so the back lands on the same screen
        // — effectively making /solved the post-solve home).
        renderCompletion(gameState.puzzleNum ?? 0, tries, !!gameState.isRandom);
        // Fire sync — never inside celebrateOcto's callback. If celebration is
        // interrupted (page hidden, rAF paused) the user could otherwise be
        // stranded on /play with the puzzle solved (#solve-stranding).
        replaceRoute('/solved');
      }

      // Celebration is visual only (D-13: skip under reduced motion).
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        launchBubbles();
        celebrateOcto();
      }
    } else {
      gameState.guesses.push(guess);
      track("incorrect_guess");
      renderFeedback("incorrect");
      renderHistory(gameState.guesses);
      sadOcto();
      dom.submitWrap?.classList.add("hidden");
    }
  } catch {
    renderFeedback("error");
  } finally {
    submitting = false;
    dom.submitBtn?.removeAttribute("disabled");
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function loadPuzzle() {
  const isRandom = window.location.pathname === '/random';
  const endpoint = isRandom ? '/api/puzzle/random' : '/api/puzzle';

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json() as any;

    if (isRandom) {
      startRandomPuzzle(data.clues, data.token);
    } else {
      startDailyPuzzle(data.date, data.puzzleNumber, data.clues);
    }
  } catch {
    if (dom.clueList) {
      dom.clueList.removeAttribute("aria-busy");
      dom.clueList.innerHTML = '<p class="col-span-2 text-base text-text font-[Quicksand]">Could not load the puzzle. Please refresh the page.</p>';
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
dom.submitBtn?.addEventListener("click", () => { handleGuess(); });

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

// ─── Menu ────────────────────────────────────────────────────────────────────

function initMenu(): void {
  const menuBtn = document.querySelector('[data-menu-btn]') as HTMLButtonElement | null;
  const menu = document.querySelector('[data-menu]') as HTMLElement | null;
  if (!menuBtn || !menu) return;

  function openMenu(): void {
    menu!.classList.remove('hidden');
    menuBtn!.setAttribute('aria-expanded', 'true');
    (menu!.querySelector('button, a') as HTMLElement | null)?.focus();
  }

  function closeMenu(): void {
    menu!.classList.add('hidden');
    menuBtn!.setAttribute('aria-expanded', 'false');
    menuBtn!.focus();
  }

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu!.classList.contains('hidden')) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  document.querySelector('[data-menu-close]')?.addEventListener('click', closeMenu);

  document.addEventListener('click', (e) => {
    if (!menu!.contains(e.target as Node) && e.target !== menuBtn && !menu!.classList.contains('hidden')) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu!.classList.contains('hidden')) {
      closeMenu();
    }
  });

  // Dark mode toggle: initTheme() already binds toggleTheme() to [data-theme-toggle]

  // Menu item wiring: HTP link — modals.ts already binds the open handler via [data-htp-btn]
  // Just close the menu first; the existing listener handles opening the modal
  const menuHtpBtn = menu.querySelector('[data-htp-btn]');
  if (menuHtpBtn) {
    menuHtpBtn.addEventListener('click', () => {
      closeMenu();
    });
  }

  // Menu item wiring: feedback trigger — modals.ts already binds the open handler via [data-fb-btn]
  // Just close the menu first
  const menuFbBtn = menu.querySelector('[data-fb-btn]');
  if (menuFbBtn) {
    menuFbBtn.addEventListener('click', () => {
      closeMenu();
    });
  }
}


// ─── Init ─────────────────────────────────────────────────────────────────────

initTheme();
initColours();
initMenu();
initFeedbackModal(todayLocal, puzzleNumber, formatDate);

// Pre-render welcome content so navigate('/welcome') has something to show.
initWelcome();

// Pre-render completion content if today is already solved (SLV-02 parity).
const _todayHistoryAtBoot = todayEntry();
if (_todayHistoryAtBoot) {
  const _todayDate = todayLocal();
  const _num = puzzleNumber(_todayDate);
  renderCompletion(_num, _todayHistoryAtBoot.tries, false);
}

// Don't pre-paint a screen here — the router resolves location.pathname and
// calls showScreen() below. Pre-painting 'welcome' caused a flash on cold loads
// to /play (welcome appeared at opacity-100 before the router swapped to game).

// Bridge router-emitted analytics events to the existing track() helper.
document.addEventListener('analytics:track', (e) => {
  const detail = (e as CustomEvent).detail as { event: string; value?: number; source?: string };
  if (detail?.event) track(detail.event, detail.value, detail.source);
});

// Boot the router — sets scrollRestoration, registers popstate + visibility/focus,
// resolves location.pathname to the right screen, and handles cold-load redirects.
// /random is intentional (no router resolution — direct game screen with random puzzle).
// /puzzles/<n> is handled by the worker as a 302 to /archive/<date> so the client
// never sees it; no client-side handler needed.
const isRandomBoot = window.location.pathname === '/random';
if (isRandomBoot) {
  showScreen('game');
  loadPuzzle();
} else {
  initRouter({
    // hasData = user has played at least one puzzle. RTE-03 deep-link redirect:
    // a stranger sharing /play with someone who's never played should see /welcome.
    hasData: () => !!localStorage.getItem('dlng_history'),
    todayLocal,
    todayEntry,
    midInteraction: () => activeBox !== null || submitting,
    onArchiveDate: (date) => {
      // Convert date → puzzleNumber → /api/puzzle/:num and replay via startReplayPuzzle.
      const num = puzzleNumber(date);
      fetch(`/api/puzzle/${num}`)
        .then((r) => r.ok ? r.json() as Promise<{ date: string; puzzleNumber: number; clues: ClueData[] }> : Promise.reject(new Error('puzzle fetch failed')))
        .then((data) => startReplayPuzzle(data.date, data.puzzleNumber, data.clues))
        .catch(() => { renderFeedback('error'); });
    },
  });
  // Skip today's-puzzle fetch when cold-loading an archive replay — onArchiveDate
  // owns the puzzle fetch via startReplayPuzzle. Otherwise loadPuzzle() races and
  // overwrites the archived clues with today's.
  const isArchiveDateBoot = /^\/archive\/[^/]+$/.test(window.location.pathname);
  if (!isArchiveDateBoot) loadPuzzle();
}

// "Show puzzle" link on /solved → /play (today's solved-replay view).
// skipResolve bypasses the /play-with-todayEntry → /solved redirect.
// The screens:enter listener re-applies showCompletedState so /play renders
// the minimal solved-replay UI consistent with cold-load (when the redirect
// is bypassed).
document.addEventListener('completion:show-puzzle', () => {
  navigate('/play', { skipResolve: true });
});

// Re-apply solved-replay state every time the game screen becomes active.
// Two paths reach /play in solved mode without going through showCompletedState:
//   - Show puzzle from /solved (after a fresh solve in this session)
//   - history.back() from /solved
// Without this, /play would show the post-solve "Correct! That's puzzle #N"
// feedback or stale stats from earlier renders. Using showCompletedState keeps
// the message consistent with cold-load and archive replay paths.
document.addEventListener('screens:enter', (e) => {
  const screen = (e as CustomEvent).detail?.screen;
  if (screen !== 'game' || !gameState.solved || gameState.tries == null) return;
  const replayDate = gameState.date && gameState.date !== todayLocal() ? gameState.date : undefined;
  showCompletedState(gameState.tries, replayDate);
});

// "Show stats" link on /play (today's solved-replay) → /solved. Delegated because
// the link is written into dom.stats lazily by showCompletedState.
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-show-stats]');
  if (!target) return;
  e.preventDefault();
  navigate('/solved');
});


// ─── Analytics event listeners ───────────────────────────────────────────────

// HTP: route to welcome screen from menu so the back button works.
// skipResolve so users who already solved today still see HTP — resolver would otherwise redirect /welcome → /solved.
document.querySelector('[data-htp-btn]')?.addEventListener('click', () => { navigate('/welcome', { skipResolve: true }); track('htp_opened', undefined, 'manual'); });
// Header brand: tap toggles between play and HTP. On /play go to HTP (welcome). Anywhere else go to /play.
// skipResolve so already-solved users land on the solved-replay /play view (matches "Show puzzle" link).
document.querySelector('[data-brand]')?.addEventListener('click', () => {
  if (location.pathname === '/play') {
    navigate('/welcome', { skipResolve: true });
    track('htp_opened', undefined, 'brand');
  } else {
    navigate('/play', { skipResolve: true });
  }
});
// Feedback submitted
document.querySelector('[data-fb-send]')?.addEventListener('click', () => track('feedback_submitted'));
// Theme toggle
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => track('theme_toggle'));

// ─── Dev helpers (non-production only) ───────────────────────────────────────

window._devFillAnswer = async () => {
  try {
    const params = gameState.token ? `?token=${encodeURIComponent(gameState.token)}` : '';
    const res = await fetch(`/api/dev/answer${params}`);
    if (!res.ok) return;
    const { answer } = await res.json() as { answer: number };
    const digits = [Math.floor(answer / 100), Math.floor((answer % 100) / 10), answer % 10];
    digits.forEach((d, i) => { possibles[i] = new Set([d]); renderBox(i); });
    checkSubmit();
  } catch { /* dev only */ }
};
