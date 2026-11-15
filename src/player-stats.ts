// Clumeral — player-stats.ts
// The counting rules. History rows in, every displayed figure out. Pure: no DOM,
// no localStorage, no clock of its own — so #163 (streaks on the game screen) and
// #148 (the share picture) can import it without dragging either along.
//
// Named player-stats, not stats: src/worker/stats.ts is the team's /stats
// dashboard, and two files called stats.ts doing unrelated jobs is how the wrong
// one gets edited.

import type { HistoryEntry } from './types.ts';

// ─── Shared constants ────────────────────────────────────────────────────────
//
// One threshold. There used to be a second — a thirty-minute exclusion that kept
// a long game out of the averages — and the redesign brief dropped it (item 22):
// people really do take an hour, and a figure that quietly ignores your slowest
// games is not your average.

/** Validity bound. A stored time outside 0–86400 whole seconds is *unknown*: it
 *  shows as a dash, sends no event, never counts as zero and never enters an
 *  average or a best. A day is comfortably absurd enough to catch a forged value
 *  while leaving a real long game alone (brief 122). */
export const MAX_STORED_SECONDS = 86_400;

/** Two minutes with no action and the clock stops; the gap is thrown away
 *  entirely rather than paused (brief 34, 50). */
export const IDLE_TIMEOUT_MS = 120_000;

/** Streaks and all-time appear from the third countable game — the comparison is
 *  countableGames > REVEAL_AFTER_GAMES, so 1 and 2 hide and 3 reveals
 *  (brief 19, 131). */
export const REVEAL_AFTER_GAMES = 2;

/**
 * The stored time for one game, or null when it is unknown.
 *
 * Validity is the only question asked here, and now the only question asked
 * anywhere: every valid time counts towards every figure.
 */
export function validSeconds(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value > MAX_STORED_SECONDS) return null;
  return value;
}


// ─── The figures ─────────────────────────────────────────────────────────────

export interface PlayerStats {
  plays: number;
  firstGoWins: number;
  firstGoPercent: number | null;
  avgGoes: string | null;
  avgTimeSeconds: number | null;
  /** The fastest solve of any number of goes, or null with no valid time. */
  bestTimeSeconds: number | null;
  playStreak: number;
  bestPlayStreak: number;
  firstGoStreak: number;
  bestFirstGoStreak: number;
  /** Countable games played. Drives the reveal gate at brief 19 / 131. Always
   *  equal to `plays`; named separately because the gate is about how much the
   *  panel shows, and a later change to what "plays" means should not silently
   *  move it. */
  countableGames: number;
}

/**
 * Countable: a real daily solve. Not an archive replay (brief 16), not a
 * day-only marker (brief 71, 123). Everything filters to countable rows BEFORE
 * counting anything.
 */
function isCountable(h: HistoryEntry): boolean {
  return h.archived !== true && h.marker !== true;
}

/** The time this game contributes to an average or a record, or null. */
function rowSeconds(h: HistoryEntry): number | null {
  return validSeconds(h.seconds);
}

const DAY_MS = 86_400_000;

/**
 * One walk, two streaks.
 *
 * `qualifies` decides whether a row continues the run. For the play streak every
 * countable row qualifies. For the first-go streak a two-go day does NOT — and
 * it is a *break*, not an absence, which is why this walks all countable rows
 * rather than filtering to first-go rows first. Filtering would join two runs
 * either side of a two-go day into one long run and overstate the best.
 *
 * `rows` must be countable rows sorted date-descending.
 */
function walkStreak(
  rows: HistoryEntry[],
  qualifies: (h: HistoryEntry) => boolean,
): { current: number; best: number } {
  let best = 0;
  let run = 0;
  let current = 0;
  let broken = false;
  let prev: Date | null = null;

  const breakRun = () => {
    if (!broken) { current = run; broken = true; }
    run = 0;
  };

  for (const entry of rows) {
    const d = new Date(entry.date + 'T00:00:00'); // local midnight — avoids a UTC date shift
    if (prev !== null) {
      // Whole days apart. A duplicate date reads as 0 and so counts as a gap,
      // which is what stops a double-written day inflating a streak.
      const dayDiff = Math.round((prev.getTime() - d.getTime()) / DAY_MS);
      if (dayDiff !== 1) breakRun();
    }
    prev = d;

    if (!qualifies(entry)) { breakRun(); continue; }

    run++;
    if (run > best) best = run;
  }

  if (!broken) current = run;
  return { current, best };
}

