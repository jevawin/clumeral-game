// The "Daily leaderboard" card's maths, copy and layout arithmetic — pure, no DOM,
// no fetch, so every rule is unit-testable on its own (time chart brief item 39).
// The DOM, the fetch and the measuring live in time-chart-view.ts.
//
// Ported from the Idea-O computation block (docs/work/2026-11-01-Idea-O-Time-vs-
// Everyone.dc.html, lines 403–575, item 104), with every item 105 and 115
// divergence changed to the brief's settled rule. Where the board and the brief
// disagree, the brief wins.
//
// TIME, NOT GOES. Goes cannot rank anybody — 88.1% of production completions are
// one-go, so almost everyone ties. Nobody ties on 2m 28s.

import { formatDuration, speakDuration } from './player-stats.ts';

export interface FieldRow {
  second: number;
  count: number;
}

export interface Field {
  /** Every time in the field including yours, ascending, whole seconds. */
  sorted: number[];
  /** second → how many players finished on it, yours included. */
  tally: Map<number, number>;
  yours: number;
  n: number;
}

const MAX_SECONDS = 86_400;

/** Strangers' rows (from the server, your uid already excluded) plus your own time,
 *  added once. Drops malformed rows: the server already drops times outside
 *  1–86400, and this guards the maths from malformed JSON (plan D16). */
export function buildField(rows: FieldRow[], yours: number): Field {
  const sorted: number[] = [];
  for (const r of rows) {
    const ok =
      Number.isInteger(r.second) && r.second >= 0 && r.second <= MAX_SECONDS &&
      Number.isInteger(r.count) && r.count > 0;
    if (!ok) continue;
    for (let k = 0; k < r.count; k++) sorted.push(r.second);
  }
  // Yours is the player's whole-second time and is never floored here.
  sorted.push(yours);
  sorted.sort((a, b) => a - b);
  const tally = new Map<number, number>();
  for (const t of sorted) tally.set(t, (tally.get(t) ?? 0) + 1);
  return { sorted, tally, yours, n: sorted.length };
}

