// Daily-plays chart arithmetic. No DOM, no SQL, no rendering — everything here is
// a pure function so the geometry can be tested without a browser.
//
// COORDINATE SPACE, stated once because mixing two is the easiest way to get this
// wrong. All geometry below is in viewBox units. The SVG is
// `viewBox="0 0 600 240"` with `width: 100%`, so rendered pixels are
// `viewBox units × containerPx / 600`.
//
// The container is NOT 600px. `/stats` body is max-width 40rem with 1.5rem padding,
// so it is 592px on desktop and 327px on a 375px phone — a scale of ~0.99 and
// ~0.55. Every threshold here is sized for the 327px case, because a rule tuned on
// desktop under-thins text by ~1.8× on a phone, which is exactly how label
// collisions get shipped.

export const VIEW_W = 600;
export const VIEW_H = 240;
/** Left gutter for the y-axis labels. */
export const GUTTER = 32;
/** Height of the bar area; the remaining 24 units are the x-axis band. */
export const PLOT_H = 200;
export const PLOT_W = VIEW_W - GUTTER; // 568

/**
 * Width one x-axis label needs, in viewBox units.
 *
 * "5 Jul" in Inconsolata at 0.6875rem is ~40px, plus 8px separation = 48px. At the
 * mobile scale of 0.55 that is ~87 viewBox units. Doubles as the minimum separation
 * for the two direct bar labels.
 */
export const LABEL_W = 87;

const DAY_MS = 86_400_000;

export interface DayPoint {
  /** 'YYYY-MM-DD', UTC. */
  day: string;
  count: number;
}

export interface BarGeometry {
  /** Slot width per day. */
  pitch: number;
  /** Space between bars; collapses to 0 once slots get tight. */
  gap: number;
  /** Drawn bar width. */
  barWidth: number;
}

export function toISODay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function dayToMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/**
 * Expand sparse day rows into one entry per UTC day from `from` to `to` inclusive.
 *
 * A day with no events produces no row in SQL, so without this the chart would
 * silently compress a quiet week into a narrower, busier-looking one — the bars
 * would still be evenly spaced and nothing would look wrong.
 */
export function fillDaySeries(rows: DayPoint[], from: string, to: string): DayPoint[] {
  const counts = new Map(rows.map((r) => [r.day, r.count]));
  const out: DayPoint[] = [];
  const end = dayToMs(to);
  for (let ms = dayToMs(from); ms <= end; ms += DAY_MS) {
    const day = toISODay(ms);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

/**
 * Label every nth day on the x axis.
 *
 * Six labels is what the narrowest viewport fits (568 / 87). Sizing for desktop
 * would give 12 and overlap them on a phone.
 */
export function xLabelStep(days: number): number {
  return Math.max(1, Math.ceil(days / 6));
}

/**
 * Which day indexes carry an x-axis label.
 *
 * The last day is always labelled whatever the step lands on: the right-hand end
 * is the reader's anchor, and an unlabelled final bar makes the whole axis
 * ambiguous. A label the step would place adjacent to it is dropped instead.
 */
export function xLabelIndexes(days: number): number[] {
  if (days <= 0) return [];
  const step = xLabelStep(days);
  const last = days - 1;
  const pitch = PLOT_W / days;
  const out: number[] = [];
  for (let i = 0; i < last; i += step) {
    // Drop a stepped label that would land within one label-width of the
    // always-present last one. The step alone is not enough: at 30 days it puts a
    // label 4 slots from the end, which is 76 units — inside the 87 a label needs
    // on a phone, so the two would overlap there while looking fine on desktop.
    if ((last - i) * pitch >= LABEL_W) out.push(i);
  }
  out.push(last);
  return out;
}

/**
 * Bar sizing at a given day count.
 *
 * Fit-to-width, never horizontal scroll: scrolling hides the y axis, which is the
 * only thing giving the bars a scale. Past ~95 days the gaps collapse and the
 * chart reads as a filled silhouette — which is the correct read for a trend at
 * that range. At 7 days bars are capped at 24 units and centred in their slots
 * rather than left-packed, so a short range looks deliberate rather than broken.
 */
export function barGeometry(days: number): BarGeometry {
  if (days <= 0) return { pitch: 0, gap: 0, barWidth: 0 };
  const pitch = PLOT_W / days;
  const gap = pitch >= 6 ? 2 : 0;
  const barWidth = Math.min(24, pitch - gap);
  return { pitch, gap, barWidth };
}

/** Centre x of the slot for day `i`, in viewBox units. */
export function barCentre(i: number, geo: BarGeometry): number {
  return GUTTER + (i + 0.5) * geo.pitch;
}

export type Anchor = 'start' | 'middle' | 'end';

/**
 * Horizontal anchor for a label at x.
 *
 * Without this the max label overflows the viewBox at "All", where the newest bar
 * is very often the highest one.
 */
export function labelAnchor(x: number): Anchor {
  if (x > VIEW_W - 44) return 'end';
  if (x < GUTTER + 44) return 'start';
  return 'middle';
}

export interface DirectLabel {
  index: number;
  value: number;
  kind: 'max' | 'latest';
  x: number;
  anchor: Anchor;
}

/**
 * The 0–2 values written directly above bars: the highest, and the most recent.
 *
 * Two rules the design left open:
 *  - if they are the same bar, one label;
 *  - if the boxes would overlap, keep the max and drop the latest. The most recent
 *    bar is already anchored by the always-labelled last day on the x axis, so it
 *    is the one that can go without the reader losing their place.
 *
 * An all-zero series gets no labels: "0" floating above a flat baseline reads as a
 * broken chart rather than a quiet week.
 */
export function pickDirectLabels(series: DayPoint[]): DirectLabel[] {
  if (series.length === 0) return [];
  const geo = barGeometry(series.length);

  let maxIndex = 0;
  for (let i = 1; i < series.length; i++) {
    // >= so ties resolve to the most recent, which is the one a reader is looking for.
    if (series[i].count >= series[maxIndex].count) maxIndex = i;
  }
  if (series[maxIndex].count === 0) return [];

  const latestIndex = series.length - 1;
  const make = (index: number, kind: 'max' | 'latest'): DirectLabel => {
    const x = barCentre(index, geo);
    return { index, value: series[index].count, kind, x, anchor: labelAnchor(x) };
  };

  const max = make(maxIndex, 'max');
  if (latestIndex === maxIndex) return [max];

  const latest = make(latestIndex, 'latest');
  if (Math.abs(latest.x - max.x) < LABEL_W) return [max];
  return [max, latest];
}

export interface SeriesSummary {
  total: number;
  average: number;
  max: number;
  maxDay: string | null;
}

/** Figures the summary card and the chart's accessible description both need. */
export function summarise(series: DayPoint[]): SeriesSummary {
  if (series.length === 0) return { total: 0, average: 0, max: 0, maxDay: null };
  let total = 0;
  let maxIndex = 0;
  for (let i = 0; i < series.length; i++) {
    total += series[i].count;
    if (series[i].count > series[maxIndex].count) maxIndex = i;
  }
  return {
    total,
    average: Math.round((total / series.length) * 10) / 10,
    max: series[maxIndex].count,
    maxDay: series[maxIndex].count > 0 ? series[maxIndex].day : null,
  };
}

/** '2026-08-04' -> '4 Aug 2026'. Short form for axis labels drops the year. */
export function formatDay(day: string, opts: { year?: boolean } = {}): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = day.split('-').map(Number);
  const base = `${d} ${months[m - 1]}`;
  return opts.year === false ? base : `${base} ${y}`;
}
