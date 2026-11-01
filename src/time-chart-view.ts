// Clumeral — time-chart-view.ts
// The "Daily leaderboard" card on /solved: the reserved slot, the fetch, the DOM and
// the measuring. The maths, copy and layout arithmetic are in time-chart.ts and
// pure; this file only puts their answers on screen (time chart brief items 38,
// 39).
//
// The card is a garnish, not the game. It arrives after a fetch, into a slot the
// panel reserved when it rendered, and a failure of any kind collapses the slot
// with no error and no retry (items 23, 54, 57).

import {
  buildField,
  geometry,
  labelTime,
  layout,
  rankCopy,
  refsFit,
  dotSizes,
  ranking,
  spokenSummary,
  TRACK_INSET,
  type FieldRow,
  type Geometry,
} from './time-chart.ts';

export interface TimeChartContext {
  puzzleNum: number;
  seconds: number;
  sendUid: boolean;
}

const FETCH_TIMEOUT_MS = 5000;
const HEAD_ID = 'stat-head-daily-leaderboard';

let uid = '';
let ctx: TimeChartContext | null = null;
// Each visit bumps this, and a response is drawn only if it is still current, so
// a slow first visit cannot overwrite a second one (plan D8).
let visit = 0;
let observer: ResizeObserver | null = null;
// Preview-only: the Testing panel swaps the fetched field for a preset
// (testing-panel.ts, brief item 127). Null everywhere else, and never set on
// clumeral.com.
let fieldOverride: ((yours: number) => FieldRow[] | 'fail' | null) | null = null;

/** Called once from app.ts, which owns the analytics uid (plan D6). */
export function initTimeChart(opts: { uid: string }): void {
  uid = opts.uid;
}

/** The reserved, empty slot. Inserted by renderCompletion. aria-labelledby is set
 *  only once drawn, so it never points at a heading that does not exist. */
export function timeChartSlot(): string {
  return '<section data-stat-block="daily-leaderboard" data-time-chart class="stat-block" aria-busy="true"></section>';
}

/** The Testing panel's hook. Returning null falls through to the real fetch. */
export function setFieldOverride(fn: typeof fieldOverride): void {
  fieldOverride = fn;
}

/** Set by renderCompletion; null means no card this render. */
export function setTimeChartContext(next: TimeChartContext | null): void {
  ctx = next;
}

/**
 * Called on every screens:enter for the completion screen — one visit (item 93).
 * The context is set only for item 46's modes, so this is also the mode check:
 * a random solve's screens:enter fetches nothing and sends nothing (item 121).
 *
 * On a revisit the old drawing stays, marked busy, while the new fetch runs,
 * rather than flashing blank on every in-app return (plan D9).
 */
export function showTimeChart(): void {
  const slot = document.querySelector<HTMLElement>('[data-time-chart]');
  if (!ctx || !slot) return;
  const current = ++visit;
  const c = ctx;
  slot.setAttribute('aria-busy', 'true');
  slot.hidden = false;
  const preset = fieldOverride?.(c.seconds) ?? null;
  const rowsP = preset === null ? fetchField(c) : Promise.resolve(preset === 'fail' ? null : preset);
  void rowsP.then((rows) => {
    if (current !== visit || !slot.isConnected) return;
    if (rows) draw(slot, c, rows);
    else fail(slot);
  });
}

/** The field's rows, or null on any failure — a status, a network error, the
 *  timeout, or a body whose `times` is not an array (plan D7, D16). */
