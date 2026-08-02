// Clumeral — app.ts
// Puzzle data is fetched from the API. The answer never reaches the client.

import type { GameState, ClueData, ActiveState } from './types.ts';
import { launchBubbles } from './bubbles.ts';
import { loadPrefs, persistPrefs, loadHistory, recordGame, saveActive, loadActive, clearActive, hasPlayerData, saveUndo, loadUndo, clearUndo } from './storage.ts';
import { startingBoard, isStartingBoard, createHistory } from './undo-stack.ts';
import { matchShortcut, modifierLabel, isTypingTarget } from './shortcuts.ts';
import type { EntryKind } from './undo-stack.ts';
import { initTheme } from './theme.ts';
import { initColours } from './colours.ts';
import { initFeedbackModal } from './modals.ts';
import { celebrateOcto, sadOcto, bounceBrand } from './octo.ts';
import { isWalkthroughActive } from './walkthrough.ts';
import { showScreen, getCurrentScreen } from './screens.ts';
import { navigate, replaceRoute, initRouter } from './router.ts';
import { initWelcome } from './welcome.ts';
import { renderCompletion } from './completion.ts';
import { todayKey, puzzleNumberFor, formatDate } from './date.ts';

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
  archiveBanner: $('[data-archive-banner]') as HTMLElement | null,
  archiveBack: $('[data-archive-back]') as HTMLElement | null,
  archiveRow: $('[data-archive-row]') as HTMLElement | null,
  history: $('[data-history]') as HTMLElement | null,
  historyList: $('[data-history-list]') as HTMLElement | null,
  clueList: $('[data-clue-list]') as HTMLElement | null,
  boardControls: $('[data-board-controls]') as HTMLElement | null,
  undoBtn: $('[data-undo]') as HTMLButtonElement | null,
  resetBtn: $('[data-reset]') as HTMLButtonElement | null,
  undoMsg: $('[data-undo-msg]') as HTMLElement | null,
  undoLabel: $('[data-undo-label]') as HTMLElement | null,
  undoKey: $('[data-undo-key]') as HTMLElement | null,
  resetKey: $('[data-reset-key]') as HTMLElement | null,
  // Queried by data-*, like everything else here. The elements also carry ids,
  // which aria-describedby needs as IDREF targets — see CONVENTIONS.md.
  undoDesc: $('[data-undo-desc]') as HTMLElement | null,
  resetDesc: $('[data-reset-desc]') as HTMLElement | null,
};

// ─── Module state ─────────────────────────────────────────────────────────────

let gameState: GameState = { answer: null, guesses: [], solved: false };
let saveScore = true;
let submitting = false; // guard against double-submit during API call

let possibles: Set<number>[] = startingBoard();
let activeBox: number | null = null; // 0 | 1 | 2 | null

// Undo stack for the digit boxes (#251). Mirrored into sessionStorage after
// every change so a mis-tapped Reset followed by a refresh is still recoverable.
const boardHistory = createHistory();

// Which puzzle the stored stack belongs to. The entries hold whole boards, so
// restoring one puzzle's stack onto another's board would corrupt it — random
// puzzles key on their token because they have no date.
function undoScope(): string {
  if (gameState.isRandom) return `random:${gameState.token ?? 'none'}`;
  return `date:${gameState.date ?? todayKey()}`;
}

// The stack is only ever read back on the mid-game restore path, which is
// today's daily puzzle only — loadActive's date guard means an archive board
// never restores, and /random mints a fresh token per load. Writing outside that
// case would be ~8KB of synchronous sessionStorage per tap, discarded unread.
function undoIsRestorable(): boolean {
  return !gameState.isRandom && gameState.date === todayKey();
}

// The board the stack describes, saved with it so a stack written in another tab
// can be told apart from this one's. See loadUndo.
function boardDigits(): number[][] {
  return possibles.map((s) => [...s]);
}

// MUST be called AFTER the board has been mutated, never before. The stored
// fingerprint has to describe the same board that saveActive writes to
// dlng_active, or loadUndo's board check rejects the stack on every reload and
// the persistence is silently dead.
function persistHistory(): void {
  if (undoIsRestorable()) saveUndo(undoScope(), boardHistory.toJSON(), boardDigits());
}

// Snapshots the board as it stands BEFORE the caller changes it. Deliberately
// does not persist: the caller does that once the change has landed.
function pushHistory(kind: EntryKind = 'toggle'): void {
  boardHistory.push(possibles, kind);
}

function clearHistory(): void {
  boardHistory.clear();
  clearUndo();
}

// ─── Storage helper (uses todayKey from date.ts) ─────────────────────────────

function todayEntry() {
  const today = todayKey();
  return loadHistory().find((h) => h.date === today) || null;
}

// Snapshot current board state for mid-game persistence (D-06). Date uses gameState.date
// (the local puzzle date) so the stale-date guard in loadActive discards yesterday's state.
function buildActiveState(): ActiveState {
  return {
    v: 1,
    date: gameState.date ?? todayKey(),
    possibles: possibles.map((s) => [...s]),
    guesses: [...gameState.guesses],
    activeBox,
    feedbackKey: null,
  };
}

