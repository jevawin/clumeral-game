// Clumeral — walkthrough.ts
// First-play octopus walkthrough: the mascot "talks" through the /play header,
// typing a scripted tutorial in place of the "Clumeral" wordmark.
// Frontend-only. No worker/API changes. Triggered on a player's first game
// (suppressed once `dlng_history` exists). See
// docs/superpowers/specs/2026-05-31-octopus-walkthrough-design.md.

export type StepKind = 'timed' | 'gated' | 'end';
export type GateEvent = 'game:box-opened' | 'game:digit-eliminated';

export interface Step {
  kind: StepKind;
  text: string;
  gate?: GateEvent;
}

export const STEPS: Step[] = [
  { kind: 'timed', text: "Looks like it's your first time here…" },
  { kind: 'timed', text: 'The goal: work out the 3-digit number.' },
  { kind: 'gated', text: 'Tap one of those big digit boxes to open it…', gate: 'game:box-opened' },
  { kind: 'gated', text: "Now deselect digits it can't be using the clues", gate: 'game:digit-eliminated' },
  { kind: 'end', text: '' },
];

export const TYPE_MS = 45;
export const DELETE_MS = 25;
// Hold on the normal logo for a beat before the octopus starts talking.
export const START_DELAY_MS = 5000;
// While talking, the brand text drops to clue size (16px), left-aligned, in the
// clue font (Quicksand) — not the bold Comfortaa wordmark size.
const WALKTHROUGH_CLASS = 'text-base font-normal text-text font-[Quicksand] text-left leading-tight';

// True iff `event` is the gate this step is waiting on.
export function gateMatches(step: Step, event: GateEvent): boolean {
  return step.kind === 'gated' && step.gate === event;
}

// Reading-time hold: 200 wpm + 1s buffer, 2s floor.
export function holdMsFor(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const ms = Math.round((words / 200) * 60_000) + 1000;
  return Math.max(ms, 2000);
}

// ─── Runtime (DOM + timers) ──────────────────────────────────────────────────

const REDUCED_MOTION = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

let active = false;
let hasRun = false;
let stepIndex = 0;
let waitingGate: GateEvent | null = null;
let typing = false;
let pendingGateHit = false;
let brandOriginalClass: string | null = null; // captured before the first style swap
const timers: ReturnType<typeof setTimeout>[] = [];

function later(fn: () => void, ms: number): void {
  timers.push(setTimeout(fn, ms));
}

function clearTimers(): void {
  for (const t of timers) clearTimeout(t);
  timers.length = 0;
}

function brandTextEl(): HTMLElement | null {
  return document.querySelector('[data-brand-text]');
}

function liveEl(): HTMLElement | null {
  return document.querySelector('[data-walkthrough-live]');
}

function announce(text: string): void {
  const el = liveEl();
  if (el) el.textContent = text;
}

function setBrand(text: string): void {
  const el = brandTextEl();
  if (el) el.textContent = text;
}

// Fade the wordmark out (≈250ms), empty it, then run `onDone`.
function fadeOutWordmark(onDone: () => void): void {
  const el = brandTextEl();
  if (!el) {
    onDone();
    return;
  }
  if (REDUCED_MOTION()) {
    el.textContent = '';
    onDone();
    return;
  }
  el.style.transition = 'opacity 0.25s ease-out';
  el.style.opacity = '0';
  later(() => {
    el.textContent = '';
    el.style.opacity = '1'; // text is empty, so safe to restore opacity now
    onDone();
  }, 260);
}

// Type `text` in char-by-char, then `onDone`. Reduced-motion sets it instantly.
function typeIn(text: string, onDone: () => void): void {
  if (REDUCED_MOTION()) {
    setBrand(text);
    onDone();
    return;
  }
  let i = 0;
  const tick = () => {
    i++;
    setBrand(text.slice(0, i));
    if (i < text.length) later(tick, TYPE_MS);
    else onDone();
  };
  setBrand('');
  later(tick, TYPE_MS);
}

