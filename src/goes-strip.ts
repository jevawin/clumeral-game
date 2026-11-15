// Clumeral — goes-strip.ts
// The Streaks card's goes strip on /solved: one column per day played, oldest
// left, today at the right end (results brief items 22, 23, 47, 60, 67, 68, 88).
//
// Pure: day list in, markup string out. No DOM access, so it is unit-tested
// without a page. The strip opens at today through CSS (`direction: rtl` on the
// scroller, plan D6), so nothing here needs to run after insertion.

import { STRIP_CAP, type StripDay } from './player-stats.ts';

/** Cell height and column gap, in px (brief 47). */
export const CELL_PX = 10;
export const GAP_PX = 4;
/** Room above the rows for a broken column's true figure. */
export const HEAD_PX = 14;
/** The rotated 13px "Goes" label is about 28px long; the rows area is never
 *  shorter than this, so one- and two-row strips do not push the label into the
 *  meta row below. */
export const MIN_AREA_PX = 32;

/** Rows = the worst day, capped at STRIP_CAP, at least 1 (brief 22). */
export function stripRows(days: StripDay[]): number {
  return Math.min(STRIP_CAP, Math.max(1, ...days.map((d) => d.goes)));
}

/** Height of the rows area. */
export function stripAreaPx(rows: number): number {
  return Math.max(rows * CELL_PX + (rows - 1) * GAP_PX, MIN_AREA_PX);
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
  return `Goes per day, your ${n} ${n === 1 ? 'day' : 'days'} played: ${parts}. Today: ${today}.`;
}

function attr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const MISS = '<span class="goes-strip__cell goes-strip__cell--miss"></span>';
const HIT = '<span class="goes-strip__cell goes-strip__cell--hit"></span>';
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

/** The whole strip, or '' for an empty list. */
export function goesStripHtml(days: StripDay[]): string {
  if (!days.length) return '';
  const areaH = stripAreaPx(stripRows(days));
  const n = days.length;
  return (
    '<div class="goes-strip" data-goes-strip>' +
    `<span class="goes-strip__y" aria-hidden="true" style="block-size: ${areaH}px">Goes</span>` +
    '<div class="goes-strip__col">' +
    '<div class="goes-strip__frame">' +
    `<div class="goes-strip__scroller" data-strip-scroller role="group" tabindex="0" aria-label="${attr(stripSummary(days))}">` +
    `<div class="goes-strip__inner" aria-hidden="true" style="block-size: ${areaH + GAP_PX + HEAD_PX}px">` +
    days.map((d) => column(d.goes)).join('') +
    '</div></div></div>' +
    '<div class="goes-strip__meta" aria-hidden="true">' +
    `<span>${n} ${n === 1 ? 'day' : 'days'}</span><span class="goes-strip__today">Today</span>` +
    '</div></div></div>'
  );
}
