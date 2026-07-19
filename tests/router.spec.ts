import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock screens.ts so showScreen calls can be asserted.
vi.mock('../src/screens.ts', () => ({
  showScreen: vi.fn(),
  initScreens: vi.fn(),
  getCurrentScreen: vi.fn(() => 'welcome'),
}));

import { navigate, replaceRoute, initRouter, pathFor, titleFor } from '../src/router.ts';
import { showScreen } from '../src/screens.ts';

function setPath(p: string): void {
  window.history.pushState(null, '', p);
}

beforeEach(() => {
  vi.clearAllMocks();
  setPath('/');
  // Default deps: data present, no today entry, today=2026-05-03, not mid-interaction.
  initRouter({
    hasData: () => true,
    todayLocal: () => '2026-05-03',
    todayEntry: () => null,
    midInteraction: () => false,
  });
});

describe('archive Show-puzzle deep link (#255)', () => {
  // /archive is Worker-rendered, so its Show-puzzle link is a full page load and
  // cannot pass skipResolve. Without the marker the RTE-03 rules bounced it to
  // /solved when today was already done, and to /welcome for a visitor with no
  // stored history — so the button did not do what it said.

  it('honours /play?from=archive when today is already solved', () => {
    setPath('/play?from=archive');
    initRouter({
      hasData: () => true,
      todayLocal: () => '2026-05-03',
      todayEntry: () => ({ date: '2026-05-03', tries: 3 }) as never,
      midInteraction: () => false,
    });
    expect(showScreen).toHaveBeenCalledWith('game');
    expect(location.pathname).toBe('/play');
  });

  it('honours /play?from=archive for a visitor with no stored history', () => {
    setPath('/play?from=archive');
    initRouter({
      hasData: () => false,
      todayLocal: () => '2026-05-03',
      todayEntry: () => null,
      midInteraction: () => false,
    });
    expect(showScreen).toHaveBeenCalledWith('game');
  });

  it('strips the marker so it does not persist in the URL', () => {
    setPath('/play?from=archive');
    initRouter({
      hasData: () => true,
      todayLocal: () => '2026-05-03',
      todayEntry: () => ({ date: '2026-05-03', tries: 3 }) as never,
      midInteraction: () => false,
    });
    expect(location.search).toBe('');
  });

  // The normal case for someone browsing /archive: they last opened the SPA on
  // an earlier day. The cold-load rollover redirect fires first and rewrites the
  // pathname to /welcome via replaceState, so a marker read after that point is
  // already gone. This is the case the other four tests here missed — they all
  // leave dlng_last_visit_date unset, which skips the rollover branch entirely.
  it('honours /play?from=archive when the last visit was a previous day', () => {
    localStorage.setItem('dlng_last_visit_date', '2026-05-02');
    setPath('/play?from=archive');
    initRouter({
      hasData: () => true,
      todayLocal: () => '2026-05-03',
      todayEntry: () => null,
      midInteraction: () => false,
    });
    expect(showScreen).toHaveBeenCalledWith('game');
    expect(location.pathname).toBe('/play');
  });

  // The exemption must not leak: a bare /play on a new day is still stale.
  it('still rollover-redirects a bare /play when the last visit was a previous day', () => {
    localStorage.setItem('dlng_last_visit_date', '2026-05-02');
    setPath('/play');
    initRouter({
      hasData: () => true,
      todayLocal: () => '2026-05-03',
      todayEntry: () => null,
      midInteraction: () => false,
    });
    expect(location.pathname).toBe('/welcome');
  });

  it('still redirects a bare /play deep link when today is solved', () => {
    setPath('/play');
    initRouter({
      hasData: () => true,
      todayLocal: () => '2026-05-03',
      todayEntry: () => ({ date: '2026-05-03', tries: 3 }) as never,
      midInteraction: () => false,
    });
    expect(showScreen).toHaveBeenCalledWith('completion');
    expect(location.pathname).toBe('/solved');
  });

  it('ignores the marker on any path other than /play', () => {
    setPath('/welcome?from=archive');
    initRouter({
      hasData: () => true,
      todayLocal: () => '2026-05-03',
      todayEntry: () => ({ date: '2026-05-03', tries: 3 }) as never,
      midInteraction: () => false,
    });
    expect(showScreen).toHaveBeenCalledWith('completion');
  });
});

