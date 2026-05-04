// src/router.ts — client-side router. Owns history, title, analytics dispatch, scrollRestoration.
// Pure resolver lives in route-resolver.ts; this file is the imperative shell.

import { resolveRoute, type Route, type ResolveCtx } from './route-resolver.ts';
import { showScreen, type ScreenId } from './screens.ts';
import type { HistoryEntry } from './types.ts';


// ─── Path / title mapping ────────────────────────────────────────────────

export function pathFor(route: Route): string {
  switch (route.kind) {
    case 'welcome':      return '/welcome';
    case 'play':         return '/play';
    case 'solved':       return '/solved';
    case 'archive':      return '/archive';
    case 'archive-date': return `/archive/${route.date}`;
  }
}

export function titleFor(route: Route): string {
  switch (route.kind) {
    case 'welcome':      return 'Clumeral';
    case 'play':         return 'Clumeral · Play';
    case 'solved':       return 'Clumeral · Solved';
    case 'archive':      return 'Clumeral · Archive';
    case 'archive-date': return `Clumeral · ${route.date}`;
  }
}

function screenFor(route: Route): ScreenId | null {
  switch (route.kind) {
    case 'welcome':      return 'welcome';
    case 'play':         return 'game';
    case 'solved':       return 'completion';
    case 'archive-date': return 'game';
    case 'archive':      return null; // handed off to SSR page (location.assign)
  }
}

// Map a free-form path string back to a Route without hitting resolveRoute.
// Used only by navigate(path, { skipResolve: true }).
function routeFromPath(path: string): Route {
  if (path === '/welcome' || path === '/') return { kind: 'welcome' };
  if (path === '/play') return { kind: 'play' };
  if (path === '/solved') return { kind: 'solved' };
  if (path === '/archive') return { kind: 'archive' };
  const m = path.match(/^\/archive\/(\d{4}-\d{2}-\d{2})$/);
  if (m) return { kind: 'archive-date', date: m[1] };
  return { kind: 'welcome' };
}


// ─── Module state ────────────────────────────────────────────────────────

interface RouterDeps {
  hasData: () => boolean;
  todayLocal: () => string;
  todayEntry: () => HistoryEntry | null;
  midInteraction: () => boolean;
  onArchiveDate?: (date: string) => void;
}

let deps: RouterDeps | null = null;
let lastKnownDate = '';

function ctx(): ResolveCtx {
  if (!deps) throw new Error('router not initialized');
  return {
    hasData: deps.hasData(),
    todayEntry: deps.todayEntry(),
    todayLocal: deps.todayLocal(),
    midInteraction: deps.midInteraction(),
  };
}

function emitAnalytics(path: string): void {
  document.dispatchEvent(
    new CustomEvent('analytics:track', { detail: { event: 'route_change', source: path } })
  );
}

// POL-02: synchronous unload-safe analytics for /archive (full document load).
// Beacon survives document unload; the CustomEvent path does not.
function emitAnalyticsBeacon(path: string): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // Use string body — valid sendBeacon BodyInit, simpler than Blob, and easier to assert in jsdom tests.
      const body = JSON.stringify({ event: 'route_change', source: path });
      navigator.sendBeacon('/api/event', body);
    }
  } catch { /* swallow — analytics is non-critical */ }
}

function applyRoute(route: Route): void {
  // Order matters: title + analytics BEFORE screen flip (Pitfall 3 — view transitions race).
  document.title = titleFor(route);

  if (route.kind === 'archive') {
    // Fire beacon FIRST so the event survives the document unload triggered by location.assign.
    emitAnalyticsBeacon('/archive');
    // Also dispatch the in-page CustomEvent so dev/test listeners observe consistently.
    emitAnalytics('/archive');
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign('/archive');
    }
    return;
  }

  emitAnalytics(pathFor(route));

  const screen = screenFor(route);
  if (screen) showScreen(screen);

  if (route.kind === 'archive-date' && deps?.onArchiveDate) {
    deps.onArchiveDate(route.date);
  }
}


// ─── Public API ──────────────────────────────────────────────────────────

export interface NavigateOpts { replace?: boolean; skipResolve?: boolean }

export function navigate(path: string, opts: NavigateOpts = {}): void {
  const route = opts.skipResolve ? routeFromPath(path) : resolveRoute(path, ctx());
  const finalPath = pathFor(route);
  const method: 'pushState' | 'replaceState' =
    opts.replace || (!opts.skipResolve && finalPath !== path) ? 'replaceState' : 'pushState';

  if (typeof history !== 'undefined' && location.pathname !== finalPath) {
    history[method](null, '', finalPath);
  }
  applyRoute(route);
}

export function replaceRoute(path: string): void {
  navigate(path, { replace: true });
}

function checkStaleDay(): void {
  if (!deps) return;
  // POL-04 + RTE-03: skip mid-interaction.
  if (deps.midInteraction()) return;
  const real = deps.todayLocal();
  if (real === lastKnownDate) return;
  lastKnownDate = real;
  if (location.pathname === '/solved' && !deps.todayEntry()) {
    replaceRoute('/welcome');
  }
}

// localStorage key for the puzzle day the user last interacted with.
// On cold-load, if this is older than today, redirect to /welcome regardless of
// the requested path — the puzzle has rolled over and any prior /play/solved
// view is stale (D-rollover policy, surfaced from preview testing 2026-05-04).
const LAST_VISIT_KEY = 'cw-last-visit-date';

export function initRouter(d: RouterDeps): void {
  deps = d;
  const today = d.todayLocal();
  lastKnownDate = today;

  // Cold-load rollover redirect — runs before the first navigate so the user
  // never sees a stale /play or /solved screen briefly. Only triggers if the
  // user has a stored prior-visit date and it's older than today; first-time
  // visitors fall through to whatever route they requested.
  let coldRedirect: string | null = null;
  try {
    const prior = localStorage.getItem(LAST_VISIT_KEY);
    // /archive/* is a deliberate date-anchored deep-link — never rollover-redirect.
    const isArchive = location.pathname === '/archive' || location.pathname.startsWith('/archive/');
    if (prior && prior < today && location.pathname !== '/welcome' && !isArchive) {
      coldRedirect = '/welcome';
    }
    localStorage.setItem(LAST_VISIT_KEY, today);
  } catch { /* private mode — skip */ }

  // POL-03: set once at boot, before any navigation.
  try {
    history.scrollRestoration = 'manual';
  } catch { /* ignore — environments without History scrollRestoration */ }

  window.addEventListener('popstate', () => {
    // Browser already updated location — re-render only, never pushState here.
    const route = resolveRoute(location.pathname, ctx());
    applyRoute(route);
  });

  // Apply the cold-load rollover redirect if we computed one above.
  if (coldRedirect) {
    history.replaceState(null, '', coldRedirect);
  }

  // POL-04: visibility + focus only. No timer-based polling.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkStaleDay();
  });
  window.addEventListener('focus', checkStaleDay);

  // Initial render — also resolves any redirect on cold load.
  navigate(location.pathname || '/');
}
