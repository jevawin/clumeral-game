// Worker entry point — intercepts GET / and /random to inject puzzle data into HTML.

import { runFilterLoop, makeRng, dateSeedInt, todayLocal, puzzleNumber } from './puzzle.ts';

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
      } catch (err) {
        return new Response(`/random error: ${err.message}\n${err.stack}`, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
