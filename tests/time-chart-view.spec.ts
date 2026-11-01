// The time chart's slot, fetch and DOM (time chart brief items 23, 25, 30, 65, 68,
// 71, 77, 91, 93, 110, 118, 121). jsdom has no layout, so this tests structure and
// flow, not pixels — the e2e spec measures the real boxes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HistoryEntry } from '../src/types.ts';

const TODAY = '2026-08-10';
const NUM = 157;
const UID = 'uid-under-test';

function setupDOM(): void {
  document.body.innerHTML = `
    <div data-completion-octo></div>
    <h2 data-completion-heading></h2>
    <p data-completion-subheading></p>
    <div data-completion-panel></div>
    <p data-completion-live></p>
    <p data-completion-countdown></p>
    <button data-completion-feedback></button>
    <div data-completion-links></div>
  `;
}

type Call = { url: string; init: RequestInit & { headers?: Record<string, string> } };
let calls: Call[];
let respond: (call: Call) => Promise<unknown>;
let tracked: { event: string; source?: string; value?: number }[];
let observers: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[];
// vi.resetModules gives every test a fresh completion.ts, but each one adds its
// screens:enter listener to the same document. Recorded here and removed after
// each test, or every earlier test's modules would answer this test's events.
let added: [string, EventListenerOrEventListenerObject][];
const realAdd = document.addEventListener.bind(document);

const ok = (times: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => ({ times }) });

beforeEach(() => {
  setupDOM();
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
  localStorage.clear();
  added = [];
  document.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: unknown) => {
    added.push([type, fn]);
    realAdd(type, fn, o as AddEventListenerOptions);
  }) as typeof document.addEventListener;
  calls = [];
  tracked = [];
  observers = [];
  respond = () => ok([{ second: 30, count: 1 }, { second: 90, count: 1 }]);
  vi.stubGlobal('fetch', vi.fn((url: string, init: Call['init']) => {
    const call = { url, init };
    calls.push(call);
    return respond(call);
  }));
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor() { observers.push(this); }
  });
  document.addEventListener('analytics:track', onTrack);
});