/** Item 85: middle value at odd n; mean of the middle two, rounded, at even n. */
export function median(sorted: number[]): number {
  const mid = sorted.length / 2;
  return sorted.length % 2
    ? sorted[Math.floor(mid)]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Items 28 and 111, integer-first and capped at 99 (plan D17). `faster` is the
 *  count strictly faster than you. Integer-first because ceil(0.7 * 100) is 71:
 *  0.7 * 100 is 70.00000000000001. Never called for the strictly slowest, who
 *  reads item 60's line instead. */
export function percentile(faster: number, n: number): number {
  return Math.min(99, Math.ceil((100 * (faster + 1)) / n));
}

export type Ranking =
  | { kind: 'first' } //                                n = 1 (61)
  | { kind: 'fastest'; joint: boolean } //              n ≥ 2, nobody faster (88, 94)
  | { kind: 'ordinal'; rank: number; joint: boolean } // 2 ≤ n < 10 (56)
  | { kind: 'percentile'; pct: number } //              n ≥ 10, 1–99 (59, 111)
  | { kind: 'count'; n: number }; //                    n ≥ 10, strictly slowest (60)

/** Standard competition ranking: ties share the better rank (item 19). */
export function ranking(field: Field): Ranking {
  const { sorted, tally, yours, n } = field;
  const faster = sorted.filter((t) => t < yours).length;
  const joint = (tally.get(yours) ?? 0) > 1;
  if (n === 1) return { kind: 'first' };
  if (faster === 0) return { kind: 'fastest', joint };
  if (n < 10) return { kind: 'ordinal', rank: faster + 1, joint };
  // Strictly slowest only: a tie at the bottom has faster < n - 1.
  if (faster === n - 1) return { kind: 'count', n };
  return { kind: 'percentile', pct: percentile(faster, n) };
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** The copy line in three parts; the middle one is bold. "You're in the top X%"
 *  only parses when the figure IS a percentile, so the states that are not keep
 *  their own frame. Never the word "slowest" (item 56). */
export function rankCopy(r: Ranking): { pre: string; bold: string; post: string } {
  switch (r.kind) {
    case 'first':
      return { pre: "You're the ", bold: 'first', post: ' to solve today' };
    case 'fastest':
      return { pre: "You're the ", bold: r.joint ? 'joint fastest' : 'fastest', post: ' today' };
    case 'ordinal':
      return { pre: "You're the ", bold: `${r.joint ? 'joint ' : ''}${ordinal(r.rank)} fastest`, post: '' };
    case 'percentile':
      return { pre: "You're in the ", bold: `top ${r.pct}%`, post: ' of solve times' };
    case 'count':
      return { pre: '', bold: `${r.n} players`, post: ' solved today' };
  }
}

export interface Dot {
  fraction: number;
  /** Players who finished on this second; 0 for the median disc, which is not a player. */
  count: number;
  mine: boolean;
}
export interface Ref {
  word: 'Fastest' | 'Median' | 'Slowest';
  seconds: number;
  fraction: number;
  anchor: 'start' | 'center' | 'end';
}
export interface Geometry {
  dots: Dot[];
  refs: Ref[];
  you: { fraction: number; seconds: number };
}

const DOT = 13;
const DOT_MIN = 5;
const DOT_YOU_MIN = 11;
const DOT_MAX = 25;

/**
 * The base dot size: the axis length divided by the number of distinct seconds
 * on it, between 5px and 13px (Jamie, item 131). What crowds the axis is how
 * many dots share it, not how many people played, so a quiet day gets 13px dots
 * and a busy one shrinks towards 5px. A wider track keeps bigger dots longer.
 */
export function dotBase(distinct: number, track: number): number {
  const span = track - 2 * TRACK_INSET;
  return Math.min(DOT, Math.max(DOT_MIN, Math.round(span / Math.max(1, distinct))));
}

/**
 * Every dot's diameter in px, in geometry order. A shared second grows by AREA
 * in proportion to its count (base × √count), so size keeps meaning something on
 * a busy day instead of hitting the cap at four players, as +4px each did. All
 * capped at 25. Yours is 4px larger than a stranger's on the same count, and
 * never under 11, so it stays findable when the base shrinks (item 66).
 */
export function dotSizes(g: Geometry, track: number): number[] {
  const base = dotBase(g.dots.filter((d) => d.count > 0).length, track);
  return g.dots.map((d) => {
    const s = Math.min(DOT_MAX, base * Math.sqrt(Math.max(1, d.count)));
    return Math.round(d.mine ? Math.min(DOT_MAX, Math.max(DOT_YOU_MIN, s + 4)) : s);
  });
}

/** How far the ends of the axis are drawn in from the track's edges: half the
 *  largest dot, so an end dot sits whole inside the track and its leader runs to
 *  its centre rather than to the edge (item 128). */
export const TRACK_INSET = DOT_MAX / 2;

/** A fraction of the axis as px along a track `track` wide. */
export function trackX(fraction: number, track: number): number {
  return TRACK_INSET + fraction * (track - 2 * TRACK_INSET);
}

export function geometry(field: Field): Geometry {
  const { sorted, tally, yours, n } = field;
  // ln(0) is undefined, so 0 is placed at 1s (items 21, 87). A guard against a
  // junk row only: the server drops 0s, and a real sub-second solve is impossible.
  const p = (t: number) => Math.max(1, t);
  const lo = p(sorted[0]);
  const hi = p(sorted[n - 1]);
  // n = 1, or everyone on the same second.
  const flat = hi === lo;

  // NOTHING IS CLIPPED. The axis runs fastest to slowest, so the last dot IS the
  // slowest player (item 106). The cost is real: one very slow solve pushes
  // everyone else left.
  //
  // LOG, NOT LINEAR, and it was forced rather than chosen: on a linear axis one
  // 14m 52s day is 21x the fastest and every label overlaps. Play times are
  // log-normal. The trade: distance across the track is no longer seconds, so
  // every dot that matters carries its own printed time. The base cancels out
  // of the fraction (item 90).
  const lnLo = Math.log(lo);
  const lnSpan = Math.log(hi) - lnLo;
  const fraction = (t: number) => (flat ? 0.5 : (Math.log(p(t)) - lnLo) / lnSpan);

  // ONE DOT PER DISTINCT TIME. Its size depends on the track's width as well as
  // its count, so it is worked out at layout time by dotSizes (item 131).
  const dots: Dot[] = [...tally.keys()]
    .sort((a, b) => a - b)
    .map((t) => {
      const mine = t === yours;
      return { fraction: fraction(t), count: tally.get(t)!, mine };
    });

  // The median rides along as an ordinary disc, because the word below it names
  // it. Only from three finishers, since below that there is no median label for
  // it to belong to; and only when nobody finished on that second, or it would
  // stack a second dot on a person already there (item 85).
  const med = median(sorted);
  if (n >= 3 && !tally.has(med)) dots.push({ fraction: fraction(med), count: 0, mine: false });

  // WHICH REFERENCES EXIST DEPENDS ON HOW MANY HAVE FINISHED. With every dot on
  // one second, Median and Slowest would say the same thing three times, so a
  // flat field draws Fastest only, centred, at any n (item 115). Otherwise
  // Fastest, then Median from three, then Slowest. The leader for the fastest
  // arrives at its box's left edge and the slowest at its right, so those two
  // align to that edge; only the median is centred. Times are the true seconds.
  const refs: Ref[] = [];
  if (flat) {
    refs.push({ word: 'Fastest', seconds: sorted[0], fraction: 0.5, anchor: 'center' });
  } else {
    refs.push({ word: 'Fastest', seconds: sorted[0], fraction: 0, anchor: 'start' });
    if (n >= 3) refs.push({ word: 'Median', seconds: med, fraction: fraction(med), anchor: 'center' });
    refs.push({ word: 'Slowest', seconds: sorted[n - 1], fraction: 1, anchor: 'end' });
  }

  return { dots, refs, you: { fraction: fraction(yours), seconds: yours } };
}

export interface Box {
  left: number;
  width: number;
  align: 'start' | 'center' | 'end';
  at: number;
}
/** Where a label box starts for a leader at `at`. Corner-anchored boxes reach
 *  out by the inset, so at the axis ends they meet the track's edge. */
function boxLeft(align: Box['align'], at: number, width: number): number {
  if (align === 'start') return at - TRACK_INSET;
  if (align === 'end') return at - width + TRACK_INSET;
  return at - width / 2;
}

export interface Layout {
  refs: Box[];
  you: Box;
  note: 'left' | 'right' | 'below';
}

const GAP = 8;

/** Whether the reference labels, at the widths measured, sit side by side with
 *  their 8px gaps. Labels are 15px; when they do not fit — large text on a narrow
 *  phone — the view steps every label down to 12px (Jamie, item 125). */
export function refsFit(widths: number[], track: number): boolean {
  return widths.reduce((sum, w) => sum + w, 0) + GAP * (widths.length - 1) <= track;
}

/** Where each label box goes on a track `track` px wide, from measured widths
 *  (item 50). The label is placed to FIT; the leader line marks the TRUE
 *  position. Below the 288px content floor (item 96) the passes still run and
 *  leaders stay true, but labels may overlap. */
export function layout(input: {
  track: number;
  geometry: Geometry;
  refWidths: number[];
  youWidth: number;
  noteWidth: number;
}): Layout {
  const { track, geometry: g, refWidths, youWidth, noteWidth } = input;

  // A box hangs off whichever corner its leader arrives at, pushed out by the
  // inset so an end label is flush with the track's edge and its leader sits
  // just inside it, on the end dot (Jamie, item 129).
  const refs: Box[] = g.refs.map((r, k) => {
    const width = refWidths[k];
    const at = trackX(r.fraction, track);
    const left = boxLeft(r.anchor, at, width);
    return { left, width, align: r.anchor, at };
  });

  // Clamp into the track, then walk left to right pushing any label that has run
  // into the one before it, then walk back if that pushed the last off the end.
  // The loop variables are k and m, never i and j: on the board this block sat
  // inside a function whose parameter was `i`, and shadowing it silently wrote
  // every state into the wrong slot.
  for (const b of refs) b.left = Math.max(0, Math.min(track - b.width, b.left));
  for (let k = 1; k < refs.length; k++) {
    const minLeft = refs[k - 1].left + refs[k - 1].width + GAP;
    if (refs[k].left < minLeft) refs[k].left = minLeft;
  }
  for (let m = refs.length - 1; m > 0; m--) {
    if (refs[m].left + refs[m].width > track) {
      refs[m].left = track - refs[m].width;
      const maxLeft = refs[m].left - refs[m - 1].width - GAP;
      if (refs[m - 1].left > maxLeft) refs[m - 1].left = maxLeft;
    }
  }

  // YOU GO ABOVE THE AXIS, the references below it, so the two groups cannot
  // collide whatever your time is. Your label takes the same corner rule:
  // centred, it would be clamped at the edges, and a clamped box with centred
  // text leaves its own leader behind.
  const at = trackX(g.you.fraction, track);
  const align: Box['align'] =
    at - youWidth / 2 < 0 ? 'start' : at + youWidth / 2 > track ? 'end' : 'center';
  const left = boxLeft(align, at, youWidth);
  const you: Box = { left, width: youWidth, align, at };

  // THE FLIP RULE (Idea-R, items 48, 122): the note takes the top corner furthest
  // from your dot. When even that corner would touch your label — large text on a
  // narrow track — it drops to a caption below the chart instead.
  const corner = at < track / 2 ? 'right' : 'left';
  const clear =
    corner === 'right' ? track - noteWidth - (you.left + you.width) >= GAP : you.left - noteWidth >= GAP;

  return { refs, you, note: clear ? corner : 'below' };
}

/** Label text, compact form (item 63). */
export function labelTime(seconds: number): string {
  return formatDuration(seconds, { compact: true });
}

/** Item 113's visually hidden sentence. Everything the picture carries except
 *  its shape, in the order a sighted player reads it. Durations in words. */
export function spokenSummary(field: Field, g: Geometry): string {
  const { sorted, n, yours } = field;
  const yoursLine = `Yours: ${speakDuration(yours)}.`;
  if (n === 1) return `1 player solved today. ${yoursLine}`;
  const fastest = sorted[0];
  const slowest = sorted[n - 1];
  if (fastest === slowest) return `${n} players solved today, all in ${speakDuration(fastest)}. ${yoursLine}`;
  if (n === 2) {
    return `2 players solved today. Fastest ${speakDuration(fastest)}, slowest ${speakDuration(slowest)}. ${yoursLine}`;
  }
  const med = g.refs.find((r) => r.word === 'Median')?.seconds ?? median(sorted);
  return (
    `${n} players solved today. Fastest ${speakDuration(fastest)}, median ${speakDuration(med)}, ` +
    `slowest ${speakDuration(slowest)}. ${yoursLine}`
  );
}
