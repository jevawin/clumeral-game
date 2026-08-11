// Stats dashboard rendering. The queries live in analytics-db.ts — this file is
// presentation only, so the chart maths can be unit-tested without a database and
// the SQL can be tested without parsing HTML.

import {
  GUTTER,
  LABEL_W,
  PLOT_H,
  PLOT_W,
  VIEW_H,
  VIEW_W,
  type DayPoint,
  barCentre,
  barGeometry,
  fillDaySeries,
  formatDay,
  pickDirectLabels,
  summarise,
  toISODay,
  xLabelIndexes,
} from './chart.ts';
import { type StatsRange, type StatsResult, rangeCutoff, startOfUTCDay } from './analytics-db.ts';

/** The dashboard interpolates a hostname taken from the request. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const BASELINE = PLOT_H; // y of the x axis
const LABEL_Y = BASELINE + 16;
// 3 units, not 1: the viewBox scales down to ~0.55 on a phone, where a 1-unit stub
// is half a pixel tall and effectively invisible — which is the failure this mark
// exists to prevent.
const ZERO_STUB_H = 3;

function plural(n: number): string {
  return n === 1 ? '1 play' : `${n} plays`;
}

/**
 * One bar as a path rather than a rect: the top corners are rounded and the
 * baseline corners are square, so bars sit on the axis instead of floating above
 * it. A rect with rx rounds all four.
 */
function barPath(x: number, w: number, h: number): string {
  const y = BASELINE - h;
  const r = Math.min(4, w / 2, h);
  if (r <= 0) return `M${x},${BASELINE} h${w} v0 h${-w} Z`;
  return [
    `M${x},${BASELINE}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${BASELINE}`,
    'Z',
  ].join(' ');
}

