# Testing

## Status

No automated test framework is present.

- No Jest, Vitest, Mocha, or any other test runner
- No test files (no `*.test.js`, `*.spec.js`)
- No test scripts in any `package.json`

---

## How Testing Works

Testing is **manual**:

1. Run local dev server: `python3 -m http.server 8080`
2. Open `http://localhost:8080` in browser
3. Verify puzzle generates, clues render, guesses work
4. Use Cloudflare Pages preview URLs for pre-merge QA

---

## What Is Implicitly Verified

- **Determinism**: Same date seed always produces the same puzzle (verifiable by opening the game on the same day across devices)
- **Puzzle solvability**: `runFilterLoop` always terminates with `candidates.length === 1` (enforced by tiebreaker sweep)
- **Worker injection**: `window.PUZZLE_DATA` present in production HTML source

---

## Gaps

- No unit tests for `puzzle.js` logic (filter functions, RNG, date helpers)
- No integration tests for `_worker.js` request handling
- No visual regression tests
- No accessibility automated checks (e.g. axe-core)