// Persist the starting board the moment the player is actually on /play, so a
// refresh before they have touched anything still resumes the game rather than
// dropping them on /welcome (#284). Without this, dlng_active is only written on
// the first tap, and "tap Play, refresh" looks exactly like the bug it fixes.
//
// Every guard here earns its place:
//   - pathname: startDailyPuzzle also runs while /welcome is on screen (the boot
//     fetch renders clues into the hidden game screen), and writing there would
//     hand the RTE-03 deep-link gate a false positive for someone who never played.
//   - solved/random/date: only today's live daily board is restorable at all.
//   - loadActive(): never overwrite an existing draft. On cold load this can run
//     before the restore path has read it, and a starting board written over real
//     progress is the very thing dlng_active exists to prevent.
function markPuzzleStarted(): void {
  if (location.pathname !== '/play') return;
  if (gameState.isRandom || gameState.solved) return;
  if (gameState.date !== todayKey()) return;
  if (loadActive() !== null) return;
  saveActive(buildActiveState());
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
  if (propKey.includes("IsFib"))        return "FIB";
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
  SQUARE: "Result of a number multiplied by itself",
  CUBE: "Result of a number multiplied by itself, twice",
  TRIAN: "Sum of consecutive numbers from 0",
  FIB: "Each number is the two before it added together, starting with 0 and 1",
  SUM: "Numbers added together",
  DIFF: "Smaller of the numbers subtracted from larger",
  PROD: "Numbers multiplied together",
  MEAN: "Sum of numbers divided by how many numbers",
  RANGE: "Largest number minus the smallest",
};

