// _worker.js — Cloudflare Pages Advanced Mode Worker
// Intercepts GET / to inject today's puzzle data into the HTML.
// All other requests (style.css, app.js, puzzle.js, etc.) are served from Pages assets.

import { runFilterLoop, makeRng, dateSeedInt, todayLocal, puzzleNumber } from './puzzle.js';

export default {
  async fetch(request, env) {
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
    }

    return env.ASSETS.fetch(request);
  },
};
