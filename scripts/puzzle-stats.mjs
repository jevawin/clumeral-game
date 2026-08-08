#!/usr/bin/env node
// puzzle-stats.mjs — measure the generator (#193).
//
//   node scripts/puzzle-stats.mjs [seeds]      (default 3000)
//
// Prints the clue-count spread, the redundancy check, the answer distribution,
// the retry counts, and a timing comparison of the old generator against the
// new one. Committed rather than thrown away after the pull request, so the
// numbers can be re-checked later instead of trusted from a PR body.
//
// EXITS NON-ZERO if any generated puzzle still has a removable clue. That is
// the invariant the whole change exists to hold, so this script can fail.
//
// THE BASELINE COMES FROM GIT. The old generator was `runFilterLoop`, which is
// now the private `drawClues` and deliberately unreachable — a bare "new"
// number cannot be judged, but a ratio can, so the script reads puzzle.ts as it
// stands on main, writes it to a temp directory, imports it, and removes it
// again. No repo file is touched and nothing is left behind. Node 22 imports
// TypeScript directly, so there is no build step and no dependency.
//
// The baseline draw is also injected into the new generator to count attempts,
// which double-checks the measurement: drawClues is runFilterLoop renamed, so
// the two must produce identical puzzles. The script asserts that on every seed
// and exits non-zero if they ever disagree.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  MAX_CLUES,
  MIN_CLUES,
  generatePuzzleFromRng,
  makeRng,
  trimRedundantClues,
} from '../src/worker/puzzle.ts';

const SEEDS = Number(process.argv[2] ?? 3000);
const REPO = resolve(import.meta.dirname, '..');

// How many times worse than the old generator the new one may be before this
// change goes back to Jamie and Dave rather than into a pull request. Measured
// at about 1.8x on 2026-08-08, so there is real headroom.
const SLOWDOWN_LIMIT = 3;

const pct = (n, of) => `${((n / of) * 100).toFixed(1)}%`;
const ms = n => `${n.toFixed(1)} ms`;
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

/** puzzle.ts as it stands on main, imported from a temp copy that is then removed. */
function loadBaseline() {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: REPO, encoding: 'utf8' }).trim();
  const src = execFileSync('git', ['show', `${base}:src/worker/puzzle.ts`], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 24 });
  const dir = mkdtempSync(join(tmpdir(), 'clumeral-baseline-'));
  const file = join(dir, 'puzzle.ts');
  writeFileSync(file, src);
  return { file, dir, base };
}