// Delete the current brand text char-by-char, then `onDone`.
function deleteOut(onDone: () => void): void {
  const el = brandTextEl();
  const text = el?.textContent ?? '';
  if (REDUCED_MOTION()) {
    setBrand('');
    onDone();
    return;
  }
  let i = text.length;
  const tick = () => {
    i--;
    setBrand(text.slice(0, Math.max(i, 0)));
    if (i > 0) later(tick, DELETE_MS);
    else onDone();
  };
  later(tick, DELETE_MS);
}

// Restore the wordmark and tear down. Idempotent.
function finish(): void {
  if (!active) return;
  active = false;
  waitingGate = null;
  typing = false;
  pendingGateHit = false;
  clearTimers();
  const el = brandTextEl();
  if (el) {
    el.style.transition = '';
    el.style.opacity = '1';
    el.removeAttribute('aria-hidden');
    if (brandOriginalClass !== null) el.className = brandOriginalClass; // restore wordmark size/font
  }
  setBrand('Clumeral');
}

function runStep(index: number): void {
  if (!active) return;
  stepIndex = index;
  const step = STEPS[index];
  if (!step || step.kind === 'end') {
    finish();
    return;
  }

  announce(step.text);
  // Arm the gate BEFORE typing so a fast tap during the type-in is not lost.
  if (step.kind === 'gated') {
    waitingGate = step.gate ?? null;
    pendingGateHit = false;
  }
  typing = true;
  typeIn(step.text, () => {
    typing = false;
    if (step.kind === 'timed') {
      later(() => deleteOut(() => runStep(index + 1)), holdMsFor(step.text));
    } else if (pendingGateHit) {
      // The user triggered the gate while the prompt was still typing — advance now.
      pendingGateHit = false;
      waitingGate = null;
      deleteOut(() => runStep(index + 1));
    }
    // else gated: hold until the matching game event arrives (onGameEvent).
  });
}

function onGameEvent(event: GateEvent): void {
  if (!active || waitingGate !== event) return;
  const step = STEPS[stepIndex];
  if (!gateMatches(step, event)) return;
  if (typing) {
    // Event arrived mid-type; advance as soon as the prompt finishes typing.
    pendingGateHit = true;
    return;
  }
  waitingGate = null;
  deleteOut(() => runStep(stepIndex + 1));
}

function start(): void {
  if (active) return;
  active = true;
  stepIndex = 0;
  waitingGate = null;
  typing = false;
  pendingGateHit = false;
  // Hold on the normal logo for ~5s, then the octopus starts talking.
  later(begin, START_DELAY_MS);
}

// Fade the wordmark out and start the script. Runs after the start delay.
function begin(): void {
  if (!active) return;
  const el = brandTextEl();
  if (el) {
    if (brandOriginalClass === null) brandOriginalClass = el.className;
    el.className = WALKTHROUGH_CLASS;
    // Hide the typed prose from the a11y tree — the [data-walkthrough-live] region
    // is the spoken channel. Prevents a Label-in-Name mismatch on the brand button
    // (its aria-label stays "Home" while the visible text becomes tutorial prose).
    el.setAttribute('aria-hidden', 'true');
  }
  fadeOutWordmark(() => runStep(0));
}

export function initWalkthrough(): void {
  document.addEventListener('screens:enter', (e) => {
    const screen = (e as CustomEvent).detail?.screen;
    if (screen !== 'game') {
      // Leaving /play mid-sequence reverts the wordmark.
      if (active) finish();
      return;
    }
    // Read `dlng_history` live (not a load-time snapshot) so the walkthrough never
    // replays once the player has solved a puzzle. `hasRun` latches it to once per
    // page session — re-navigating game→welcome→game won't re-trigger it.
    if (!active && !hasRun && !localStorage.getItem('dlng_history')) {
      hasRun = true;
      start();
    }
  });

  document.addEventListener('game:box-opened', () => onGameEvent('game:box-opened'));
  document.addEventListener('game:digit-eliminated', () => onGameEvent('game:digit-eliminated'));
}

initWalkthrough();
