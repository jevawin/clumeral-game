# Testing

## Test Runner

<!-- Not applicable to this project -->

No automated test runner. No `package.json`, no test framework (Jest, Vitest, Mocha, etc.).

## Test Structure

<!-- Not applicable to this project -->

## Unit Tests

<!-- Not applicable to this project -->

## Integration Tests

<!-- Not applicable to this project -->

## E2E Tests

<!-- Not applicable to this project -->

## Coverage Expectations

Manual testing only. To verify a change:
1. Run `python3 -m http.server 8080` from `~/clumeral-game`
2. Open `http://localhost:8080` in a browser
3. The app falls back to importing `puzzle.js` directly (no Worker)
4. Verify the puzzle loads, clues render, guesses work, and stats update

For Worker-specific changes, deploy to the Cloudflare Pages dev/staging branch alias and verify there.
