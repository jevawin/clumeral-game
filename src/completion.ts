// Clumeral — completion.ts
// Renders completion screen: heading, stats grid, countdown, feedback button.

import { loadHistory } from './storage.ts';
import type { HistoryEntry } from './types.ts';


// ─── DOM Cache ────────────────────────────────────────────────────────────────

const dom = {
  heading: document.querySelector('[data-completion-heading]') as HTMLElement | null,
  subheading: document.querySelector('[data-completion-subheading]') as HTMLElement | null,
  stats: document.querySelector('[data-completion-stats]') as HTMLElement | null,
  countdown: document.querySelector('[data-completion-countdown]') as HTMLElement | null,
  feedback: document.querySelector('[data-completion-feedback]') as HTMLElement | null,
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
    <span class="text-sm text-muted mt-1 block">${label}</span>
  </div>`;
}

export function renderCompletion(puzzleNum: number, tries: number, isRandom: boolean): void {
  // Heading
  if (dom.heading) {
    dom.heading.textContent = `Puzzle #${puzzleNum} solved!`;
  }
  if (dom.subheading) {
    dom.subheading.textContent = `You got it in ${tries} ${tries === 1 ? 'try' : 'tries'}.`;
  }

  // Stats grid (per D-05: played, avg tries, streak, best streak)
  const history = loadHistory();
  const stats = computeStats(history);
  if (dom.stats) {
    dom.stats.innerHTML = [
      renderStatBox(stats.played, 'Played'),
      renderStatBox(stats.avgTries, 'Avg tries'),
      renderStatBox(stats.streak, 'Streak'),
      renderStatBox(stats.bestStreak, 'Best streak'),
    ].join('');
  }

  // Countdown (per D-10: hidden for random puzzles)
  if (dom.countdown) {
    const text = formatCountdown(isRandom);
    dom.countdown.textContent = text ?? '';
    dom.countdown.classList.toggle('hidden', !text);
  }
}


// ─── Init ────────────────────────────────────────────────────────────────────

// Feedback button delegates to Phase 4's existing [data-fb-header-btn] trigger (per D-12).
dom.feedback?.addEventListener('click', () => {
  (document.querySelector('[data-fb-header-btn]') as HTMLElement | null)?.click();
});