function showTip(message: string, anchor: HTMLElement): void {
  closeTagTip();
  track("tooltip_opened");

  const popover = document.createElement("div");
  popover.className = "absolute left-0 bottom-full mb-2 min-w-[18rem] p-3 bg-surface rounded-md z-50";
  popover.setAttribute("role", "tooltip");
  popover.setAttribute("data-tag-tip", "");
  popover.innerHTML = `
    <button class="absolute top-1.5 right-1.5 p-0.5 rounded border border-border text-text hover:text-text" type="button" aria-label="Close">
      <svg width="14" height="14" class="stroke-[2]"><use href="/sprites.svg#icon-circle-x"/></svg>
    </button>
    <p class="text-base text-text leading-snug pr-6 font-[Quicksand]">${message}</p>
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

function showTagTip(tag: string, anchor: HTMLElement): void {
  const tip = TAG_TIPS[tag];
  if (!tip) return;
  showTip(tip, anchor);
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
    // #228: players read a clue as being about each box's value ("the first box
    // is not a prime number → remove primes from the first box"), so display
    // "box"/"boxes" in the clue text. Labels are frozen per puzzle in KV, so we
    // transform at render time to cover old and new puzzles uniformly. The (i)
    // tag definitions (TAG_TIPS) use "numbers" — an abstract definition of the
    // maths, not tied to boxes. "digit" is now fully gone from player copy.
    const boxLabel = label.replace(/\bdigits\b/g, "boxes").replace(/\bdigit\b/g, "box");
    const lit = digitPositions(propKey);
    const miniDigitsHtml = lit.map((on) =>
      `<span class="w-[1.375rem] h-[1.375rem] rounded-[1px] border ${on ? 'border-accent bg-accent/50' : 'border-accent bg-accent/5'}"></span>`
    ).join("");

    let leadText: string;
    let emphHtml: string;
    if (typeof value === "boolean") {
      const isAffirmative = operator === "=" ? value : !value;
      const idx = boxLabel.indexOf(" is ");
      const subject = boxLabel.slice(0, idx);
      const predicate = boxLabel.slice(idx + 4);
      leadText = subject + " is";
      emphHtml = (isAffirmative ? "" : "not ") + predicate;
    } else {
      leadText = operator === "=" ? boxLabel.replace(/\s+is$/, "") : boxLabel;
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
      dom.feedback.className = "flex items-center gap-2 text-base font-bold leading-snug mt-4 text-success font-[Quicksand]";
    }
  } else if (type === "incorrect") {
    if (dom.feedback) {
      dom.feedback.innerHTML = `${ICON_CROSS} Not quite — try again.`;
      dom.feedback.className = "flex items-center gap-2 text-base font-bold leading-snug mt-4 text-error font-[Quicksand]";
    }
  } else if (type === "error") {
    if (dom.feedback) {
      dom.feedback.innerHTML = `${ICON_CROSS} Something went wrong — please try again.`;
      dom.feedback.className = "flex items-center gap-2 text-base font-bold leading-snug mt-4 text-error font-[Quicksand]";
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
  el.classList.toggle("shadow-box-active", i === activeBox);
  // Restore default border+shadow when not active. shadow-box derives from
  // --color-text via color-mix, so it stays visible against the dark page
  // background without a separate dark variant.
  el.classList.toggle("border-border", i !== activeBox);
  el.classList.toggle("shadow-box", i !== activeBox);

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
  // Tear down any open tip (e.g. the hundreds-box 0 explainer, which is anchored
  // INTO the keypad grid) before wiping innerHTML — otherwise the popover element
  // is removed mid-flight and its document listeners never run _cleanup (leak).
  closeTagTip();
  dom.keypad.innerHTML = "";
  for (const d of digits) {
    const btn = document.createElement("button");
    btn.type = "button";
    const disabled = activeBox === 0 && d === 0;
    const elim = disabled || !possibles[activeBox].has(d);
    // .key-face carries the surface, border and tap-offset shared with the
    // undo/reset controls above the boxes (see tailwind.css).
    // Struck through as well as faded, matching the digit boxes. .is-elim is a
    // CSS class rather than utilities so it outranks .key-face on specificity
    // instead of relying on source order.
    btn.className = `key-face h-12 font-mono text-lg font-normal${elim ? ' is-elim' : ''}`;
    btn.textContent = String(d);
    btn.setAttribute("data-key", String(d));
    btn.setAttribute("aria-label", `Toggle number ${d}`);
    // aria-pressed marks player-eliminated digits (a toggle state). The hundreds-box
    // 0 is not a toggle — it's an explainer — so it must not claim a pressed state.
    if (elim && !disabled) btn.setAttribute("aria-pressed", "true");
    if (disabled) {
      // Hundreds-box 0: keep focusable/tappable (not native disabled) so it can
      // explain why the first digit can't be 0.
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("aria-label", "0 unavailable — the first box can't be 0");
      btn.addEventListener("click", () =>
        showTip("The number is 100–999, so the first box can't be 0.", btn)
      );
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
    // Snapshot AFTER the guard: a blocked toggle changes nothing, and pushing
    // here would leave a no-op on the stack that makes one Undo press look dead.
    pushHistory();
    s.delete(digit);
    // First-play walkthrough hook (issue #214). Fires only on elimination.
    // INERT while the walkthrough is disabled (#294) — nothing listens today. Kept
    // because its replacement will almost certainly want the same two gates.
    document.dispatchEvent(new CustomEvent("game:digit-eliminated"));
  } else {
    pushHistory();
    s.add(digit);
  }
  // Back to playing, so the reset announcement has served its purpose. The
  // visible label follows the stack, so it needs no clearing here.
  announceReset(false);
  // Save mid-game state after every digit mutation — daily only (D-06, D-08).
  // Payload is tiny so no debounce needed (Pitfall 5). The undo stack is saved
  // alongside it so the two always describe the same board.
  if (!gameState.isRandom) saveActive(buildActiveState());
  persistHistory();
  renderBox(activeBox);
  buildKeypad();
  renderBoardControls();
  checkSubmit();
}

// ─── Undo / Reset controls (#251) ────────────────────────────────────────────

// Screen-reader announcements for the board controls. Driven by text content,
// not display:none — a live region toggled in and out of the layout is
// unreliably announced (VoiceOver in particular often stays silent).
let announceTimer: number | undefined;
let lastAnnounced = "";

function announce(message: string): void {
  if (!dom.undoMsg) return;
  clearTimeout(announceTimer);
  // Clearing is not an announcement, so it never needs the repeat dance below —
  // and it happens on every digit tap, which would otherwise queue a timer per tap.
  if (message === "") {
    dom.undoMsg.textContent = "";
    lastAnnounced = "";
    return;
  }
  if (message !== lastAnnounced) {
    // Normal path — a changed message IS re-announced, so write it synchronously.
    // Every pre-existing call site takes this branch, unchanged.
    dom.undoMsg.textContent = message;
    lastAnnounced = message;
    return;
  }
  // Repeat path: two consecutive undos produce identical text, and a polite
  // region whose content does not change is not re-announced at all. Clear now,
  // rewrite after a beat, so the second undo is audible. 100ms is under the
  // polite-region settle time and well above a microtask, which AT coalesces away.
  dom.undoMsg.textContent = "";
  announceTimer = window.setTimeout(() => { dom.undoMsg!.textContent = message; }, 100);
}

// Reset's own announcement. The visible cue is the Undo button's label, but a
// sighted-only cue would leave the one signal that Reset is recoverable
// unannounced. Signature and wording unchanged, so its six call sites are too.
function announceReset(on: boolean): void {
  announce(on ? "Board reset. Undo reset available." : "");
}

// Undo and Reset don't share a condition. Straight after a Reset the board IS
// the starting board, so Reset disables itself while Undo stays live to unwind it.
function renderBoardControls(): void {
  // Hidden wholesale on a solved puzzle — a solve must not be unwound back into play.
  const hide = gameState.solved;
  dom.boardControls?.classList.toggle("hidden", hide);
  dom.boardControls?.classList.toggle("flex", !hide);
  // Unavailable as well as hidden when solved. A solved board isn't the starting
  // board, so Reset's own rule would otherwise leave it live.
  setUnavailable(dom.undoBtn, hide || !boardHistory.canUndo());
  setUnavailable(dom.resetBtn, hide || isStartingBoard(possibles));

  // The label tracks the top of the stack rather than a one-shot "just reset"
  // flag, so it comes BACK to "Undo reset" if the player toggles after a reset
  // and then steps back down onto the reset entry again.
  const undoingReset = boardHistory.nextKind() === 'reset';
  if (dom.undoLabel) dom.undoLabel.textContent = undoingReset ? "Undo reset" : "Undo";
  // Set outside the label guard: the accessible name must not depend on the
  // visible span still existing.
  dom.undoBtn?.setAttribute("aria-label", undoingReset ? "Undo reset" : "Undo last change");
}

// aria-disabled, NOT the native disabled attribute. Both controls can become
// unavailable as a direct result of being pressed, and the browser blurs a
// natively-disabled element — so a keyboard or screen-reader user was thrown back
// to the top of the document at exactly the moment Reset had cleared their board.
// aria-disabled announces the state and greys the control while leaving it
// focusable, so the user keeps their place and moves focus themselves. Same
// pattern the keypad already uses for the hundreds-box 0.
//
// Safe because both handlers no-op when there's nothing to do: undoLast returns
// on an empty stack, resetBoard on an already-starting board.
function setUnavailable(btn: HTMLButtonElement | null, unavailable: boolean): void {
  if (!btn) return;
  if (unavailable) btn.setAttribute("aria-disabled", "true");
  else btn.removeAttribute("aria-disabled");
}

// Applies a board restored from the history stack. Shared by Undo and Reset so
// the save/render/re-check sequence can't drift between them.
function applyBoard(next: Set<number>[]): void {
  possibles = next;
  renderFeedback(null);
  if (!gameState.isRandom) saveActive(buildActiveState());
  persistHistory();
  renderAllBoxes();
  buildKeypad();
  renderBoardControls();
  checkSubmit();
}

// Returns the kind of change stepped back over, or null if nothing happened.
// Callers need to tell the two apart: the keyboard path announces "Undone." or
// "Undo reset." for a real step and "Nothing to undo." for a dead press, and
// neither route should log an analytics event for a press that did nothing.
//
// Deliberately does NOT announce. The clear moves out to the callers so the
// keyboard path can write its own message instead of having it wiped.
function undoLast(): EntryKind | null {
  if (gameState.solved) return null;
  const kind = boardHistory.nextKind();   // read BEFORE the pop
  const previous = boardHistory.undo();
  if (previous === null) return null;
  applyBoard(previous);   // persists the popped stack against the restored board
  // Non-null whenever undo() was: nextKind() and undo() share the empty-stack guard.
  return kind;
}

// Returns true if the board was actually reset.
function resetBoard(): boolean {
  if (gameState.solved || isStartingBoard(possibles)) return false;
  // One entry, tagged so the Undo control can label itself "Undo reset". A
  // single press restores the whole pre-reset board.
  pushHistory('reset');
  applyBoard(startingBoard());
  announceReset(true);
  return true;
}

// ─── Keyboard shortcut hint ──────────────────────────────────────────────────

// Platform is read ONCE at load. userAgentData.platform is preferred where the
// browser has it; navigator.platform is the fallback; anything inconclusive gets
// Ctrl. iPadOS reporting "Macintosh" is harmless — an iPad keyboard has a Command
// key, and matchShortcut accepts either modifier on either platform anyway, so a
// wrong guess is only ever cosmetic.
const MODIFIER = modifierLabel(
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    ?? navigator.platform,
);
const SPOKEN = MODIFIER === 'Cmd' ? 'Command' : 'Control';

let keyboardSeen = false;

// Fills in the shortcut hints and reveals them. Not a live region and never
// announces itself — it is static description reached via aria-describedby.
function showKeyboardHint(): void {
  if (keyboardSeen) return;
  keyboardSeen = true;
  if (dom.undoKey) dom.undoKey.textContent = `${MODIFIER} + Z`;
  if (dom.resetKey) dom.resetKey.textContent = `${MODIFIER} + X`;
  if (dom.undoDesc) dom.undoDesc.textContent = `Keyboard shortcut: ${SPOKEN} Z`;
  if (dom.resetDesc) dom.resetDesc.textContent = `Keyboard shortcut: ${SPOKEN} X`;
  document.documentElement.setAttribute('data-keyboard', 'true');
}

// Two triggers, either one is enough. A pure-touch player never sees the hint;
// a desktop player sees it before first paint, so never sees the transition; a
// hybrid player (iPad with a Magic Keyboard, where the pointer test fails) gets
// it as soon as they use the keyboard on the board.
if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) showKeyboardHint();

// A keydown only counts as evidence of a physical keyboard when it did NOT come
// from a text field. On iOS the on-screen keyboard cannot appear unless one is
// focused, so a keypress anywhere else means real keys — while typing feedback
// on an iPhone, which used to reveal a hint for shortcuts that phone can never
// send, now proves nothing.
//
// Any key qualifies rather than a hand-picked list: Tab, a digit, an arrow and
// Escape are all real board bindings, and enumerating them would be a list to
// keep in step with the keydown handler for no benefit.
//
// Not `once`, because the first keydown of a page session is often a character
// typed into feedback; the listener has to survive that and keep watching. It
// removes itself the moment it fires for real.
//
// Deliberately separate from the game's own keydown handler, which returns early
// on a solved board — a solved-board player pressing keys still has a keyboard.
function detectKeyboard(e: KeyboardEvent): void {
  if (isTypingTarget(e.target)) return;
  showKeyboardHint();
  document.removeEventListener('keydown', detectKeyboard, true);
}
document.addEventListener('keydown', detectKeyboard, { capture: true });

function openBox(i: number): void {
  activeBox = i;
  // Save active-box selection — daily only (D-06, D-08). Lets restore re-open the right box.
  if (!gameState.isRandom) saveActive(buildActiveState());
  renderAllBoxes();
  buildKeypad();
  openKeypad();
  // First-play walkthrough hook (issue #214).
  // INERT while the walkthrough is disabled (#294) — see the note on the sibling
  // game:digit-eliminated dispatch.
  document.dispatchEvent(new CustomEvent("game:box-opened"));
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
  // Once every box is resolved, close the keypad so the submit button isn't pushed off-screen.
  if (allResolved && activeBox !== null) closeKeypad();
}

// ─── Game ─────────────────────────────────────────────────────────────────────

function showCompletedState(tries: number, replayDate?: string): void {
  // /play in solved-replay mode is the same minimal view for today and archive:
  // clues + revealed digits + "Solved in N tries!" + a context-specific link.
  // Stats panel never appears here — it lives on /solved.
  // Finalised: the keypad is no longer usable, so hide it (issue #194).
  closeKeypad();
  const t = tries === 1 ? "1 try" : `${tries} tries`;
  if (dom.feedback) {
    dom.feedback.innerHTML = `${ICON_CHECK} Solved in ${t}!`;
    dom.feedback.className = "flex items-center gap-2 text-base font-bold leading-snug mt-4 text-success font-[Quicksand]";
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
      el.classList.add("bg-success/12", "border-success/40", "pointer-events-none");
    }
  }
  dom.submitWrap?.classList.add("hidden");
  dom.history?.classList.add("hidden");
  // Solved: nothing left to unwind. Clear as well as hide, so a later /random
  // or archive puzzle on the same SPA session can't inherit a stale stack.
  clearHistory();
  announceReset(false);
  renderBoardControls();

  // Archive row visibility tied to replayDate so a daily /play view never inherits archive chrome.
  if (dom.archiveRow) {
    dom.archiveRow.classList.toggle("hidden", !replayDate);
    dom.archiveRow.classList.toggle("flex", !!replayDate);
  }

  if (dom.stats) {
    // Archive solved: solid Archive button returns to list; Latest opens today's puzzle.
    // Today's solved-replay: hollow Stats button deep-links to /solved.
    const linksHtml = replayDate
      ? `<div class="mt-4 flex gap-2"><a href="/archive" class="btn btn-solid flex-1"><svg aria-hidden="true"><use href="/sprites.svg#icon-archive"/></svg>Archive</a><a href="/play" class="btn btn-hollow flex-1"><svg aria-hidden="true"><use href="/sprites.svg#icon-calendar"/></svg>Today</a></div>`
      : `<div class="mt-4 flex gap-2"><a href="/solved" data-show-stats class="btn btn-hollow flex-1"><svg aria-hidden="true"><use href="/sprites.svg#icon-stats"/></svg>Show stats</a><a href="/archive" class="btn btn-hollow flex-1"><svg aria-hidden="true"><use href="/sprites.svg#icon-archive"/></svg>Archive</a></div>`;
    dom.stats.innerHTML = linksHtml;
    dom.stats.classList.remove("hidden");
  }
}

function resetPuzzleUI() {
  renderFeedback(null);
  renderHistory([]);
  dom.stats?.classList.add("hidden");
  // Hide archive row by default; startReplayPuzzle re-enables it for dated replays.
  if (dom.archiveRow) {
    dom.archiveRow.classList.add("hidden");
    dom.archiveRow.classList.remove("flex");
  }
  if (dom.archiveBanner) dom.archiveBanner.innerHTML = "";
  // Remove correct state from digit boxes
  for (let i = 0; i < 3; i++) {
    const el = document.querySelector(`[data-digit="${i}"]`) as HTMLElement | null;
    if (el) {
      el.classList.remove("bg-success/12", "border-success/40", "pointer-events-none");
    }
  }
  possibles = startingBoard();
  clearHistory();
  announceReset(false);
  renderAllBoxes();
  renderBoardControls();
  closeKeypad();
  checkSubmit();
}

function startRandomPuzzle(clues: ClueData[], token: string): void {
  renderClues(clues);

  gameState = { answer: null, guesses: [], solved: false, isRandom: true, token };
  resetPuzzleUI();
  track("puzzle_start");
}

function startDailyPuzzle(date: string, num: number, clues: ClueData[]): void {
  renderClues(clues); // clues in DOM first — restore renderers need digit boxes to exist (Pitfall 2)

  const entry = todayEntry();
  if (entry) {
    gameState = { answer: entry.answer ?? null, guesses: [], solved: true, tries: entry.tries, puzzleNum: num, date };
    showCompletedState(entry.tries);
    return;
  }

  // Attempt to restore a mid-game board from the previous session (D-06).
  // loadActive returns null if missing, stale, or invalid — Pitfall 4: no re-check needed here.
  const draft = loadActive();
  if (draft !== null) {
    gameState = { answer: null, guesses: draft.guesses, solved: false, puzzleNum: num, date };
    // Rebuild possibles from the stored arrays (Array → Set per box).
    possibles = draft.possibles.map((arr) => new Set(arr));
    // Restore the undo stack alongside the board (#251). gameState is already
    // assigned above, so undoScope() reads the right date. loadUndo returns null
    // for a missing, forged or wrong-puzzle payload, in which case the stack
    // simply starts empty and Undo stays disabled.
    const storedUndo = loadUndo(undoScope(), draft.possibles);
    if (storedUndo) boardHistory.load(storedUndo);
    else clearHistory();
    announceReset(false);
    // Reuse idempotent renderers — no new DOM logic (Pitfall 2: boxes are in DOM from renderClues above).
    renderAllBoxes();
    renderBoardControls();
    renderHistory(gameState.guesses);
    if (draft.activeBox !== null) openBox(draft.activeBox);
    if (draft.feedbackKey === 'incorrect') renderFeedback('incorrect');

    const prefs = loadPrefs();
    saveScore = prefs.saveScore;
    if (dom.saveCheck) dom.saveCheck.checked = saveScore;
    return; // skip fresh-start path
  }

  gameState = { answer: null, guesses: [], solved: false, puzzleNum: num, date };
  resetPuzzleUI();
  track("puzzle_start");
  // After resetPuzzleUI, so the marker describes the starting board (#284). Covers
  // the player who reached /play before this fetch resolved; the screens:enter
  // listener covers the commoner case of pressing Play once it already has.
  markPuzzleStarted();

  const prefs = loadPrefs();
  saveScore = prefs.saveScore;
  if (dom.saveCheck) dom.saveCheck.checked = saveScore;
}

async function startReplayPuzzle(date: string, num: number, clues: ClueData[]): Promise<void> {
  renderClues(clues);
  const showBanner = () => {
    if (dom.archiveBanner) dom.archiveBanner.textContent = `Archived puzzle · #${num} · ${formatDate(date)}`;
    if (dom.archiveRow) {
      dom.archiveRow.classList.remove("hidden");
      dom.archiveRow.classList.add("flex");
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
    renderCompletion(num, entry.tries, false, { activeDate: date, todayLocal: todayKey() });
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
        if (el) el.classList.add("bg-success/12", "border-success/40", "pointer-events-none");
      }
      dom.submitWrap?.classList.add("hidden");
      // Hide undo/reset here too: only the archive branch below reaches
      // showCompletedState, the other two navigate away instead (#251).
      clearHistory();
      announceReset(false);
      renderBoardControls();

      // Record game before rendering completion so loadHistory includes today's entry.
      // Always record daily solves so a reload can detect "already solved today" even when
      // saveScore is off (WR-02). Include the answer only when saveScore is on — that way
      // the history entry exists (prevents re-solving) but the answer is omitted when the
      // player has opted out of saving stats. Random puzzles are never written to history.
      // Tag archive solves (date != today) so computeStats can exclude them from daily
      // stats while still recording them (archive replay + the archive Tries column read
      // dlng_history by date). Computed BEFORE recordGame so it can be passed as the flag.
      const isArchiveSolve = !!gameState.date && gameState.date !== todayKey();

      if (!gameState.isRandom && gameState.date) {
        recordGame(gameState.date, tries, saveScore ? guess : undefined, isArchiveSolve);
      }
      // Clear mid-game state on solve — solve is terminal, no need to restore (D-07).
      clearActive();

      if (isArchiveSolve) {
        // Archive solve stays on /archive/<date> the whole way — no /solved hop.
        // /solved is reserved for today's puzzle (overall stats live there).
        // Render the minimal solved-replay view inline.
        showCompletedState(tries, gameState.date);
      } else if (gameState.isRandom) {
        // /random boots without initRouter (app.ts boot shows the game screen
        // directly), so the router has no deps and replaceRoute('/solved') would
        // throw `router not initialized`. Random has no /solved URL anyway — show
        // the completion screen directly.
        renderCompletion(gameState.puzzleNum ?? 0, tries, true);
        showScreen('completion');
      } else {
        // Today's solve: paint the completion screen and replace history (no /play
        // entry to back into; back from /solved goes to /welcome, which itself
        // redirects to /solved post-solve so the back lands on the same screen
        // — effectively making /solved the post-solve home).
        renderCompletion(gameState.puzzleNum ?? 0, tries, false);
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
      // Save after push so guesses array includes this wrong guess in the restore (D-06, D-08).
      if (!gameState.isRandom) {
        const snap = buildActiveState();
        snap.feedbackKey = 'incorrect';
        saveActive(snap);
      }
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
  // Send the browser-LOCAL date so the worker serves the puzzle for the player's
  // local day, not UTC today. This keeps the served puzzle, recordGame, and
  // todayEntry all keyed on the same date (todayKey) — without it, a UTC+offset
  // player in the local/UTC-midnight window gets a mismatched day (the
  // not-completed / stats-bounce / streak-reset bugs).
  const endpoint = isRandom ? '/api/puzzle/random' : `/api/puzzle?date=${encodeURIComponent(todayKey())}`;

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
  // updateViaCache: 'none' makes the browser bypass the HTTP cache when checking
  // /sw.js for updates, so a new deploy is picked up on the next navigation
  // instead of waiting up to 24h for the cached SW script to expire.
  // Was this page already controlled by an SW when it loaded? On a first-ever
  // visit it is not. The SW posts SW_UPDATED from its activate handler on *every*
  // first activation (install → skipWaiting → claim → notify), so without this
  // guard the first-ever load reloads itself the moment the SW claims it — a
  // spurious reload for real users, and one that races axe/navigation in e2e
  // (the freshly-claimed page navigates mid-test → "execution context destroyed").
  // Only a genuine update — a page that already had a controller — should reload.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'SW_UPDATED' && hadController) window.location.reload();
  });
  // Force an update check whenever the page regains focus — covers PWAs and
  // long-lived tabs where navigation alone wouldn't trigger one.
  const checkForUpdate = () => navigator.serviceWorker.getRegistration().then(r => r?.update());
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
}

