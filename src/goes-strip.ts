// Clumeral — goes-strip.ts
// The Streaks card's goes strip on /solved: one column per day played, oldest
// left, today at the right end, and an empty column for each day missed between
// them (results brief items 22, 23, 47, 60, 67, 68, 88, 97).
//
// Markup is pure: day list in, string out, unit-tested without a page. The strip
// opens at today through CSS (`direction: rtl` on the scroller, plan D6). The one
// piece that runs after insertion is wireStrip, which marks when earlier days are
// off-screen to the left, for the arrow and the fade (brief 105).

import { STRIP_CAP, type StripDay } from './player-stats.ts';

/** Cell height and column gap, in px (brief 47). */
export const CELL_PX = 10;
export const GAP_PX = 4;
/** Room above the rows for a broken column's true figure. */
export const HEAD_PX = 14;

/** Rows = the worst day, capped at STRIP_CAP, at least 1 (brief 22). */
export function stripRows(days: StripDay[]): number {
  return Math.min(STRIP_CAP, Math.max(1, ...days.map((d) => d.goes)));
}

/** Height of the rows area. */
export function stripAreaPx(rows: number): number {
  return rows * CELL_PX + (rows - 1) * GAP_PX;
}

/** With a broken column, rows above this are unnumbered: there row 4 is the bolt
 *  and row 5 the solving go, so "4" and "5" would be wrong (brief 108). */
export const LABELLED_ROWS = 3;

/** The y axis's labels, top row first, and "1 go" on the bottom row so the axis
 *  says what it counts (brief 102). Every row is numbered unless the strip has a
 *  broken column; then rows 4 and 5 are '' (brief 108). */
export function yLabels(rows: number, broken = false): string[] {
  return Array.from({ length: rows }, (_, k) => {
    const r = rows - k;
    if (r === 1) return '1 go';
    return !broken || r <= LABELLED_ROWS ? String(r) : '';
  });
}

/** The x axis's left label: how long ago the oldest column is (brief 102). */
export function xStart(days: StripDay[]): string {
  if (days.length < 2) return '';
  const n = missedBetween(days[0].date, days[days.length - 1].date) + 1;
  return `${n} ${n === 1 ? 'day' : 'days'} ago`;
}

/** Days missed between two played days: the calendar days strictly between them.
 *  0 for adjacent days, a duplicate date or a malformed key (brief 97). */