/**
 * Every figure the panel shows.
 *
 * `today` is passed in rather than read from a clock, so callers stay testable
 * without fake timers and this module stays pure.
 */
export function computePlayerStats(history: HistoryEntry[], today: string): PlayerStats {
  const countable = history.filter(isCountable);

  // Sort a COPY date-descending — stored history may be unsorted, and a single
  // out-of-order row would otherwise create a false early gap and under-count
  // the streak. Never mutate the caller's array.
  const sorted = [...countable].sort((a, b) => b.date.localeCompare(a.date));

  const plays = countable.length;
  const firstGoWins = countable.filter((h) => h.tries === 1).length;

  const times = countable.map(rowSeconds).filter((s): s is number => s !== null);
  const avgTimeSeconds = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : null;
  const bestTimeSeconds = times.length ? Math.min(...times) : null;

  // Recency gate: a run that ended more than a day ago is stale, so report 0
  // rather than showing a "current streak" to someone who has not played in
  // days. The leading COUNTABLE row is what decides it.
  const yesterday = new Date(today + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const mostRecent = sorted[0]?.date;
  const live = mostRecent === today || mostRecent === yesterdayKey;

  const play = walkStreak(sorted, () => true);
  const firstGo = walkStreak(sorted, (h) => h.tries === 1);

  return {
    plays,
    firstGoWins,
    firstGoPercent: plays > 0 ? Math.round((firstGoWins / plays) * 100) : null,
    avgGoes: plays > 0 ? (countable.reduce((s, h) => s + h.tries, 0) / plays).toFixed(1) : null,
    avgTimeSeconds,
    bestTimeSeconds,
    playStreak: live ? play.current : 0,
    bestPlayStreak: play.best,
    firstGoStreak: live ? firstGo.current : 0,
    bestFirstGoStreak: firstGo.best,
    countableGames: plays,
  };
}


// ─── The results page (redesign brief 2026-11-15) ────────────────────────────
//
// The Today message, the goes strip's days and the Streaks line. Every rule here
// counts the same rows `goesByDay` keeps, so the message's "Solve number" and the
// strip's "{N} days played" can never disagree over a forged row.

/** Rungs 1 and 3 need this many earlier valid times (brief 83). */
export const MIN_EARLIER_TIMES = 3;

/** Rows past this draw as a broken column (brief 22, 23). */
export const STRIP_CAP = 5;

export interface StripDay { date: string; goes: number }

/** A row the strip and the message count: countable, with a whole number of goes. */
function hasGoes(h: HistoryEntry): boolean {
  return isCountable(h) && Number.isInteger(h.tries) && h.tries >= 1;
}

/**
 * One entry per countable row whose `tries` is a whole number of at least 1,
 * sorted by date ascending. Today is included when it is in history. Missed days
 * are not entries (brief 24).
 */
export function goesByDay(history: HistoryEntry[]): StripDay[] {
  return history
    .filter(hasGoes)
    .map((h) => ({ date: h.date, goes: h.tries }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type TodayMessage =
  | { kind: 'fastest'; under: number }
  | { kind: 'quicker'; by: number }
  | { kind: 'one-go'; nth: number }
  | { kind: 'fewer-goes'; usual: string }
  | { kind: 'solve-number'; n: number };

/** A time the message can use. Below 1s is a junk solve, not a record (brief 94). */
function timed(s: number | null): s is number {
  return s !== null && s >= 1;
}

/**
 * The one line under today's figures (brief 17, as amended by 81, 83, 89).
 * Every baseline is history strictly BEFORE today, so today never pulls its own
 * average or best (brief 18, 31). `seconds` has already passed validSeconds.
 * Null when `tries` is not a whole number of at least 1.
 */
export function todayMessage(
  history: HistoryEntry[], today: string, tries: number | null, seconds: number | null,
): TodayMessage | null {
  if (tries === null || !Number.isInteger(tries) || tries < 1) return null;

  const earlier = history.filter((h) => hasGoes(h) && h.date < today);
  const earlierTimes = earlier.map(rowSeconds).filter(timed);
  const enoughTimes = timed(seconds) && earlierTimes.length >= MIN_EARLIER_TIMES;

  if (enoughTimes) {
    const best = Math.min(...earlierTimes);
    if (seconds < best) return { kind: 'fastest', under: best - seconds };
    const mean = earlierTimes.reduce((a, b) => a + b, 0) / earlierTimes.length;
    const by = Math.round(mean - seconds);
    if (by >= 1) return { kind: 'quicker', by };
  }

  if (tries === 1) {
    return { kind: 'one-go', nth: earlier.filter((h) => h.tries === 1).length + 1 };
  }

  if (earlier.length >= 1) {
    const usual = (earlier.reduce((s, h) => s + h.tries, 0) / earlier.length).toFixed(1);
    if (tries < Number(usual)) return { kind: 'fewer-goes', usual };
  }

  return { kind: 'solve-number', n: earlier.length + 1 };
}

export interface MessageCopy { icon: string; pre: string; bold: string; post: string }

/** The words for a message (brief 55, 93: differences in the compact form). */
export function messageCopy(m: TodayMessage): MessageCopy {
  const compact = (x: number) => formatDuration(x, { compact: true });
  switch (m.kind) {
    case 'fastest':
      return { icon: 'icon-trophy', pre: '', bold: 'Your fastest ever', post: `, ${compact(m.under)} under your best.` };
    case 'quicker':
      return { icon: 'icon-arrow-up', pre: '', bold: `${compact(m.by)} quicker`, post: ' than your average.' };
    case 'one-go':
      return { icon: 'icon-tick', pre: '', bold: 'Straight in.', post: ` Your ${ordinal(m.nth)} one-go solve.` };
    case 'fewer-goes':
      return { icon: 'icon-calculator', pre: '', bold: 'Fewer goes', post: ` than your usual ${m.usual}.` };
    case 'solve-number':
      return { icon: 'icon-gamepad', pre: 'Solve number ', bold: String(m.n), post: '.' };
  }
}

/** 1 → "first"; otherwise the number with an English suffix (brief 90). */
export function ordinal(n: number): string {
  if (n === 1) return 'first';
  const hundred = n % 100;
  if (hundred >= 11 && hundred <= 13) return `${n}th`;
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export interface StreakLine {
  /** The play streak. */
  figure: number;
  /** "days played" | "day played" | "days solved in one" | "day solved in one". */
  label: string;
  /** The best play streak. */
  best: number;
  /** Shown only from 2 and only when the label has not switched. */
  oneGoRun: number | null;
}

/**
 * The Streaks card's figure and second line (brief 20, 21, 56, 57 as amended by
 * 82). When the one-go run equals the play streak the label names the harder
 * one, and the one-go part would only repeat it.
 */
export function streakLine(stats: PlayerStats): StreakLine {
  const switched = stats.playStreak > 0 && stats.firstGoStreak === stats.playStreak;
  const unit = stats.playStreak === 1 ? 'day' : 'days';
  return {
    figure: stats.playStreak,
    label: `${unit} ${switched ? 'solved in one' : 'played'}`,
    best: stats.bestPlayStreak,
    oneGoRun: !switched && stats.firstGoStreak >= 2 ? stats.firstGoStreak : null,
  };
}


// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * For the screen: `0m 30s`, `4m 06s`, `1h 04m`. An unknown time is a dash,
 * never 0:00.
 *
 * Unit letters rather than `4:06` (Jamie and Dave, 2026-08-11). `4:06` can read
 * as four hours to someone glancing, and the separator this line used to need —
 * a bullet, or the pipe Dave suggested — sits right beside a number, where a
 * pipe is barely distinguishable from a 1. Letters remove the ambiguity and the
 * separator both: the line is now a comma away from plain English.
 *
 * Seconds are padded to two digits so a column of them lines up; minutes are
 * not, because a leading zero on the minutes reads as a stopwatch.
 *
 * `compact` drops the zero minutes under a minute (`41s`), and is the same as the
 * default from a minute up. Two places use it: the time chart's own axis labels,
 * where there is no room at 288px for `0m 41s` beside a neighbouring label (time
 * chart brief item 63), and the results message's differences, "17s quicker"
 * (results brief 93). Every other sentence and figure keeps the default form.
 */
export function formatDuration(seconds: number | null, opts: { compact?: boolean } = {}): string {
  if (seconds === null) return '—';
  if (opts.compact && seconds < 60) return `${seconds}s`;
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * For speech. A screen reader saying "three colon forty-one" is the reason the
 * announcement does not reuse formatDuration. An unknown time is an empty
 * string, so the caller can leave it out of the sentence entirely.
 */
export function speakDuration(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}` : plural(hours, 'hour');
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!minutes) return plural(rest, 'second');
  return rest ? `${plural(minutes, 'minute')} ${plural(rest, 'second')}` : plural(minutes, 'minute');
}