// ─── Event listeners (module-level) ───────────────────────────────────────────

// Digit box clicks
for (let i = 0; i < 3; i++) {
  const box = document.querySelector(`[data-digit="${i}"]`) as HTMLElement | null;
  if (box) box.addEventListener("click", ((idx) => () => selectBox(idx))(i));
}

// Submit button
dom.submitBtn?.addEventListener("click", () => { handleGuess(); });

// Undo / Reset (#251). These are marked aria-disabled rather than natively
// disabled, so a press still reaches the handler when the control is unavailable.
// Both handlers re-derive live state and return early, which is what makes that
// safe — see setUnavailable.
// A click that acted clears any stale reset message and says nothing new: focus
// is already on the button and the action is self-evident. Only the keyboard
// path announces what it did.
// Both routes are tracked, not just the keyboard — a keyboard-only count is a
// number with no denominator. A press that did nothing sends no event.
dom.undoBtn?.addEventListener("click", () => {
  if (undoLast()) { announceReset(false); track("undo_used", undefined, "button"); }
});
dom.resetBtn?.addEventListener("click", () => {
  if (resetBoard()) track("reset_used", undefined, "button");
});

// Save checkbox
if (dom.saveCheck) {
  dom.saveCheck.addEventListener("change", () => {
    saveScore = dom.saveCheck!.checked;
    persistPrefs(saveScore);
  });
}

