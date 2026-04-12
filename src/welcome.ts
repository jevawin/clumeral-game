// Clumeral — welcome.ts
// Renders the welcome screen content and wires the Play button.
// The welcome screen shell ([data-screen="welcome"]) is managed by screens.ts.
// This module populates its content and handles the first-visit / return-visit layout.

import { showScreen } from './screens.ts';


// ─── Helpers ──────────────────────────────────────────────────────────────────

// Replicated from app.ts to avoid circular imports (RESEARCH.md recommendation).

const EPOCH_DATE = "2026-03-08";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function puzzleNumber(dateStr: string): number {
  const ms = new Date(dateStr + "T00:00:00Z").getTime() - new Date(EPOCH_DATE + "T00:00:00Z").getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}


// ─── SVG ──────────────────────────────────────────────────────────────────────

// Decorative octopus mascot — scaled to 96×96, no animation data attributes,
// no click interaction. The animated octopus on the game screen uses data-octo,
// data-eye, data-mouth; omitting those here prevents octo.ts from touching this element.
const OCTO_SVG = `<svg aria-hidden="true" width="96" height="96" viewBox="0 0 53 52" fill="none" xmlns="http://www.w3.org/2000/svg">
  <mask id="welcome-octo-mask" fill="white">
    <path d="M53 48C53 50.2091 51.2091 52 49 52H48C45.7909 52 44 50.2091 44 48V41H42V48C42 50.2091 40.2091 52 38 52H37C34.7909 52 33 50.2091 33 48V41H31V48C31 50.2091 29.2091 52 27 52H26C23.7909 52 22 50.2091 22 48V41H20V48C20 50.2091 18.2091 52 16 52H15C12.7909 52 11 50.2091 11 48V41H9V48C9 50.2091 7.20914 52 5 52H4C1.79086 52 6.44266e-08 50.2091 0 48V15C1.9329e-07 6.71573 6.71573 0 15 0H38C46.2843 5.47619e-07 53 6.71573 53 15V48Z"/>
  </mask>
  <path
    d="M53 48C53 50.2091 51.2091 52 49 52H48C45.7909 52 44 50.2091 44 48V41H42V48C42 50.2091 40.2091 52 38 52H37C34.7909 52 33 50.2091 33 48V41H31V48C31 50.2091 29.2091 52 27 52H26C23.7909 52 22 50.2091 22 48V41H20V48C20 50.2091 18.2091 52 16 52H15C12.7909 52 11 50.2091 11 48V41H9V48C9 50.2091 7.20914 52 5 52H4C1.79086 52 6.44266e-08 50.2091 0 48V15C1.9329e-07 6.71573 6.71573 0 15 0H38C46.2843 5.47619e-07 53 6.71573 53 15V48Z"
    fill="var(--acc)"
  />
  <path
    d="M53 48H54V48H53ZM49 52V53V52ZM44 48H43V48H44ZM44 41H45V40H44V41ZM42 41V40H41V41H42ZM42 48H43V48H42ZM38 52V53V52ZM33 48H32V48H33ZM33 41H34V40H33V41ZM31 41V40H30V41H31ZM31 48H32V48H31ZM27 52V53V52ZM22 48H21V48H22ZM22 41H23V40H22V41ZM20 41V40H19V41H20ZM20 48H21V48H20ZM16 52V53V52ZM11 48H10V48H11ZM11 41H12V40H11V41ZM9 41V40H8V41H9ZM9 48H10V48H9ZM5 52V53V52ZM0 48H-1V48H0ZM0 15H-1V15H0ZM38 0V-1V-1V0ZM53 15H54V15H53ZM53 48H52C52 49.6569 50.6569 51 49 51V52V53C51.7614 53 54 50.7614 54 48H53ZM49 52V51H48V52V53H49V52ZM48 52V51C46.3431 51 45 49.6569 45 48H44H43C43 50.7614 45.2386 53 48 53V52ZM44 48H45V41H44H43V48H44ZM44 41V40H42V41V42H44V41ZM42 41H41V48H42H43V41H42ZM42 48H41C41 49.6569 39.6569 51 38 51V52V53C40.7614 53 43 50.7614 43 48H42ZM38 52V51H37V52V53H38V52ZM37 52V51C35.3431 51 34 49.6569 34 48H33H32C32 50.7614 34.2386 53 37 53V52ZM33 48H34V41H33H32V48H33ZM33 41V40H31V41V42H33V41ZM31 41H30V48H31H32V41H31ZM31 48H30C30 49.6569 28.6569 51 27 51V52V53C29.7614 53 32 50.7614 32 48H31ZM27 52V51H26V52V53H27V52ZM26 52V51C24.3431 51 23 49.6569 23 48H22H21C21 50.7614 23.2386 53 26 53V52ZM22 48H23V41H22H21V48H22ZM22 41V40H20V41V42H22V41ZM20 41H19V48H20H21V41H20ZM20 48H19C19 49.6569 17.6569 51 16 51V52V53C18.7614 53 21 50.7614 21 48H20ZM16 52V51H15V52V53H16V52ZM15 52V51C13.3431 51 12 49.6569 12 48H11H10C10 50.7614 12.2386 53 15 53V52ZM11 48H12V41H11H10V48H11ZM11 41V40H9V41V42H11V41ZM9 41H8V48H9H10V41H9ZM9 48H8C8 49.6569 6.65685 51 5 51V52V53C7.76142 53 10 50.7614 10 48H9ZM5 52V51H4V52V53H5V52ZM4 52V51C2.34315 51 1 49.6569 1 48H0H-1C-1 50.7614 1.23858 53 4 53V52ZM0 48H1V15H0H-1V48H0ZM0 15H1C1 7.26801 7.26801 1 15 1V0V-1C6.16344 -1 -1 6.16344 -1 15H0ZM15 0V1H38V0V-1H15V0ZM38 0V1C45.732 1 52 7.26801 52 15H53H54C54 6.16344 46.8366 -0.999999 38 -1V0ZM53 15H52V48H53H54V15H53Z"
    fill="#F6F0E8"
    mask="url(#welcome-octo-mask)"
  />
  <!-- Round eyes (default state only — no animation variants needed) -->
  <circle cx="19" cy="15" r="2.5" fill="#F6F0E8" />
  <circle cx="33" cy="15" r="2.5" fill="#F6F0E8" />
  <!-- Happy mouth -->
  <path d="M21 26C24.3333 27.3333 27.6667 27.3333 31 26" stroke="#F6F0E8" stroke-width="1.5" stroke-linecap="round" />
</svg>`;


