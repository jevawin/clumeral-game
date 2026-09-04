// Clumeral — demo-history.ts
// A pre-filled play history, so the full stats panel can be looked at without
// waiting three days for the reveal gate to open.
//
// This exists for Jamie and Dave to iterate on the design. It is NOT a feature
// and it is NOT reachable on clumeral.com: every entry point below returns early
// on the production hostname, the same gate /api/dev/answer already uses.
//
// A query parameter rather than a console command on purpose — both of them test
// on a phone, where there is no console.
//
//   <preview-url>/solved?demo=stats   fills a rich history and shows the panel
//   <preview-url>/play?demo=clear     puts it back to nothing
//
// The parameter is stripped from the URL afterwards, so a reload does not reseed
// and the address bar stays honest about where you are.

import type { HistoryEntry } from './types.ts';
import { todayKey } from './date.ts';

/** Never runs on production. Mirrors the gate on /api/dev/answer. */
export function demoAllowed(hostname: string): boolean {
  return hostname !== 'clumeral.com';
}

/** A date `back` days before `today`, as a local date key. */
function dayBefore(today: string, back: number): string {
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A history shaped to exercise every part of the panel at once, rather than a
 * flat run of identical days. It deliberately contains:
 *
 *   - a live play streak ending today, and a longer best behind it
 *   - a first-go streak that is live but shorter, so the two numbers differ
 *   - a gap, so "best" is visibly larger than "current"
 *   - goes across all six chart buckets, including a 9-go day in the 6+ tail
 *   - one game over half an hour, which exercises the hour-plus time format and
 *     counts towards the average like any other game
 *   - one row with no time at all, standing in for a pre-launch game
 *   - an archived row, which must change no figure on this panel
 */
export function demoHistory(today = todayKey()): HistoryEntry[] {
  const d = (back: number) => dayBefore(today, back);
  return [
    // Live run: today back to 5 days ago. Six days.
    { date: d(0), tries: 1, answer: 314, seconds: 71 },
    { date: d(1), tries: 1, answer: 271, seconds: 96 },
    { date: d(2), tries: 3, answer: 618, seconds: 245 },
    { date: d(3), tries: 2, answer: 141, seconds: 188 },
    { date: d(4), tries: 5, answer: 802, seconds: 402 },
    { date: d(5), tries: 4, answer: 577, seconds: 331 },
    // A gap at 6 days ago, so the current streak is 6 and the best is 9.
    { date: d(7), tries: 1, answer: 236, seconds: 54 },
    { date: d(8), tries: 2, answer: 449, seconds: 210 },
    { date: d(9), tries: 9, answer: 195, seconds: 2210 },   // the 6+ bucket, and a long time
    { date: d(10), tries: 1, answer: 383, seconds: 63 },
    { date: d(11), tries: 3, answer: 720, seconds: 265 },
    { date: d(12), tries: 2, answer: 508, seconds: 173 },
    { date: d(13), tries: 6, answer: 661, seconds: 520 },   // the 6+ bucket again
    { date: d(14), tries: 1, answer: 112, seconds: 88 },
    { date: d(15), tries: 4, answer: 934, seconds: 355 },   // 9 in a row ends here
    // Older, with a pre-launch row that has no time at all.
    { date: d(20), tries: 2, answer: 246 },
    { date: d(21), tries: 3, answer: 357, seconds: 240 },
    // An archive replay. Must change no figure on the panel.
    { date: '2026-05-04', tries: 7, answer: 428, archived: true },
  ];
}

/**
 * Reads `?demo=` and acts on it. Returns true if it changed anything, in which
 * case the caller should let the page carry on with the new storage in place.
 */
export function applyDemoParam(url: URL): boolean {
  if (!demoAllowed(url.hostname)) return false;
  const demo = url.searchParams.get('demo');
  if (!demo) return false;

  try {
    if (demo === 'clear') {
      localStorage.removeItem('dlng_history');
    } else {
      localStorage.setItem('dlng_history', JSON.stringify(demoHistory()));
      localStorage.setItem('dlng_prefs', JSON.stringify({ saveScore: true }));
    }
  } catch {
    return false; // private mode — nothing to do and nothing to report
  }

  // Strip the parameter so a reload does not reseed and the address bar is
  // honest about where you are. replaceState, not a navigation: the app has not
  // booted yet and a redirect here would race it.
  url.searchParams.delete('demo');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  return true;
}