// The native `open` property, NEVER the `.open` class: modals.ts removes that
// class before the dialog actually closes on transitionend, so a class check
// reports "closed" while the dialog is still up with focus inside it.
//
// How to Play is not listed here — it navigates to /welcome, so it is a screen
// and the getCurrentScreen() gate already covers it.
function isOverlayOpen(): boolean {
  const fb = document.querySelector('[data-fb-modal]') as HTMLDialogElement | null;
  if (fb?.open) return true;
  const menu = document.querySelector('[data-menu]');
  return !!menu && !menu.classList.contains('hidden');
}

// Item 59: a shortcut never moves focus. A board change can take the focused
// element out from under the player in two different ways —
//   - buildKeypad() wipes innerHTML and rebuilds all ten keys, so a focused key
//     is a different element afterwards;
//   - un-resolving the board hides [data-submit-wrap], and the save-score
//     checkbox goes display:none with it (see tailwind.css) — which is reachable
//     precisely when a player most wants an undo.
// Both land focus on <body>. Try to put it back where it was, then check whether
// that actually took: .focus() on a display:none element silently no-ops, so the
// result has to be read rather than assumed.
function restoreFocusAfterBoardChange(key: string | null): void {
  if (key !== null) {
    (document.querySelector(`[data-key="${key}"]`) as HTMLElement | null)?.focus();
  }
  if (document.activeElement !== document.body && document.activeElement !== null) return;
  // Focus was lost. Undo is always present on the game screen and is aria-disabled
  // rather than disabled, so it stays focusable even with nothing left to undo.
  dom.undoBtn?.focus();
}