async function fetchField(c: TimeChartContext): Promise<FieldRow[] | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
  try {
    // The uid goes only when today's time was sent, so the server can leave the
    // player's own row out; their dot is added locally either way (items 91,
    // 110). A header, never the URL, so it stays out of logs (item 118).
    const res = await fetch(`/api/times/${c.puzzleNum}`, {
      cache: 'no-store',
      signal: abort.signal,
      ...(c.sendUid && { headers: { 'X-Clumeral-Uid': uid } }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { times?: unknown };
    return Array.isArray(body?.times) ? (body.times as FieldRow[]) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function report(source: 'drawn' | 'failed', value: number): void {
  // Through the router's bridge, so this module never imports app.ts (plan D5).
  document.dispatchEvent(
    new CustomEvent('analytics:track', { detail: { event: 'time_chart', source, value } }),
  );
}

function label(cls: string, data: string, word: string, time: string, timeFirst: boolean): string {
  const w = `<span class="time-chart__w">${word}</span>`;
  const t = `<span class="time-chart__t">${time}</span>`;
  return `<div class="${cls}" ${data}>${timeFirst ? t + w : w + t}</div>`;
}

function draw(slot: HTMLElement, c: TimeChartContext, rows: FieldRow[]): void {
  observer?.disconnect();
  observer = null;

  const field = buildField(rows, c.seconds);
  const g = geometry(field);
  const copy = rankCopy(ranking(field));

  // Every string below is generated from numbers or fixed words, so innerHTML
  // takes no outside text.
  const dots = g.dots
    .map((d) => {
      const cls = d.mine ? 'time-chart__dot time-chart__dot--you' : 'time-chart__dot';
      // The same inset span the labels use (trackX), in CSS so it needs no
      // re-layout when the track resizes.
      const left = `calc(${TRACK_INSET}px + ${d.fraction.toFixed(4)} * (100% - ${2 * TRACK_INSET}px))`;
      return `<span class="${cls}" data-tc-dot style="left: ${left}"></span>`;
    })
    .join('');
  // Below the axis the time is nearest the line, so it comes first; above it,
  // your time comes second for the same reason.
  const refs = g.refs
    .map(
      (r) =>
        label('time-chart__below', 'data-tc-ref', r.word, labelTime(r.seconds), true) +
        '<span class="time-chart__lead time-chart__lead--down" data-tc-ref-lead></span>',
    )
    .join('');

  slot.innerHTML = `<h3 id="${HEAD_ID}" class="stat-block__head"><svg class="stat-block__icon" aria-hidden="true"><use href="/sprites.svg#icon-podium"/></svg>Daily leaderboard</h3>
    <p class="time-chart__line">${copy.pre}<b>${copy.bold}</b>${copy.post}</p>
    <p class="sr-only">${spokenSummary(field, g)}</p>
    <div class="time-chart__track" data-time-chart-track aria-hidden="true">
      <div class="time-chart__axis"></div>
      <span class="time-chart__note" data-tc-note aria-hidden="true">— log scale</span>
      ${refs}
      ${dots}
      ${label('time-chart__above', 'data-tc-you', 'You', labelTime(g.you.seconds), false)}
      <span class="time-chart__lead time-chart__lead--up" data-tc-you-lead></span>
    </div>`;

  slot.setAttribute('aria-labelledby', HEAD_ID);
  slot.removeAttribute('aria-busy');

  const track = slot.querySelector<HTMLElement>('[data-time-chart-track]')!;
  place(slot, track, g);
  // The track's height is in rem, so text zoom resizes it and fires this, as
  // does any width change (plan D10). The labels are observed too: the web font
  // can swap in after the first measure, widening every label without touching
  // the track. place() moves boxes and never resizes them, so this cannot loop.
  observer = new ResizeObserver(() => place(slot, track, g));
  observer.observe(track);
  for (const el of slot.querySelectorAll('[data-tc-ref], [data-tc-you], [data-tc-note]')) observer.observe(el);

  report('drawn', field.n);
}

const FLEX = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;

/** Measure the rendered labels and position them (item 50), and size the dots
 *  for this track's width (item 131). Dots are placed in CSS in draw(). */
function place(slot: HTMLElement, track: HTMLElement, g: Geometry): void {
  const width = track.clientWidth;
  // Not laid out (the screen is hidden): nothing to measure, and the observer
  // fires again when it is.
  if (!width) return;

  const refBoxes = [...track.querySelectorAll<HTMLElement>('[data-tc-ref]')];
  const refLeads = [...track.querySelectorAll<HTMLElement>('[data-tc-ref-lead]')];
  const youBox = track.querySelector<HTMLElement>('[data-tc-you]')!;
  const youLead = track.querySelector<HTMLElement>('[data-tc-you-lead]')!;
  const note = slot.querySelector<HTMLElement>('[data-tc-note]')!;

  // 15px labels, stepped down to 12px only when the references cannot sit side
  // by side at full size (items 125, 130). Measured at full size every time, so
  // the choice follows a text-size or width change both ways. The rows keep
  // their height either way, so stepping down moves nothing vertically.
  slot.classList.remove('time-chart--tight');
  const fullWidths = refBoxes.map((b) => b.getBoundingClientRect().width);
  if (!refsFit(fullWidths, width)) slot.classList.add('time-chart--tight');

  const sizes = dotSizes(g, width);
  track.querySelectorAll<HTMLElement>('[data-tc-dot]').forEach((dot, k) => {
    dot.style.inlineSize = dot.style.blockSize = `${sizes[k]}px`;
    // A 1.5px ring on a 5px dot leaves a 2px speck, so small dots get 1px.
    dot.style.borderWidth = sizes[k] < 11 ? '1px' : '';
  });

  const out = layout({
    track: width,
    geometry: g,
    refWidths: refBoxes.map((b) => b.getBoundingClientRect().width),
    youWidth: youBox.getBoundingClientRect().width,
    noteWidth: note.getBoundingClientRect().width,
  });

  out.refs.forEach((box, k) => {
    refBoxes[k].style.left = `${box.left}px`;
    refBoxes[k].style.alignItems = FLEX[box.align];
    refLeads[k].style.left = `${box.at}px`;
  });
  youBox.style.left = `${out.you.left}px`;
  youBox.style.alignItems = FLEX[out.you.align];
  youLead.style.left = `${out.you.at}px`;

  note.classList.remove('time-chart__note--left', 'time-chart__note--right', 'time-chart__note--below');
  // The note is the axis's key, not a label on a mark, so it carries no leader
  // (Jamie, 2026-11-01, brief item 124).
  if (out.note === 'below') {
    // Idea-R's caption: centred under the chart (item 122).
    if (note.parentElement !== slot) track.after(note);
  } else if (note.parentElement !== track) {
    track.append(note);
  }
  note.classList.add(`time-chart__note--${out.note}`);
}

function fail(slot: HTMLElement): void {
  observer?.disconnect();
  observer = null;
  slot.innerHTML = '';
  slot.hidden = true;
  slot.removeAttribute('aria-busy');
  slot.removeAttribute('aria-labelledby');
  report('failed', 0);
}
