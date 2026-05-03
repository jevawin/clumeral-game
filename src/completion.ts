// Clumeral — completion.ts
// Renders completion screen: heading, stats grid, countdown, feedback button.

import { loadHistory } from './storage.ts';
import type { HistoryEntry } from './types.ts';


// ─── SVG ─────────────────────────────────────────────────────────────────────

// Decorative octopus — copy of welcome's octo with renamed mask id to avoid duplicate ids in DOM.
const COMPLETION_OCTO_SVG = `<svg aria-hidden="true" width="96" height="96" viewBox="0 0 53 52" fill="none" xmlns="http://www.w3.org/2000/svg">
  <mask id="completion-octo-mask" fill="white">
    <path d="M53 48C53 50.2091 51.2091 52 49 52H48C45.7909 52 44 50.2091 44 48V41H42V48C42 50.2091 40.2091 52 38 52H37C34.7909 52 33 50.2091 33 48V41H31V48C31 50.2091 29.2091 52 27 52H26C23.7909 52 22 50.2091 22 48V41H20V48C20 50.2091 18.2091 52 16 52H15C12.7909 52 11 50.2091 11 48V41H9V48C9 50.2091 7.20914 52 5 52H4C1.79086 52 6.44266e-08 50.2091 0 48V15C1.9329e-07 6.71573 6.71573 0 15 0H38C46.2843 5.47619e-07 53 6.71573 53 15V48Z"/>
  </mask>
  <path d="M53 48C53 50.2091 51.2091 52 49 52H48C45.7909 52 44 50.2091 44 48V41H42V48C42 50.2091 40.2091 52 38 52H37C34.7909 52 33 50.2091 33 48V41H31V48C31 50.2091 29.2091 52 27 52H26C23.7909 52 22 50.2091 22 48V41H20V48C20 50.2091 18.2091 52 16 52H15C12.7909 52 11 50.2091 11 48V41H9V48C9 50.2091 7.20914 52 5 52H4C1.79086 52 6.44266e-08 50.2091 0 48V15C1.9329e-07 6.71573 6.71573 0 15 0H38C46.2843 5.47619e-07 53 6.71573 53 15V48Z" fill="var(--color-accent)"/>
  <path d="M53 48H54V48H53ZM49 52V53V52ZM44 48H43V48H44ZM44 41H45V40H44V41ZM42 41V40H41V41H42ZM42 48H43V48H42ZM38 52V53V52ZM33 48H32V48H33ZM33 41H34V40H33V41ZM31 41V40H30V41H31ZM31 48H32V48H31ZM27 52V53V52ZM22 48H21V48H22ZM22 41H23V40H22V41ZM20 41V40H19V41H20ZM20 48H21V48H20ZM16 52V53V52ZM11 48H10V48H11ZM11 41H12V40H11V41ZM9 41V40H8V41H9ZM9 48H10V48H9ZM5 52V53V52ZM0 48H-1V48H0ZM0 15H-1V15H0ZM38 0V-1V-1V0ZM53 15H54V15H53ZM53 48H52C52 49.6569 50.6569 51 49 51V52V53C51.7614 53 54 50.7614 54 48H53ZM49 52V51H48V52V53H49V52ZM48 52V51C46.3431 51 45 49.6569 45 48H44H43C43 50.7614 45.2386 53 48 53V52ZM44 48H45V41H44H43V48H44ZM44 41V40H42V41V42H44V41ZM42 41H41V48H42H43V41H42ZM42 48H41C41 49.6569 39.6569 51 38 51V52V53C40.7614 53 43 50.7614 43 48H42ZM38 52V51H37V52V53H38V52ZM37 52V51C35.3431 51 34 49.6569 34 48H33H32C32 50.7614 34.2386 53 37 53V52ZM33 48H34V41H33H32V48H33ZM33 41V40H31V41V42H33V41ZM31 41H30V48H31H32V41H31ZM31 48H30C30 49.6569 28.6569 51 27 51V52V53C29.7614 53 32 50.7614 32 48H31ZM27 52V51H26V52V53H27V52ZM26 52V51C24.3431 51 23 49.6569 23 48H22H21C21 50.7614 23.2386 53 26 53V52ZM22 48H23V41H22H21V48H22ZM22 41V40H20V41V42H22V41ZM20 41H19V48H20H21V41H20ZM20 48H19C19 49.6569 17.6569 51 16 51V52V53C18.7614 53 21 50.7614 21 48H20ZM16 52V51H15V52V53H16V52ZM15 52V51C13.3431 51 12 49.6569 12 48H11H10C10 50.7614 12.2386 53 15 53V52ZM11 48H12V41H11H10V48H11ZM11 41V40H9V41V42H11V41ZM9 41H8V48H9H10V41H9ZM9 48H8C8 49.6569 6.65685 51 5 51V52V53C7.76142 53 10 50.7614 10 48H9ZM5 52V51H4V52V53H5V52ZM4 52V51C2.34315 51 1 49.6569 1 48H0H-1C-1 50.7614 1.23858 53 4 53V52ZM0 48H1V15H0H-1V48H0ZM0 15H1C1 7.26801 7.26801 1 15 1V0V-1C6.16344 -1 -1 6.16344 -1 15H0ZM15 0V1H38V0V-1H15V0ZM38 0V1C45.732 1 52 7.26801 52 15H53H54C54 6.16344 46.8366 -0.999999 38 -1V0ZM53 15H52V48H53H54V15H53Z" fill="#F6F0E8" mask="url(#completion-octo-mask)"/>
  <circle cx="19" cy="15" r="2.5" fill="#F6F0E8"/>
  <circle cx="33" cy="15" r="2.5" fill="#F6F0E8"/>
  <path d="M21 26C24.3333 27.3333 27.6667 27.3333 31 26" stroke="#F6F0E8" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;


// ─── DOM Cache ────────────────────────────────────────────────────────────────

const dom = {
  heading: document.querySelector('[data-completion-heading]') as HTMLElement | null,
  subheading: document.querySelector('[data-completion-subheading]') as HTMLElement | null,
  stats: document.querySelector('[data-completion-stats]') as HTMLElement | null,
  countdown: document.querySelector('[data-completion-countdown]') as HTMLElement | null,
  feedback: document.querySelector('[data-completion-feedback]') as HTMLElement | null,
  octo: document.querySelector('[data-completion-octo]') as HTMLElement | null,
  links: document.querySelector('[data-completion-links]') as HTMLElement | null,
};


// ─── Stats Computation ───────────────────────────────────────────────────────

interface Stats {
  played: number;
  avgTries: string;
  streak: number;
  bestStreak: number;
}

function computeStats(history: HistoryEntry[]): Stats {
  const played = history.length;
  const avgTries = played > 0
    ? (history.reduce((s, h) => s + h.tries, 0) / played).toFixed(1)
    : '0';

  // Single pass for bestStreak; capture current streak (from today) at first gap
  let bestStreak = 0;
  let currentRun = 0;
  let streak = 0;
  let streakBroken = false;
  let prevDate: Date | null = null;

  for (const entry of history) {
    const d = new Date(entry.date + 'T00:00:00'); // local midnight — avoids UTC date shift
    if (!prevDate) {
      currentRun = 1;
    } else {
      const dayDiff = Math.round((prevDate.getTime() - d.getTime()) / 86400000);
      if (dayDiff === 1) {
        currentRun++;
      } else {
        if (!streakBroken) { streak = currentRun; streakBroken = true; }
        currentRun = 1;
      }
    }
    if (currentRun > bestStreak) bestStreak = currentRun;
    prevDate = d;
  }
  // If streak never broke, the entire history is one consecutive run
  if (!streakBroken) streak = currentRun;

  return { played, avgTries, streak, bestStreak };
}


// ─── Countdown ───────────────────────────────────────────────────────────────

function formatCountdown(isRandom: boolean): string | null {
  if (isRandom) return null;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntil = midnight.getTime() - now.getTime();
  const hours = Math.floor(msUntil / 3600000);
  const minutes = Math.floor((msUntil % 3600000) / 60000);
  if (hours > 0) return `Next puzzle in ${hours}h ${minutes}m`;
  return `Next puzzle in ${minutes}m`;
}


// ─── Render ──────────────────────────────────────────────────────────────────

function renderStatBox(value: string | number, label: string): string {
  return `<div class="bg-surface border border-border rounded-md p-4 text-center">
    <span class="block text-3xl font-bold font-mono text-text">${value}</span>
    <span class="text-sm text-text mt-1 block">${label}</span>
  </div>`;
}

export interface RenderCompletionOpts { activeDate?: string; todayLocal?: string }

export function renderCompletion(
  puzzleNum: number,
  tries: number,
  isRandom: boolean,
  opts: RenderCompletionOpts = {}
): void {
  // Octo injection (idempotent — only injects once per session).
  if (dom.octo && !dom.octo.firstChild) {
    dom.octo.innerHTML = COMPLETION_OCTO_SVG;
  }

  // Heading
  if (dom.heading) {
    dom.heading.textContent = isRandom ? 'Puzzle solved!' : `Puzzle #${puzzleNum} solved!`;
  }
  if (dom.subheading) {
    dom.subheading.textContent = `Solved in ${tries} ${tries === 1 ? 'try' : 'tries'}`;
  }

  // Stats grid — daily: full history stats; random: just this game's tries
  if (dom.stats) {
    if (isRandom) {
      dom.stats.innerHTML = renderStatBox(tries, tries === 1 ? 'Try' : 'Tries');
      dom.stats.classList.remove('grid-cols-2');
      dom.stats.classList.add('grid-cols-1', 'max-w-[200px]', 'mx-auto');
    } else {
      const history = loadHistory();
      const stats = computeStats(history);
      dom.stats.innerHTML = [
        renderStatBox(stats.played, 'Played'),
        renderStatBox(stats.avgTries, 'Avg tries'),
        renderStatBox(stats.streak, 'Streak'),
        renderStatBox(stats.bestStreak, 'Best streak'),
      ].join('');
    }
  }

  // Countdown (per D-10: hidden for random puzzles)
  if (dom.countdown) {
    const text = formatCountdown(isRandom);
    dom.countdown.textContent = text ?? '';
    dom.countdown.classList.toggle('hidden', !text);
  }

  // Render Show puzzle + Archive links (SLV-01).
  // Show puzzle is rendered for daily puzzles only (where the user can navigate back to today's
  // game screen). For random puzzles, only Archive shows.
  if (dom.links) {
    dom.links.replaceChildren();

    const isArchivedOtherDate =
      !isRandom &&
      typeof opts.activeDate === 'string' &&
      typeof opts.todayLocal === 'string' &&
      opts.activeDate !== opts.todayLocal;

    // Show puzzle: only on today's daily solved view (not random, not archived past).
    if (!isRandom && !isArchivedOtherDate) {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'link';
      a.dataset.completionShowPuzzle = '';
      a.textContent = 'Show puzzle';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('completion:show-puzzle'));
      });
      dom.links.appendChild(a);
    }

    // Archive link: always present. Renamed from /puzzles to /archive (ARC-01).
    const archive = document.createElement('a');
    archive.href = '/archive';
    archive.className = 'link';
    archive.dataset.completionArchive = '';
    archive.textContent = 'Archive';
    dom.links.appendChild(archive);
  }
}


// ─── Init ────────────────────────────────────────────────────────────────────

// Feedback button delegates to Phase 4's existing [data-fb-btn] trigger (per D-12).
dom.feedback?.addEventListener('click', () => {
  (document.querySelector('[data-fb-btn]') as HTMLElement | null)?.click();
});
