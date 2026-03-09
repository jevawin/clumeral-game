// worker.js — Cloudflare Worker entry point
// Runs the daily puzzle logic server-side and returns { date, puzzleNumber, answer, clues }

import { runFilterLoop, makeRng, dateSeedInt, todayLocal, puzzleNumber } from './puzzle.js';

export default {
  async fetch(request) {
    const today = todayLocal();
    const rng = makeRng(dateSeedInt(today));
    const { answer, clues } = runFilterLoop(rng);

    return Response.json(
      { date: today, puzzleNumber: puzzleNumber(today), answer, clues },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  },
};
