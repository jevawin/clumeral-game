// Worker entry point — serves API routes for puzzle data and guess validation.
// The answer is never sent to the client.

import { runFilterLoop, makeRng, dateSeedInt, todayLocal, puzzleNumber, puzzleDate } from './puzzle.ts';
import { signToken, verifyToken } from './crypto.ts';
import { getStats, renderDashboard } from './stats.ts';
import { renderPuzzlesPage } from './puzzles.ts';

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  ANALYTICS: AnalyticsEngineDataset;
  PUZZLES: KVNamespace;
  HMAC_SECRET: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

interface StoredPuzzle {
  answer: number;
  clues: { propKey: string; label: string; operator: string; value: number | boolean }[];
  puzzleNumber: number;
}

const VALID_EVENTS = new Set([
  'puzzle_start', 'puzzle_complete', 'incorrect_guess',
  'htp_opened', 'htp_dismissed', 'feedback_submitted',
  'theme_toggle', 'colour_change', 'tooltip_opened',
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Puzzle generation + KV caching ──────────────────────────────────────────

async function getDailyPuzzle(env: Env, date: string): Promise<StoredPuzzle> {
  // Try KV first
  const cached = await env.PUZZLES.get<StoredPuzzle>(date, 'json');
  if (cached) return cached;

  // Generate and store
  const rng = makeRng(dateSeedInt(date));
  const { answer, clues } = runFilterLoop(rng);
  const puzzle: StoredPuzzle = { answer, clues, puzzleNumber: puzzleNumber(date) };
  await env.PUZZLES.put(date, JSON.stringify(puzzle));
  return puzzle;
}

// ─── Route handlers ──────────────────────────────────────────────────────────

async function handleGetPuzzle(env: Env): Promise<Response> {
  const today = todayLocal();
  const puzzle = await getDailyPuzzle(env, today);
  return json({
    date: today,
    puzzleNumber: puzzle.puzzleNumber,
    clues: puzzle.clues,
  });
}

async function handleGetRandomPuzzle(env: Env): Promise<Response> {
  const seed = Math.floor(Math.random() * 0xFFFFFFFF);
  const rng = makeRng(seed);
  const { clues } = runFilterLoop(rng);
  const token = await signToken(seed, env.HMAC_SECRET);
  return json({ isRandom: true, clues, token });
}

async function handleGuess(request: Request, env: Env): Promise<Response> {
  let body: { date?: string; token?: string; guess?: number };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { guess } = body;
  if (typeof guess !== 'number' || !Number.isInteger(guess) || guess < 100 || guess > 999) {
    return json({ error: 'Guess must be an integer between 100 and 999' }, 400);
  }

  // Random puzzle — verify token and re-derive answer
  if (body.token) {
    const seed = await verifyToken(body.token, env.HMAC_SECRET);
    if (seed === null) return json({ error: 'Invalid token' }, 400);

    const rng = makeRng(seed);
    const { answer } = runFilterLoop(rng);
    return json({ correct: guess === answer });
  }

  // Daily puzzle — look up from KV
  if (body.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return json({ error: 'Invalid date format' }, 400);
    }
    if (body.date > todayLocal()) {
      return json({ error: 'Cannot guess future puzzles' }, 400);
    }
    const puzzle = await getDailyPuzzle(env, body.date);
    return json({ correct: guess === puzzle.answer });
  }

  return json({ error: 'Provide either date or token' }, 400);
}

// ─── Main fetch handler ──────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── API routes ──

    if (request.method === 'GET' && url.pathname === '/api/puzzle') {
      return handleGetPuzzle(env);
    }

    if (request.method === 'GET' && url.pathname === '/api/puzzle/random') {
      return handleGetRandomPuzzle(env);
    }

    if (request.method === 'POST' && url.pathname === '/api/guess') {
      return handleGuess(request, env);
    }

    // GET /api/puzzle/:num — return clues for a specific puzzle number (no answer)
    const puzzleByNum = url.pathname.match(/^\/api\/puzzle\/(\d+)$/);
    if (request.method === 'GET' && puzzleByNum) {
      const num = parseInt(puzzleByNum[1], 10);
      if (num < 1) return json({ error: 'Invalid puzzle number' }, 400);
      const date = puzzleDate(num);
      if (date > todayLocal()) return json({ error: 'Puzzle not available yet' }, 400);
      const puzzle = await getDailyPuzzle(env, date);
      return json({ date, puzzleNumber: num, clues: puzzle.clues });
    }

    // Dev-only: return the answer for the current puzzle (blocked on production domain)
    if (request.method === 'GET' && url.pathname === '/api/dev/answer') {
      if (url.hostname === 'clumeral.com') return new Response('Not found', { status: 404 });
      const token = url.searchParams.get('token');
      if (token) {
        const seed = await verifyToken(token, env.HMAC_SECRET);
        if (seed === null) return json({ error: 'Invalid token' }, 400);
        const rng = makeRng(seed);
        const { answer } = runFilterLoop(rng);
        return json({ answer });
      }
      const today = todayLocal();
      const puzzle = await getDailyPuzzle(env, today);
      return json({ answer: puzzle.answer });
    }

    // ── Analytics ──

    if (request.method === 'POST' && url.pathname === '/api/event') {
      try {
        const body = await request.json() as { event?: string; uid?: string; value?: number; newUser?: boolean; source?: string };
        const { event, uid, value, newUser, source } = body;
        if (!event || !VALID_EVENTS.has(event) || !uid) {
          return new Response('Bad request', { status: 400 });
        }
        env.ANALYTICS.writeDataPoint({
          indexes: [event],
          blobs: [event, uid, source ?? '', url.hostname],
          doubles: [value ?? 0, newUser ? 1 : 0],
        });
        return new Response('ok', { status: 202 });
      } catch {
        return new Response('Bad request', { status: 400 });
      }
    }

    // ── Stats ──

    if (request.method === 'GET' && url.pathname === '/api/stats') {
      try {
        if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
          return new Response('Analytics secrets not configured', { status: 503 });
        }
        const days = Math.min(Number(url.searchParams.get('period') || 90), 90);
        const stats = await getStats(env, days, url.hostname);
        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
        });
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        return new Response(`Stats error: ${e.message}`, { status: 500 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/stats') {
      try {
        if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
          return new Response('Analytics secrets not configured. Set CF_ACCOUNT_ID and CF_API_TOKEN as Worker secrets.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
        const days = Math.min(Number(url.searchParams.get('period') || 90), 90) || 90;
        const stats = await getStats(env, days, url.hostname);
        const html = renderDashboard(stats, days, url.hostname);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'max-age=300' },
        });
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        return new Response(`Stats error: ${e.message}\n${e.stack}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    }

    // ── Puzzles ──

    // GET /puzzles — Worker-rendered puzzle history page
    if (request.method === 'GET' && url.pathname === '/puzzles') {
      const today = todayLocal();
      const todayNum = puzzleNumber(today);
      const keys = await env.PUZZLES.list();
      const puzzles = await Promise.all(
        keys.keys
          .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k.name) && k.name <= today)
          .map(async k => {
            const p = await env.PUZZLES.get<StoredPuzzle>(k.name, 'json');
            return p ? { num: p.puzzleNumber, date: k.name, clues: p.clues.length } : null;
          })
      );
      // Include today if not yet in KV
      const dates = new Set(keys.keys.map(k => k.name));
      if (!dates.has(today)) {
        const p = await getDailyPuzzle(env, today);
        puzzles.push({ num: todayNum, date: today, clues: p.clues.length });
      }
      const valid = puzzles.filter((p): p is NonNullable<typeof p> => p !== null);
      const html = renderPuzzlesPage(valid);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // GET /puzzles/:num — serve game HTML for replay
    if (request.method === 'GET' && /^\/puzzles\/\d+$/.test(url.pathname)) {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    }

    // ── Static pages ──

    // GET / and /random — serve static HTML (client fetches puzzle via API)
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/random')) {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    }

    return env.ASSETS.fetch(request);
  },

  // ── Cron: pre-generate today's puzzle at midnight UTC ──
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const today = todayLocal();
    await getDailyPuzzle(env, today);
  },
};