afterEach(() => {
  for (const [type, fn] of added) document.removeEventListener(type, fn);
  document.addEventListener = realAdd;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function onTrack(e: Event) {
  tracked.push((e as CustomEvent).detail);
}

async function render(
  history: HistoryEntry[],
  tries: number | null,
  opts: { seconds?: number; isRandom?: boolean; saveScore?: boolean } = {},
) {
  localStorage.setItem('dlng_history', JSON.stringify(history));
  localStorage.setItem('dlng_prefs', JSON.stringify({ saveScore: opts.saveScore ?? true }));
  const view = await import('../src/time-chart-view.ts');
  const completion = await import('../src/completion.ts');
  view.initTimeChart({ uid: UID });
  completion.renderCompletion(NUM, tries, opts.isRandom ?? false, { seconds: opts.seconds });
}

async function enter(screen = 'completion') {
  document.dispatchEvent(new CustomEvent('screens:enter', { detail: { screen } }));
  await vi.advanceTimersByTimeAsync(0);
}

const slot = () => document.querySelector<HTMLElement>('[data-time-chart]')!;
const recorded: HistoryEntry[] = [{ date: TODAY, tries: 2, seconds: 41 }];
const timeCalls = () => calls.filter((c) => c.url.startsWith('/api/times/'));

describe('when it fetches', () => {
  it('fetches once on entering the completion screen, and never on another screen', async () => {
    await render(recorded, 2, { seconds: 41 });
    await enter('game');
    expect(timeCalls()).toHaveLength(0);
    await enter();
    expect(timeCalls().map((c) => c.url)).toEqual([`/api/times/${NUM}`]);
  });

  // Item 121: a random solve's screens:enter fetches nothing and sends nothing.
  it('does nothing after a random solve', async () => {
    await render(recorded, 2, { seconds: 41, isRandom: true });
    await enter();
    expect(timeCalls()).toHaveLength(0);
    expect(tracked).toEqual([]);
  });

  it('fetches fresh on every visit', async () => {
    await render(recorded, 2, { seconds: 41 });
    await enter();
    await enter();
    expect(timeCalls()).toHaveLength(2);
  });

  // Plan D8: a slow first visit cannot overwrite a second one.
  it('ignores a slow response that lands after a newer visit', async () => {
    await render(recorded, 2, { seconds: 41 });
    let releaseFirst!: () => void;
    respond = () => new Promise((r) => { releaseFirst = () => r({ ok: true, json: async () => ({ times: [{ second: 5, count: 1 }] }) }); });
    await enter();
    respond = () => ok([{ second: 900, count: 1 }]);
    await enter();
    releaseFirst();
    await vi.advanceTimersByTimeAsync(0);
    const spoken = slot().querySelector('.sr-only')!.textContent!;
    expect(spoken).toContain('slowest 15 minutes');
    expect(spoken).not.toContain('5 seconds,');
  });
});

describe('the uid', () => {
  // Item 118: in a header, never the URL.
  it('travels in X-Clumeral-Uid and never in the URL', async () => {
    await render(recorded, 2, { seconds: 41 });
    await enter();
    const [call] = timeCalls();
    expect(call.url).not.toContain(UID);
    expect(call.init.headers?.['X-Clumeral-Uid']).toBe(UID);
    expect(call.init.cache).toBe('no-store');
  });

  // Items 91, 110: no time was sent on a saving-off solve, so no uid either.
  it('is not sent on a saving-off solve, whose time lives in memory only', async () => {
    await render([{ date: TODAY, tries: 0, marker: true }], 2, { seconds: 41, saveScore: false });
    await enter();
    expect(timeCalls()).toHaveLength(1);
    expect(timeCalls()[0].init.headers?.['X-Clumeral-Uid']).toBeUndefined();
  });

  // Items 110, 112: the row from the saving-on solve is still in the field.
  it('is sent for a saving-on solve viewed later with saving off', async () => {
    await render(recorded, 2, { seconds: 41, saveScore: false });
    await enter();
    expect(timeCalls()[0].init.headers?.['X-Clumeral-Uid']).toBe(UID);
  });
});

describe('a drawn card', () => {
  it('has a heading, the copy line, the spoken sentence and a hidden picture', async () => {
    await render(recorded, 2, { seconds: 41 });
    await enter();
    const s = slot();
    expect(s.querySelector('h3')!.textContent!.trim()).toBe('Daily leaderboard');
    expect(s.querySelector('.time-chart__line')!.textContent).toBe("You're the 2nd fastest");
    expect(s.querySelector('.time-chart__line b')!.textContent).toBe('2nd fastest');
    expect(s.querySelector('.sr-only')!.textContent).toBe(
      '3 players solved today. Fastest 30 seconds, median 41 seconds, slowest 1 minute 30 seconds. Yours: 41 seconds.',
    );
    expect(s.querySelector('[data-time-chart-track]')!.getAttribute('aria-hidden')).toBe('true');
    expect(s.hasAttribute('aria-busy')).toBe(false);
    expect(document.getElementById(s.getAttribute('aria-labelledby')!)).toBe(s.querySelector('h3'));
  });

  // Item 65: nothing on the card is interactive.
  it('has nothing focusable', async () => {
    await render(recorded, 2, { seconds: 41 });
    await enter();
    expect(slot().querySelectorAll('[tabindex], a, button')).toHaveLength(0);
  });

  it('labels your dot You and your compact time, and names the axis', async () => {
    await render(recorded, 2, { seconds: 41 });
    await enter();
    expect(slot().querySelector('[data-tc-you]')!.textContent).toBe('You41s');
    expect(slot().querySelector('[data-tc-note]')!.textContent).toBe('— log scale');
  });

  it('disconnects the previous visit\'s observer before drawing again', async () => {
    await render(recorded, 2, { seconds: 41 });
    await enter();
    expect(observers).toHaveLength(1);
    await enter();
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(observers).toHaveLength(2);
  });
});

describe('a failed fetch', () => {
  const cases: [string, () => Promise<unknown>][] = [
    ['a 500', () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a malformed body', () => ok('x')],
  ];

  it.each(cases)('collapses the slot on %s', async (_, r) => {
    respond = r;
    await render(recorded, 2, { seconds: 41 });
    await enter();
    expect(slot().hidden).toBe(true);
    expect(slot().innerHTML).toBe('');
    expect(slot().hasAttribute('aria-busy')).toBe(false);
  });

  // Plan D7: a hung request would otherwise leave the reserved gap open forever.
  it('collapses the slot after five seconds without an answer', async () => {
    respond = ({ init }) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    await render(recorded, 2, { seconds: 41 });
    await enter();
    expect(slot().hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(slot().hidden).toBe(true);
    expect(slot().hasAttribute('aria-busy')).toBe(false);
    expect(tracked).toEqual([{ event: 'time_chart', source: 'failed', value: 0 }]);
  });
});

describe('analytics', () => {
  it('sends one drawn event per visit with the field size', async () => {
    await render(recorded, 2, { seconds: 41 });
    await enter();
    await enter();
    expect(tracked).toEqual([
      { event: 'time_chart', source: 'drawn', value: 3 },
      { event: 'time_chart', source: 'drawn', value: 3 },
    ]);
  });

  it('sends a failed event with value 0', async () => {
    respond = () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    await render(recorded, 2, { seconds: 41 });
    await enter();
    expect(tracked).toEqual([{ event: 'time_chart', source: 'failed', value: 0 }]);
  });

  // Item 77: the event carries the field's size, nothing about their play.
  it('is sent for saving-off players too', async () => {
    await render([{ date: TODAY, tries: 0, marker: true }], 2, { seconds: 41, saveScore: false });
    await enter();
    expect(tracked).toEqual([{ event: 'time_chart', source: 'drawn', value: 3 }]);
  });
});

// da-build finding 5: a render with no card lets go of the last card's observer,
// so a replaced panel's slot is not kept alive.
it('disconnects the observer when a later render has no card', async () => {
  await render(recorded, 2, { seconds: 41 });
  await enter();
  expect(observers).toHaveLength(1);
  const completion = await import('../src/completion.ts');
  completion.renderCompletion(NUM, 2, true, { seconds: 41 });
  await enter();
  expect(observers[0].disconnect).toHaveBeenCalled();
});

// da-build finding 6: a Testing-panel preset is not a real field, so it sends no
// time_chart event.
it('sends no analytics for a preset field', async () => {
  await render(recorded, 2, { seconds: 41 });
  const view = await import('../src/time-chart-view.ts');
  view.setFieldOverride(() => [{ second: 30, count: 1 }]);
  await enter();
  expect(slot().querySelector('.time-chart__line')).not.toBeNull();
  expect(tracked).toEqual([]);
  view.setFieldOverride(() => 'fail');
  await enter();
  expect(slot().hidden).toBe(true);
  expect(tracked).toEqual([]);
});

// Item 30: nothing new is stored on the client.
it('writes no storage key', async () => {
  await render(recorded, 2, { seconds: 41 });
  const before = Object.keys(localStorage).sort();
  const beforeSession = Object.keys(sessionStorage).sort();
  await enter();
  expect(Object.keys(localStorage).sort()).toEqual(before);
  expect(Object.keys(sessionStorage).sort()).toEqual(beforeSession);
});