export function missedBetween(earlier: string, later: string): number {
  const n = dayNumber(later) - dayNumber(earlier) - 1;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Missed days across the whole list, first played day to today. */
export function missedTotal(days: StripDay[]): number {
  let n = 0;
  for (let i = 1; i < days.length; i++) n += missedBetween(days[i - 1].date, days[i].date);
  return n;
}

const BUCKET_WORDS = ['one', 'two', 'three', 'four', 'five', 'six or more'];

/**
 * What a screen reader hears instead of the columns (brief 67 as amended by 88).
 * Buckets with no days are left out. Today is the last day, at its true figure.
 */
export function stripSummary(days: StripDay[]): string {
  const counts = BUCKET_WORDS.map(() => 0);
  for (const d of days) counts[Math.min(d.goes, 6) - 1]++;
  const parts = counts
    .map((n, i) => (n ? `${n} in ${BUCKET_WORDS[i]}` : ''))
    .filter(Boolean)
    .join(', ');
  const n = days.length;
  const today = days[n - 1]?.goes ?? 0;
  const missed = missedTotal(days);
  const gaps = missed ? `, ${missed} missed` : '';
  return `Goes per day, your ${n} ${n === 1 ? 'day' : 'days'} played${gaps}: ${parts}. Today: ${today}.`;
}

function attr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const MISS = '<span class="goes-strip__cell goes-strip__cell--miss"></span>';
const HIT = '<span class="goes-strip__cell goes-strip__cell--hit"></span>';
/** A missed day: a column with no cells, so the gap shows (brief 97). */
const GAP = '<div data-strip-missed></div>';

/** A break this long or longer draws as one marked column instead of a column
 *  per day, so a long time away does not fill the strip with blanks (brief 98). */
export const BREAK_DAYS = 7;

/** The columns between two played days: one empty column per missed day, or one
 *  break column carrying the count once the run reaches BREAK_DAYS. */
function gapColumns(missed: number): string {
  if (missed >= BREAK_DAYS) {
    // `missed` is a whole number from missedBetween, so it is safe in markup.
    return `<div data-strip-break data-missed="${missed}"><span class="goes-strip__break">${missed}d</span></div>`;
  }
  return GAP.repeat(missed);
}
const BOLT =
  '<span class="goes-strip__elide"><svg class="goes-strip__bolt" aria-hidden="true">' +
  '<use href="/sprites.svg#icon-bolt"/></svg></span>';

/** One column. Cells run bottom to top in DOM order (the column is
 *  `column-reverse`). Past the cap: three misses, a bolt for the elided goes, the
 *  solving go, then the true figure on top (brief 23). */
function column(goes: number): string {
  // `goes` is a whole number from goesByDay, so it is safe in markup as is.
  if (goes > STRIP_CAP) {
    return (
      `<div data-strip-day data-goes="${goes}" data-broken>` +
      MISS.repeat(3) + BOLT + HIT +
      `<span class="goes-strip__count">${goes}</span></div>`
    );
  }
  return `<div data-strip-day data-goes="${goes}">${MISS.repeat(goes - 1)}${HIT}</div>`;
}

const ARROW =
  '<svg class="goes-strip__arrow" aria-hidden="true"><use href="/sprites.svg#icon-arrow-left"/></svg>';

/** The whole strip, or '' for an empty list. Row numbers down the left, top row
 *  first to "1 go" (brief 102); under the scroller, "{n} days ago" on the left and
 *  "today" on the right, always in view, with a left arrow before the first while
 *  earlier days are off-screen (brief 105). No axis lines. */
export function goesStripHtml(days: StripDay[]): string {
  if (!days.length) return '';
  const rows = stripRows(days);
  const areaH = stripAreaPx(rows);
  const y = yLabels(rows, days.some((d) => d.goes > STRIP_CAP)).map((l) => `<span>${l}</span>`).join('');
  return (
    '<div class="goes-strip" data-goes-strip>' +
    `<div class="goes-strip__y" aria-hidden="true" style="margin-block-start: ${HEAD_PX + GAP_PX}px">${y}</div>` +
    '<div class="goes-strip__col">' +
    '<div class="goes-strip__frame">' +
    `<div class="goes-strip__scroller" data-strip-scroller role="group" tabindex="0" aria-label="${attr(stripSummary(days))}">` +
    `<div class="goes-strip__inner" aria-hidden="true" style="block-size: ${areaH + GAP_PX + HEAD_PX}px">` +
    days.map((d, i) => (i ? gapColumns(missedBetween(days[i - 1].date, d.date)) : '') + column(d.goes)).join('') +
    '</div></div></div>' +
    `<div class="goes-strip__x" aria-hidden="true"><span class="goes-strip__start">${ARROW}${xStart(days)}</span><span>today</span></div>` +
    '</div></div>'
  );
}

let watcher: ResizeObserver | null = null;

/** Keeps `data-more-left` on the strip while earlier days are off-screen to the
 *  left: on load, on scroll and on resize. The scroller is rtl, so its scrollLeft
 *  runs from 0 at today to minus the overflow at the oldest day. Also keeps the
 *  scroller a tab stop only while it has something to scroll, so a short strip is
 *  not a stop that does nothing; its summary is still read as a labelled group. */
export function wireStrip(root: HTMLElement): void {
  watcher?.disconnect();
  watcher = null;
  const strip = root.querySelector<HTMLElement>('[data-goes-strip]');
  const scroller = strip?.querySelector<HTMLElement>('[data-strip-scroller]');
  if (!strip || !scroller) return;
  const update = () => {
    const hidden = scroller.scrollWidth - scroller.clientWidth - Math.abs(scroller.scrollLeft);
    strip.toggleAttribute('data-more-left', hidden > 1);
    if (scroller.scrollWidth > scroller.clientWidth + 1) scroller.setAttribute('tabindex', '0');
    else scroller.removeAttribute('tabindex');
  };
  scroller.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver === 'function') {
    watcher = new ResizeObserver(update);
    watcher.observe(scroller);
  }
  update();
}
