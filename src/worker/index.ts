// Worker entry point — intercepts GET / and /random to inject puzzle data into HTML.

import { runFilterLoop, makeRng, dateSeedInt, todayLocal, puzzleNumber } from './puzzle.ts';
import { getStats, renderDashboard } from './stats.ts';

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  ANALYTICS: AnalyticsEngineDataset;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

const VALID_EVENTS = new Set([
  'puzzle_start', 'puzzle_complete', 'incorrect_guess',
  'htp_opened', 'htp_dismissed', 'feedback_submitted',
  'theme_toggle', 'colour_change', 'tooltip_opened',
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const today = todayLocal();
      const rng = makeRng(dateSeedInt(today));
      const { answer, clues } = runFilterLoop(rng);
      const puzzleData = { date: today, puzzleNumber: puzzleNumber(today), answer, clues };

      // Fetch static index.html from Pages assets, inject puzzle data before </head>
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
      const html = await assetRes.text();
      const injected = html.replace(
        '</head>',
        `<script>window.PUZZLE_DATA=${JSON.stringify(puzzleData)}</script></head>`
      );

      return new Response(injected, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (request.method === 'GET' && url.pathname === '/random') {
      try {
        const seed = Math.floor(Math.random() * 0xFFFFFFFF);
        const rng = makeRng(seed);
        const { answer, clues } = runFilterLoop(rng);
        const puzzleData = { isRandom: true, answer, clues };

        const assetRes = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
        const html = await assetRes.text();
        const injected = html.replace(
          '</head>',
          `<script>window.PUZZLE_DATA=${JSON.stringify(puzzleData)}</script></head>`
        );

        return new Response(injected, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        return new Response(`/random error: ${e.message}\n${e.stack}`, { status: 500 });
      }
    }

    // POST /api/event — record an analytics event
    if (request.method === 'POST' && url.pathname === '/api/event') {
      try {
        const body = await request.json() as { event?: string; uid?: string; value?: number; newUser?: boolean; source?: string };
        const { event, uid, value, newUser, source } = body;
        if (!event || !VALID_EVENTS.has(event) || !uid) {
          return new Response('Bad request', { status: 400 });
        }
        env.ANALYTICS.writeDataPoint({
          indexes: [event],
          blobs: [event, uid, source ?? ''],
          doubles: [value ?? 0, newUser ? 1 : 0],
        });
        return new Response('ok', { status: 202 });
      } catch {
        return new Response('Bad request', { status: 400 });
      }
    }

    // GET /api/stats — JSON stats data
    if (request.method === 'GET' && url.pathname === '/api/stats') {
      try {
        if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
          return new Response('Analytics secrets not configured', { status: 503 });
        }
        const days = Math.min(Number(url.searchParams.get('period') || 90), 90);
        const stats = await getStats(env, days);
        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
        });
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        return new Response(`Stats error: ${e.message}`, { status: 500 });
      }
    }

    // GET /stats — rendered dashboard
    if (request.method === 'GET' && url.pathname === '/stats') {
      try {
        if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
          return new Response('Analytics secrets not configured. Set CF_ACCOUNT_ID and CF_API_TOKEN as Worker secrets.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
        const days = Number(url.searchParams.get('period') || 0);
        const stats = await getStats(env, days > 0 ? Math.min(days, 90) : 0);
        const html = renderDashboard(stats, days > 0 ? Math.min(days, 90) : 0);
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

    return env.ASSETS.fetch(request);
  },
};
