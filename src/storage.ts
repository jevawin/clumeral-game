// Clumeral — storage.ts
// localStorage helpers for prefs and game history.

import type { HistoryEntry, Prefs } from './types.ts';

const STORAGE_HISTORY = "dlng_history";
const STORAGE_PREFS = "dlng_prefs";

export function loadPrefs(): Prefs {
  try {
    return { saveScore: true, ...JSON.parse(localStorage.getItem(STORAGE_PREFS) || "{}") };
  } catch {
    return { saveScore: true };
  }
}

export function persistPrefs(saveScore: boolean): void {
  localStorage.setItem(STORAGE_PREFS, JSON.stringify({ saveScore }));
}

export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]") || [];
  } catch {
    return [];
  }
}

export function recordGame(dateStr: string, tries: number, answer?: number): void {
  const history = loadHistory().filter((h) => h.date !== dateStr);
  history.unshift({ date: dateStr, tries, ...(answer != null && { answer }) });
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 60)));
}