// Keyboard: Ctrl/Cmd+Z undoes and Ctrl/Cmd+X resets; digit keys toggle active box;
// Tab/arrows navigate; Enter submits; Escape closes
document.addEventListener("keydown", (e) => {
  if (gameState.solved) return;

  // First, where a reader expects a modifier branch and where it is robust to
  // the digit branch changing. The solved guard above is also what makes a
  // shortcut on a solved board free: it never reaches here, so there is nothing
  // to announce and no second guard to keep in step.
  const action = matchShortcut(e);
  if (action) {
    if (getCurrentScreen() !== 'game') return;
    if (isTypingTarget(e.target)) return;
    if (isOverlayOpen()) return;
    // Always false today — the walkthrough is disabled (#294) precisely because
    // this guard, plus its indefinite gated steps, left first-time players with
    // no shortcuts at all. Kept for its replacement, which will want it: an undo
    // landing mid-step desyncs a tutorial narrating real board actions. Whatever
    // replaces it must end, or this is a trap all over again.
    if (isWalkthroughActive()) return;

    // AFTER every guard, never before — a shortcut that eats Cut inside a
    // textarea is a bug, not a feature.
    e.preventDefault();

    // Note which keypad key had focus, if any, so it can be restored after the
    // board changes under it. e.target IS the focused element on a keydown, so no
    // activeElement read is needed here. See restoreFocusAfterBoardChange.
    const focusedKey = (e.target as HTMLElement | null)?.closest?.('[data-key]')
      ?.getAttribute('data-key') ?? null;

    // Holding the key unwinds repeatedly until the stack is empty, the same as a
    // native undo. e.repeat suppresses only the announcement and the analytics
    // event, never the action: otherwise a one-second hold writes to a polite
    // region at the OS repeat rate and posts thirty identical rows.
    if (action === 'undo') {
      const kind = undoLast();
      // Silence on a keypress is indistinguishable from a broken key, so a dead
      // press says so rather than saying nothing.
      if (!kind) { if (!e.repeat) announce("Nothing to undo."); return; }
      if (!e.repeat) {
        announce(kind === 'reset' ? "Undo reset." : "Undone.");
        track("undo_used", undefined, "keyboard");
      }
    } else {
      if (!resetBoard()) { if (!e.repeat) announce("Board is already clear."); return; }
      if (!e.repeat) track("reset_used", undefined, "keyboard");
    }
    // Only on a press that actually acted — the dead-press paths above return
    // early, and nothing was rebuilt or hidden for them.
    restoreFocusAfterBoardChange(focusedKey);
    return;
  }

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

  // Enter submits a fully-resolved board — but not when the focus is on Undo or
  // Reset. This listener is on document, and preventDefault() during bubbling
  // still cancels a button's activation, so without this guard a keyboard player
  // who tabs to Undo on a resolved board and presses Enter burns a try instead
  // of undoing (#251).
  const onBoardControl = (e.target as HTMLElement | null)?.closest?.("[data-board-controls]");
  if (e.key === "Enter" && !onBoardControl && possibles.every((s) => s.size === 1)) {
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

  // Archive is a plain anchor — a full document load, not a client-side route.
  // Closing the menu is belt-and-braces for the back-navigation case; the
  // current document is about to be replaced either way.
  menu.querySelector('[data-menu-archive]')?.addEventListener('click', closeMenu);

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
initFeedbackModal(todayKey, puzzleNumberFor, formatDate);

// Pre-render welcome content so navigate('/welcome') has something to show.
initWelcome();

// Pre-render completion content if today is already solved (SLV-02 parity).
const _todayHistoryAtBoot = todayEntry();
if (_todayHistoryAtBoot) {
  const _todayDate = todayKey();
  const _num = puzzleNumberFor(_todayDate);
  renderCompletion(_num, _todayHistoryAtBoot.tries, false);
}

// Don't pre-paint a screen here — the router resolves location.pathname and
// calls showScreen() below. Pre-painting 'welcome' caused a flash on cold loads
// to /play (welcome appeared at opacity-100 before the router swapped to game).

// Bridge router-emitted analytics events to the existing track() helper.
// Also use route_change as a sync point for archive chrome visibility.
// The row is hidden only when the current puzzle is NOT an archive puzzle — anchored to
// gameState.date so URL/state divergence (e.g. brand navigate rewriting the URL while the
// archive game screen stays active) can never incorrectly hide the row mid-session.
document.addEventListener('analytics:track', (e) => {
  const detail = (e as CustomEvent).detail as { event: string; value?: number; source?: string };
  if (detail?.event) track(detail.event, detail.value, detail.source);
  if (detail?.event === 'route_change') {
    const isArchive = !!gameState.date && gameState.date !== todayKey();
    if (!isArchive && dom.archiveRow) {
      dom.archiveRow.classList.add('hidden');
      dom.archiveRow.classList.remove('flex');
    }
  }
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
    // hasData = this browser has a played puzzle in history OR a restorable board
    // for today. RTE-03 deep-link redirect: a stranger sharing /play with someone
    // who's never played should see /welcome — they have neither. See hasPlayerData.
    hasData: hasPlayerData,
    todayLocal: todayKey,
    todayEntry,
    midInteraction: () => activeBox !== null || submitting,
    onArchiveDate: (date) => {
      // Convert date → puzzleNumberFor → /api/puzzle/:num and replay via startReplayPuzzle.
      // puzzleNumberFor uses Z-anchored epoch arithmetic on two fixed date strings (date.ts:35).
      // todayKey() (used elsewhere for keying) is LOCAL, but the number↔date mapping is
      // consistently UTC-anchored in both client and worker, so round-trips are safe.
      // For a UTC+14 player: their local date may be one day ahead of UTC; the worker's
      // +1 calendar-day tolerance (date-guard.ts) is what allows that puzzle number to be
      // fetched without a "future puzzle" rejection (WR-05).
      const num = puzzleNumberFor(date);
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
// Entering the game screen is the point the player has committed to today's
// puzzle — mark it started so a refresh before the first tap comes back here
// (#284). markPuzzleStarted is a no-op unless this really is today's live daily
// board on /play with no draft already stored.
document.addEventListener('screens:enter', (e) => {
  if ((e as CustomEvent).detail?.screen !== 'game') return;
  markPuzzleStarted();
});

document.addEventListener('screens:enter', (e) => {
  const screen = (e as CustomEvent).detail?.screen;
  if (screen !== 'game' || !gameState.solved || gameState.tries == null) return;
  // replayDate is only meaningful on /archive/<date>. On /play the puzzle is today's daily, even if
  // gameState still holds a previous archive date because the user navigated without reloading.
  const onArchiveDate = location.pathname.startsWith('/archive/');
  const replayDate = onArchiveDate && gameState.date && gameState.date !== todayKey() ? gameState.date : undefined;
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
// Header brand: no navigation. Tapping the octopus logo or the "Clumeral"
// wordmark bounces the logo — restores the old site's tap-to-bounce mascot.
document.querySelector('[data-brand]')?.addEventListener('click', () => { bounceBrand(); });
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
    renderBoardControls(); // board changed under the controls' feet — keep Reset live
    checkSubmit();
  } catch { /* dev only */ }
};