const { file, dir, base } = loadBaseline();
let baseline;
try {
  baseline = await import(pathToFileURL(file).href);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (typeof baseline.runFilterLoop !== 'function') {
  console.error(`No runFilterLoop in puzzle.ts at ${base} — the baseline is not what this script assumes.`);
  process.exit(2);
}

console.log(`Generating ${SEEDS} puzzles. Baseline: puzzle.ts at ${base.slice(0, 8)}.\n`);

// ─── Generate ─────────────────────────────────────────────────────────────────

const clueCounts = new Map();
const attemptCounts = [];
const answers = [];
let stillRedundant = 0;
let disagreements = 0;

for (let seed = 1; seed <= SEEDS; seed++) {
  const puzzle = generatePuzzleFromRng(makeRng(seed));

  let attempts = 0;
  const counted = generatePuzzleFromRng(makeRng(seed), rng => {
    attempts++;
    return baseline.runFilterLoop(rng);
  });
  if (JSON.stringify(counted) !== JSON.stringify(puzzle)) disagreements++;

  clueCounts.set(puzzle.clues.length, (clueCounts.get(puzzle.clues.length) ?? 0) + 1);
  attemptCounts.push(attempts);
  answers.push(puzzle.answer);
  if (trimRedundantClues(puzzle.clues).length !== puzzle.clues.length) stillRedundant++;
}

// ─── Clue counts ──────────────────────────────────────────────────────────────

console.log('Clue counts');
for (const n of [...clueCounts.keys()].sort((a, b) => a - b)) {
  const count = clueCounts.get(n);
  const flag = n < MIN_CLUES || n > MAX_CLUES ? '   ← outside the 4–6 range' : '';
  console.log(`  ${n} clues  ${String(count).padStart(6)}  ${pct(count, SEEDS).padStart(6)}${flag}`);
}

// ─── Redundancy ───────────────────────────────────────────────────────────────

console.log('\nRedundancy');
console.log(`  puzzles with a removable clue: ${stillRedundant}   (expected 0)`);
console.log(`  baseline draw and drawClues disagree: ${disagreements}   (expected 0)`);

// ─── Answer distribution — the four numbers from brief item 22 ────────────────

const distinct = new Set(answers).size;
const mean = answers.reduce((a, b) => a + b, 0) / answers.length;
const repeated = answers.filter(n => new Set(String(n)).size < 3).length;
const withZero = answers.filter(n => String(n).includes('0')).length;

console.log('\nAnswers');
console.log(`  distinct answers:      ${distinct} of the 900 possible`);
console.log(`  mean answer:           ${mean.toFixed(1)}`);
console.log(`  with a repeated digit: ${pct(repeated, SEEDS)}`);
console.log(`  containing a zero:     ${pct(withZero, SEEDS)}`);
console.log('  Compare against brief item 22. If any of these four moves by more than a');
console.log('  tenth of its value, it goes back to Dave before the pull request — item 23');
console.log('  is his signed-off judgement on the size of that shift.');

// ─── Retries ──────────────────────────────────────────────────────────────────

const firstTime = attemptCounts.filter(a => a === 1).length;
const meanAttempts = attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length;

console.log('\nRetries');
console.log(`  first draw accepted:   ${pct(firstTime, SEEDS)}`);
console.log(`  mean draws per puzzle: ${meanAttempts.toFixed(2)}`);
console.log(`  worst case:            ${Math.max(...attemptCounts)} draws`);

// ─── Timing, old against new, same machine, same run ──────────────────────────

const time = fn => {
  const samples = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const t0 = performance.now();
    fn(seed);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return {
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    median: quantile(samples, 0.5),
    p99: quantile(samples, 0.99),
    worst: samples[samples.length - 1],
  };
};

const old = time(seed => baseline.runFilterLoop(makeRng(seed)));
const now = time(seed => generatePuzzleFromRng(makeRng(seed)));

console.log('\nTime per generated puzzle');
console.log('              mean     median      p99     worst');
for (const [name, t] of [['old', old], ['new', now]]) {
  console.log(`  ${name}   ${ms(t.mean).padStart(8)} ${ms(t.median).padStart(9)} ${ms(t.p99).padStart(9)} ${ms(t.worst).padStart(9)}`);
}
console.log(`  new / old:  mean ${(now.mean / old.mean).toFixed(2)}x   p99 ${(now.p99 / old.p99).toFixed(2)}x`);
console.log('  Wall-clock on this machine, NOT billed Worker processor time — nothing here');
console.log('  can produce that. The real figure shows up in the Workers logs once the');
console.log('  branch builds to pre-prod.');

// ─── Verdict ──────────────────────────────────────────────────────────────────

const failures = [];
if (stillRedundant > 0) failures.push(`${stillRedundant} puzzles still have a removable clue`);
if (disagreements > 0) failures.push(`${disagreements} puzzles differ when the baseline draw is injected`);
if (now.mean / old.mean > SLOWDOWN_LIMIT) failures.push(`mean time is ${(now.mean / old.mean).toFixed(2)}x the old generator, over the ${SLOWDOWN_LIMIT}x limit`);
if (now.p99 / old.p99 > SLOWDOWN_LIMIT) failures.push(`p99 time is ${(now.p99 / old.p99).toFixed(2)}x the old generator, over the ${SLOWDOWN_LIMIT}x limit`);

if (failures.length > 0) {
  console.log('\nFAIL');
  for (const f of failures) console.log(`  - ${f}`);
  console.log('  This goes back to Jamie and Dave before the pull request, not into it.');
  process.exit(1);
}

console.log('\nPASS — every puzzle is in range, uniquely solvable, and carries no spare clue.');