function round(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * The daily-plays chart.
 *
 * A zero day renders a short stub *below* the baseline rather than a sliver above
 * it. Above the line, the stub is invisible once bars touch — which happens past
 * ~95 days, i.e. at exactly the range "All time" exists for — and a zero day would
 * then look identical to a rendering bug. Below the line it reads as a tick on the
 * axis at every range.
 */
function renderChart(series: DayPoint[]): string {
  if (series.length === 0) {
    return `<p class="empty">No plays in this range</p>`;
  }

  const geo = barGeometry(series.length);
  const { max, average, maxDay } = summarise(series);
  const scaleMax = Math.max(1, max);

  const bars = series
    .map((d, i) => {
      const x = barCentre(i, geo) - geo.barWidth / 2;
      const title = `<title>${formatDay(d.day)}: ${plural(d.count)}</title>`;
      if (d.count === 0) {
        return `<rect class="zero" x="${round(x)}" y="${BASELINE}" width="${round(geo.barWidth)}" height="${ZERO_STUB_H}">${title}</rect>`;
      }
      const h = (d.count / scaleMax) * PLOT_H;
      return `<path class="bar" d="${barPath(x, geo.barWidth, h)}">${title}</path>`;
    })
    .join('');

  // 0, mid, max. Solid hairlines — a dashed gridline at this weight reads as a
  // dotted data series.
  //
  // The mid line's POSITION is derived from its value, not the other way round.
  // Drawing it at exactly half height and labelling it Math.round(scaleMax / 2)
  // makes the axis lie whenever scaleMax is odd: with a busiest day of 3, the
  // line labelled "2" sits at half height while the bar actually worth 2 tops out
  // a sixth of the plot higher. Single-digit maxima are precisely what PR 1 shows
  // until the backfill lands.
  //
  // It is dropped entirely when it would duplicate a value already on the axis —
  // a busiest day of 1 would otherwise label the axis "0 / 1 / 1".
  const mid = Math.round(scaleMax / 2);
  const fractions = mid === 0 || mid === scaleMax ? [0, 1] : [0, mid / scaleMax, 1];
  const gridlines = fractions
    .map((f) => {
      const y = BASELINE - f * PLOT_H;
      const value = Math.round(f * scaleMax);
      return (
        `<line class="grid" x1="${GUTTER}" y1="${round(y)}" x2="${VIEW_W}" y2="${round(y)}"/>` +
        `<text class="axis" x="${GUTTER - 6}" y="${round(y + 4)}" text-anchor="end">${value}</text>`
      );
    })
    .join('');

  const labelIdx = xLabelIndexes(series.length);
  const xLabels = labelIdx
    .map((i) => {
      // Pin a label to the plot edge only when centring it would push it out of
      // the viewBox. At 30+ days the outermost bars sit close enough to the edges
      // that the pin is necessary; at 2-5 days they do not, and pinning
      // unconditionally throws the label ~100 units away from the bar it names —
      // which is exactly the range /stats shows in the days after this merges.
      const centre = barCentre(i, geo);
      const isFirst = centre - LABEL_W / 2 < 0;
      const isLast = centre + LABEL_W / 2 > VIEW_W;
      const anchor = isLast ? 'end' : isFirst ? 'start' : 'middle';
      const px = isLast ? VIEW_W : isFirst ? GUTTER : centre;
      return `<text class="axis" x="${round(px)}" y="${LABEL_Y}" text-anchor="${anchor}">${formatDay(series[i].day, { year: false })}</text>`;
    })
    .join('');

  const direct = pickDirectLabels(series)
    .map((l) => {
      const h = (l.value / scaleMax) * PLOT_H;
      const y = Math.max(10, BASELINE - h - 5);
      return `<text class="direct" x="${round(l.x)}" y="${round(y)}" text-anchor="${l.anchor}">${l.value}</text>`;
    })
    .join('');

  const first = formatDay(series[0].day);
  const last = formatDay(series[series.length - 1].day);
  const summary =
    maxDay === null
      ? `Daily plays, ${first} to ${last}. No plays in this range.`
      : `Daily plays, ${first} to ${last}. Average ${average} per day, highest ${max} on ${formatDay(maxDay)}.`;

  // The chart is role="img" with a summary, and the full figures live in the
  // visually-hidden table below it. Individual bars are deliberately not
  // focusable: 365 tab stops to cross one chart is worse than no chart at all.
  return `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-label="${esc(summary)}" focusable="false">
        ${gridlines}${bars}${xLabels}${direct}
      </svg>
      <table class="visually-hidden">
        <caption>Daily plays, ${first} to ${last}</caption>
        <tr><th scope="col">Date</th><th scope="col">Plays</th></tr>
        ${series.map((d) => `<tr><td>${formatDay(d.day)}</td><td>${d.count}</td></tr>`).join('')}
      </table>`;
}

/** '2026-08-04' for the day the range ends on — today, in UTC. */
function rangeDays(stats: StatsResult, range: StatsRange, now: number): { from: string; to: string } | null {
  const to = toISODay(startOfUTCDay(now));
  if ('all' in range) {
    if (stats.firstTs === null) return null;
    return { from: toISODay(startOfUTCDay(stats.firstTs)), to };
  }
  return { from: toISODay(rangeCutoff(range, now) as number), to };
}

/**
 * Whole seconds as m:ss, or a dash when there is nothing to show.
 *
 * Deliberately a local copy of one rule rather than an import: src/worker/ must
 * not import client modules and vice versa (docs/CONVENTIONS.md, "Code
 * separation"). Hours are not formatted here — this is a mean across many games
 * and it will not reach one.
 */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '—';
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
}

function periodLabel(range: StatsRange, window: { from: string; to: string } | null): string {
  if (window === null) return 'All time · no data yet';
  const span = `${formatDay(window.from)} – ${formatDay(window.to)}`;
  if ('all' in range) {
    const days = Math.round((Date.parse(`${window.to}T00:00:00Z`) - Date.parse(`${window.from}T00:00:00Z`)) / 86_400_000) + 1;
    return `All time · ${span} · ${days} ${days === 1 ? 'day' : 'days'}`;
  }
  return `Last ${range.days} days · ${span}`;
}

const RANGES: { key: string; label: string; range: StatsRange }[] = [
  { key: '7', label: '7d', range: { days: 7 } },
  { key: '30', label: '30d', range: { days: 30 } },
  { key: '90', label: '90d', range: { days: 90 } },
  { key: 'all', label: 'All', range: { all: true } },
];

function isSameRange(a: StatsRange, b: StatsRange): boolean {
  if ('all' in a || 'all' in b) return 'all' in a && 'all' in b;
  return a.days === b.days;
}