// ─── Render ───────────────────────────────────────────────────────────────────

function htpSteps(): string {
  return `<ol class="text-base text-muted space-y-2 list-none" aria-label="How to play">
      <li class="flex gap-2"><span class="font-semibold">1.</span><span>Read the clues — each one narrows down a digit</span></li>
      <li class="flex gap-2"><span class="font-semibold">2.</span><span>Tap a digit box to open it, then remove digits that don't fit</span></li>
      <li class="flex gap-2"><span class="font-semibold">3.</span><span>When one digit remains in each box, submit your answer</span></li>
    </ol>`;
}

function playButton(): string {
  return `<button type="button" data-play-btn class="w-full min-h-[48px] rounded-lg bg-accent text-white text-base font-semibold">Play</button>`;
}

function renderWelcome(isNew: boolean): void {
  const screen = document.querySelector('[data-screen="welcome"]') as HTMLElement | null;
  if (!screen) return;

  const num = puzzleNumber(todayLocal());
  const puzzleNumHtml = num > 0 ? `<p class="text-base text-muted text-center">Puzzle #${num}</p>` : "";

  const header = `
    <h1 class="text-3xl font-bold text-text tracking-tight">Clumeral</h1>
    ${OCTO_SVG}
    <div class="text-center space-y-1">
      <p class="text-base text-muted">A daily number puzzle</p>
      ${puzzleNumHtml}
    </div>`;

  // First visit: HTP above Play button; return visit: HTP below
  const body = isNew
    ? `${htpSteps()}
    ${playButton()}`
    : `${playButton()}
    ${htpSteps()}`;

  screen.innerHTML = `
    <div class="w-full max-w-sm mx-auto flex flex-col items-center gap-6 px-6 py-8">
      ${header}
      ${body}
    </div>`;
}


// ─── Public API ───────────────────────────────────────────────────────────────

function hasClumeralData(): boolean {
  return ["dlng_history", "dlng_prefs", "dlng_uid", "dlng_theme", "dlng_colour", "cw-htp-seen"].some((k) => localStorage.getItem(k) !== null);
}

export function initWelcome(): void {
  const isNew = !hasClumeralData();
  renderWelcome(isNew);

  const playBtn = document.querySelector('[data-play-btn]') as HTMLButtonElement | null;
  playBtn?.addEventListener("click", () => showScreen("game"));
}
