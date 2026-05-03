// src/route-resolver.ts — pure route resolver. No side effects, no I/O.

import type { HistoryEntry } from './types.ts';

export type Route =
  | { kind: 'welcome' }
  | { kind: 'play' }
  | { kind: 'solved' }
  | { kind: 'archive' }
  | { kind: 'archive-date'; date: string };

export interface ResolveCtx {
  hasData: boolean; // any dlng_* storage key present
  todayEntry: HistoryEntry | null;
  todayLocal: string; // YYYY-MM-DD
  midInteraction: boolean; // ignored here; the router uses it for stale-day skip
}

const ARCHIVE_DATE_RE = /^\/archive\/(\d{4}-\d{2}-\d{2})$/;

export function isValidDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const ms = new Date(d + 'T00:00:00Z').getTime();
  if (Number.isNaN(ms)) return false;
  // Round-trip check rejects values like 2026-02-31.
  const round = new Date(ms).toISOString().slice(0, 10);
  return round === d;
}

export function resolveRoute(path: string, ctx: ResolveCtx): Route {
  // /play redirect rules (RTE-03)
  if (path === '/play' && !ctx.hasData) return { kind: 'welcome' };
  if (path === '/play' && ctx.todayEntry) return { kind: 'solved' };

  // /solved redirect rules (RTE-03)
  if (path === '/solved' && !ctx.todayEntry) return { kind: 'welcome' };

  // /archive/<date> validation (ARC-03)
  const m = path.match(ARCHIVE_DATE_RE);
  if (m) {
    const d = m[1];
    if (!isValidDate(d) || d > ctx.todayLocal) return { kind: 'archive' };
    return { kind: 'archive-date', date: d };
  }

  // Any other /archive/* subpath (malformed date, garbage) → archive list (ARC-03).
  if (path === '/archive' || path.startsWith('/archive/')) return { kind: 'archive' };
  if (path === '/welcome') return { kind: 'welcome' };
  if (path === '/play') return { kind: 'play' };
  if (path === '/solved') return { kind: 'solved' };

  // Root or unknown — fall back to welcome.
  return { kind: 'welcome' };
}