export function renderDashboard(
  stats: StatsResult,
  range: StatsRange,
  hostname: string,
  now: number = Date.now(),
): string {
  const eventMap = new Map(stats.events.map((r) => [r.event, r.count]));

  const totalPlays = eventMap.get('puzzle_start') ?? 0;
  const completions = eventMap.get('puzzle_complete') ?? 0;
  const incorrectGuesses = eventMap.get('incorrect_guess') ?? 0;
  const completionRate = totalPlays > 0 ? ((completions / totalPlays) * 100).toFixed(1) : '0';
  const returningUsers = stats.uniqueUsers - stats.newUsers;
  // A dash rather than 0:00, so "nobody has sent one yet" is not read as
  // "everybody solves it instantly". Its own tiny formatter rather than an
  // import: the Worker must not import client modules (docs/CONVENTIONS.md).
  const avgTime = formatSeconds(stats.avgTimeSeconds);

  const window = rangeDays(stats, range, now);
  const dailyRows = stats.daily
    .filter((r) => r.event === 'puzzle_start')
    .map((r) => ({ day: r.day, count: r.count }));
  const series = window ? fillDaySeries(dailyRows, window.from, window.to) : [];
  const dailyAvg = summarise(series).average;

  const guessRows = stats.guessDistribution
    .map((row) => `<tr><td>${row.guesses}</td><td>${row.count}</td></tr>`)
    .join('');

  // Keyed on event|source, so an undo/reset row with a NULL source lands in no
  // row at all rather than being counted twice. Every such event carries one of
  // the two triggers today; if that ever changes the total will quietly shrink.
  const sourceMap = new Map(stats.sourceSplit.map((r) => [`${r.event}|${r.source}`, r.count]));

  // htp_dismissed and colour_change are deliberately absent: neither is in
  // VALID_EVENTS, so the Worker rejects them and both rows were permanently zero.
  // A row that can only ever read 0 is worse than no row — it looks like a feature
  // nobody uses.
  const interactions = [
    ['htp_opened', 'How to Play opened'],
    ['feedback_submitted', 'Feedback submitted'],
    ['theme_toggle', 'Theme toggled'],
    ['tooltip_opened', 'Tooltip opened'],
  ]
    .map(([key, label]) => `<tr><td>${label}</td><td>${eventMap.get(key) ?? 0}</td></tr>`)
    .concat(
      [
        ['undo_used|keyboard', 'Undo used (keyboard)'],
        ['undo_used|button', 'Undo used (button)'],
        ['reset_used|keyboard', 'Reset used (keyboard)'],
        ['reset_used|button', 'Reset used (button)'],
      ].map(([key, label]) => `<tr><td>${label}</td><td>${sourceMap.get(key) ?? 0}</td></tr>`),
    )
    .join('');

  const periodLinks = RANGES.map(({ key, label, range: r }) => {
    const active = isSameRange(r, range) ? ' class="active"' : '';
    return `<a href="/stats?period=${key}"${active}>${label}</a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Clumeral Stats</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Inconsolata:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root {
    color-scheme: light dark;
    --acc: light-dark(#bc3c2c, #ff8070);
    /* Axis and label ink. Contrast measured against both surfaces — see
       docs/ANALYTICS.md. Never --acc: colour is the bars' job, and reusing the
       accent on axis text makes the furniture look like data. */
    --ink: light-dark(#262624, #f6f0e8);
    --ink-muted: light-dark(rgba(38,38,36,0.72), rgba(246,240,232,0.68));
    /* Gridlines are supplementary — each carries its value as a text label and the
       exact figures are in the hidden table — so they are not held to 4.5:1. Lifted
       from 0.18/0.16 (1.41:1 / 1.72:1) because they were barely visible in light
       mode, not because they failed a rule. */
    --grid: light-dark(rgba(38,38,36,0.28), rgba(246,240,232,0.24));
  }
  :root.dark { color-scheme: dark; }
  :root.light { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Quicksand", system-ui, sans-serif;
    background: light-dark(#f5edd8, #262624);
    color: var(--ink);
    padding: 1.5rem;
    max-width: 40rem;
    margin: 0 auto;
  }
  h1 { font-size: 1.5rem; margin-block-end: 0.25rem; }
  .domain-label { font-family: "Inconsolata", monospace; font-size: 0.875rem; color: var(--ink-muted); margin-block-end: 0.5rem; }
  .period-label { color: var(--ink-muted); margin-block-end: 1rem; }
  .period-nav { display: flex; gap: 0.5rem; margin-block-end: 1.5rem; flex-wrap: wrap; }
  .period-nav a {
    font-family: "Inconsolata", monospace;
    font-weight: 700;
    font-size: 0.875rem;
    text-decoration: none;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    border: 1.5px solid light-dark(#bc3c2c, #ff8070);
    color: light-dark(#bc3c2c, #ff8070);
    background: transparent;
    transition: background 0.2s, color 0.2s;
  }
  .period-nav a.active,
  .period-nav a:hover {
    background: #bc3c2c;
    color: #fff;
  }
  .cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-block-end: 2.5rem; }
  .card {
    background: light-dark(#fffdf7, #2e2e2c);
    border-radius: 0.375rem;
    padding: 1rem;
    box-shadow: 3px 3px 0 light-dark(rgba(38,38,36,0.08), rgba(0,0,0,0.25));
    border: 1px solid light-dark(rgba(38,38,36,0.12), rgba(255,253,247,0.1));
  }
  .card__val { font-family: "Inconsolata", monospace; font-size: 2rem; font-weight: 700; }
  .card__label { font-size: 0.8125rem; color: var(--ink-muted); margin-block-start: 0.25rem; }
  section { margin-block-end: 2rem; }
  h2 { font-size: 1.125rem; margin-block-end: 1rem; }
  /* Fit-to-width, no horizontal scroll: scrolling the chart hides the y axis,
     which is the only thing giving the bars a scale. */
  .chart-wrap svg { display: block; width: 100%; height: auto; }
  .bar { fill: var(--acc); }
  /* A zero day: a short tick below the baseline, in ink rather than the accent,
     so it stays visible when neighbouring bars touch at long ranges. */
  .zero { fill: var(--ink-muted); }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .axis { fill: var(--ink-muted); font-family: "Inconsolata", monospace; font-size: 11px; }
  .direct { fill: var(--ink); font-family: "Inconsolata", monospace; font-size: 13px; font-weight: 700; }
  /* Text inside the SVG is drawn in viewBox units, and the viewBox scales with the
     container — so a size tuned on desktop shrinks with everything else. The
     container is 592px wide on desktop (scale ~0.99) but 327px on a 375px phone
     (scale ~0.55), where 11 units would render at 6px. These steps hold axis text
     at roughly 10-14 real pixels across the range, which is also the size the
     87-unit label budget in chart.ts assumes. */
  @media (max-width: 640px) { .axis { font-size: 14px; } .direct { font-size: 17px; } }
  @media (max-width: 480px) { .axis { font-size: 18px; } .direct { font-size: 21px; } }
  @media (max-width: 380px) { .axis { font-size: 20px; } .direct { font-size: 24px; } }
  .empty { color: var(--ink-muted); padding: 2rem 0; text-align: center; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  td, th { padding: 0.375rem 0.5rem; text-align: left; border-bottom: 1px solid light-dark(rgba(38,38,36,0.12), rgba(255,253,247,0.1)); }
  td:last-child, th:last-child { text-align: right; font-family: "Inconsolata", monospace; font-weight: 700; }
  .visually-hidden {
    position: absolute; width: 1px; height: 1px;
    margin: -1px; padding: 0; overflow: hidden;
    clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;
  }
</style>
</head>
<body>
  <h1>Clumeral Stats</h1>
  <p class="domain-label">${esc(hostname)}</p>
  <p class="period-label">${periodLabel(range, window)}</p>
  <nav class="period-nav">${periodLinks}</nav>

  <div class="cards">
    <div class="card"><div class="card__val">${stats.uniqueUsers}</div><div class="card__label">Unique users</div></div>
    <div class="card"><div class="card__val">${stats.newUsers}</div><div class="card__label">New users</div></div>
    <div class="card"><div class="card__val">${returningUsers}</div><div class="card__label">Returning</div></div>
    <div class="card"><div class="card__val">${totalPlays}</div><div class="card__label">Puzzles played</div></div>
    <div class="card"><div class="card__val">${completions}</div><div class="card__label">Completed</div></div>
    <div class="card"><div class="card__val">${completionRate}%</div><div class="card__label">Completion rate</div></div>
    <div class="card"><div class="card__val">${dailyAvg}</div><div class="card__label">Avg daily plays</div></div>
    <div class="card"><div class="card__val">${incorrectGuesses}</div><div class="card__label">Incorrect guesses</div></div>
    <div class="card"><div class="card__val">${avgTime}</div><div class="card__label">Avg time to complete</div></div>
  </div>

  <section>
    <h2>Daily plays</h2>
    <div class="chart-wrap">
      ${renderChart(series)}
    </div>
  </section>

  <section>
    <h2>Guess distribution</h2>
    <table>
      <tr><th>Guesses</th><th>Count</th></tr>
      ${guessRows || "<tr><td colspan='2'>No data yet</td></tr>"}
    </table>
  </section>

  <section>
    <h2>Interactions</h2>
    <table>
      <tr><th>Event</th><th>Count</th></tr>
      ${interactions}
    </table>
  </section>

  <script>
    const theme = localStorage.getItem('dlng_theme');
    if (theme) document.documentElement.classList.add(theme);
  </script>
</body>
</html>`;
}