describe('router (RTE-01, POL-01..04)', () => {
  it('RTE-01: navigate(/play) updates location.pathname to /play', () => {
    navigate('/play');
    expect(location.pathname).toBe('/play');
  });

  it('RTE-01: navigate(/play) calls showScreen("game")', () => {
    navigate('/play');
    expect(showScreen).toHaveBeenCalledWith('game');
  });

  it('RTE-01: popstate re-renders the route from location.pathname', () => {
    navigate('/play');
    (showScreen as ReturnType<typeof vi.fn>).mockClear();
    // Simulate browser back: change URL then dispatch popstate.
    window.history.pushState(null, '', '/welcome');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(showScreen).toHaveBeenLastCalledWith('welcome');
  });

  it('RTE-01: navigate(path, { skipResolve: true }) bypasses resolveRoute and still sets title + emits analytics', () => {
    // Today is unsolved — normally /play resolves to /play, but force skipResolve to prove the path is honoured verbatim.
    const handler = vi.fn();
    document.addEventListener('analytics:track', handler as EventListener);
    navigate('/play', { skipResolve: true });
    document.removeEventListener('analytics:track', handler as EventListener);
    expect(location.pathname).toBe('/play');
    expect(document.title).toBe('Clumeral · Play');
    const calls = handler.mock.calls.filter(([e]) => (e as CustomEvent).detail?.event === 'route_change');
    expect(calls.length).toBe(1);
    expect((calls[0][0] as CustomEvent).detail.source).toBe('/play');
  });

  it('RTE-03: replaceRoute(/solved) on solve uses history.replaceState not pushState', () => {
    const todayEntry = { date: '2026-05-03', tries: 2 };
    initRouter({
      hasData: () => true,
      todayLocal: () => '2026-05-03',
      todayEntry: () => todayEntry,
      midInteraction: () => false,
    });
    // Park location somewhere that requires an actual URL change so the test
    // can observe the replaceState call (initRouter's own redirects may have
    // already landed on /solved depending on the resolver's current rules).
    history.replaceState(null, '', '/play');
    const replaceSpy = vi.spyOn(history, 'replaceState');
    const pushSpy = vi.spyOn(history, 'pushState');
    replaceRoute('/solved');
    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('POL-01: navigate(/play) sets document.title to "Clumeral · Play"', () => {
    navigate('/play');
    expect(document.title).toBe('Clumeral · Play');
  });

  it('POL-01: navigate(/welcome) sets document.title to "Clumeral"', () => {
    navigate('/welcome');
    expect(document.title).toBe('Clumeral');
  });

  it('POL-01: navigate(/solved) sets document.title to "Clumeral · Solved"', () => {
    const todayEntry = { date: '2026-05-03', tries: 2 };
    initRouter({
      hasData: () => true,
      todayLocal: () => '2026-05-03',
      todayEntry: () => todayEntry,
      midInteraction: () => false,
    });
    navigate('/solved');
    expect(document.title).toBe('Clumeral · Solved');
  });

  it('POL-01: titleFor(/archive) is "Clumeral · Archive"', () => {
    expect(titleFor({ kind: 'archive' })).toBe('Clumeral · Archive');
    expect(pathFor({ kind: 'archive' })).toBe('/archive');
  });

  it('POL-02: navigate emits one route_change analytics event with the new path', () => {
    const handler = vi.fn();
    document.addEventListener('analytics:track', handler as EventListener);
    navigate('/play');
    document.removeEventListener('analytics:track', handler as EventListener);
    const calls = handler.mock.calls.filter(([e]) => (e as CustomEvent).detail?.event === 'route_change');
    expect(calls.length).toBe(1);
    expect((calls[0][0] as CustomEvent).detail.source).toBe('/play');
  });

  it('POL-02: navigate(/archive) calls navigator.sendBeacon BEFORE window.location.assign', async () => {
    // Stub sendBeacon and location.assign so we can observe call order without leaving the test page.
    // jsdom 25 makes window.location.assign non-configurable, so replace window.location itself.
    const beacon = vi.fn().mockReturnValue(true);
    const assign = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true, writable: true });
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign, pathname: originalLocation.pathname },
    });

    // emitAnalyticsBeacon bails without a uid (worker /api/event rejects uid-less payloads).
    localStorage.setItem('dlng_uid', 'test-uid');

    navigate('/archive');

    expect(beacon).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/archive');
    // Order assertion: invocationCallOrder is monotonically increasing per call across all vi mocks.
    const beaconOrder = beacon.mock.invocationCallOrder[0];
    const assignOrder = assign.mock.invocationCallOrder[0];
    expect(beaconOrder).toBeLessThan(assignOrder);

    // Beacon body must include event=route_change and source=/archive.
    const arg = beacon.mock.calls[0][1] as Blob | string;
    let text: string;
    if (typeof arg === 'string') {
      text = arg;
    } else if (typeof (arg as Blob).text === 'function') {
      text = await (arg as Blob).text();
    } else {
      // jsdom Blob fallback — read via Response.
      text = await new Response(arg as BodyInit).text();
    }
    expect(text).toContain('"event":"route_change"');
    expect(text).toContain('"source":"/archive"');

    // Restore window.location for subsequent tests.
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation });
    localStorage.removeItem('dlng_uid');
  });

  it('POL-03: initRouter sets history.scrollRestoration to "manual"', () => {
    // initRouter ran in beforeEach.
    expect(history.scrollRestoration).toBe('manual');
  });

  it('POL-04: stale-day check skips redirect while midInteraction is true', () => {
    const replaceSpy = vi.spyOn(history, 'replaceState');
    // User is on /solved with stale entry — but mid-interaction.
    setPath('/solved');
    let now = '2026-05-03';
    initRouter({
      hasData: () => true,
      todayLocal: () => now,
      todayEntry: () => null, // stale
      midInteraction: () => true,
    });
    replaceSpy.mockClear();
    now = '2026-05-04';
    // Fire visibilitychange — should be a no-op because midInteraction is true.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('POL-04: stale-day check is registered on visibilitychange + focus, not setInterval', async () => {
    // Read the source file and assert no polling exists.
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/router.ts', 'utf-8');
    expect(src).not.toMatch(/setInterval|setTimeout/);
    expect(src).toMatch(/addEventListener\('visibilitychange'/);
    expect(src).toMatch(/addEventListener\('focus'/);
  });
});
