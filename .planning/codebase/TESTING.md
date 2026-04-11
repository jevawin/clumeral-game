# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Status:** Not detected

- No test runner configured (no Jest, Vitest, etc. in `package.json`)
- No test files in `src/` directory
- No test configuration files (`jest.config.*`, `vitest.config.*`)
- Tests are manual and code-review based

**Development:**
- Run code locally with `npm run dev`
- Preview production build with `npm run preview`
- Build with `npm run build`

## Testing Approach

**Current Strategy:**
- Manual testing during development (`npm run dev`)
- Pre-PR review gates (documented in `docs/DA-REVIEW.md` and `docs/SELF-REVIEW.md`)
- Code logic validated through review rather than automated tests
- Critical paths tested manually before merge

**No automation in place.**

## Code Review as Quality Gate

**Design-Architecture Review (DA):**
- Required when: changes touch >1 file, add/remove >30 lines, alter puzzle logic, CSS/theming, accessibility
- Reviewer: Fresh-context subagent with access to project docs
- Checks: Architecture compliance, puzzle determinism, localStorage keys, browser API usage

**Self-Review:**
- Required before PR merge
- Line-level checklist in `docs/SELF-REVIEW.md`
- Checks: type safety, null checks, error handling, DOM patterns, analytics tracking

See `docs/DA-REVIEW.md` and `docs/SELF-REVIEW.md` for detailed review criteria.

## Manual Testing Checklist (Implicit)

**Browser Compatibility:**
- Chrome, Firefox, Safari, Edge
- Mobile: iOS Safari (tap/Tab behavior differs), Android Chrome
- Note: Safari requires **Option+Tab** for tab navigation in custom widgets

**Gameplay:**
- Digit box interaction (click, keyboard, Touch)
- Guess submission and validation
- History display, stats calculation
- Previous puzzle replay
- Random puzzle generation + token handling

**UI/UX:**
- Light/dark theme toggle, dot-grid background renders correctly
- Accent colour picker updates icons and theme
- Modals open/close, focus management
- Toast notifications auto-dismiss
- Responsive design on mobile/tablet/desktop

**Accessibility:**
- Keyboard navigation: Tab, Arrow keys, Enter, Escape
- ARIA labels present
- Contrast: 4.5:1 for text, 3:1 for large text/UI
- Touch targets ≥44px
- No colour-only information

**Performance:**
- Animation frame rate (60fps on modern devices, graceful degredation on low-end)
- Puzzle load time <500ms
- No layout thrash during render cycles
- respects `prefers-reduced-motion`

**State Management:**
- Game state persists correctly (localStorage keys: `dlng_history`, `dlng_prefs`, `dlng_theme`, `dlng_colour`, `dlng_uid`, `cw-htp-seen`)
- Double-submit protection during API calls
- Form reset after correct guess

## Testable Modules

**Strongly Testable (Pure Functions):**
- `puzzle.ts` — All logic is deterministic:
  - `runFilterLoop(rng?: () => number)`: accepts mock RNG for seeded testing
  - `makeRng(seed: number)`: Mulberry32 PRNG, output verifiable against expected sequences
  - `applyFilter()`: Pure filter function, no side effects
  - Date helpers: `todayLocal()`, `puzzleDate()`, `puzzleNumber()` — simple math, deterministic
  
- `crypto.ts` — Web Crypto operations:
  - `signToken(seed, secret)`: Encrypt, output verifiable
  - `verifyToken(token, secret)`: Decrypt, returns seed or null
  - Can mock `crypto.subtle` for unit tests

- `storage.ts` — localStorage operations:
  - `loadHistory()`, `loadPrefs()`: Read JSON, return defaults on error
  - `recordGame()`, `persistPrefs()`: Write JSON
  - Can mock localStorage for tests

**Hard to Test (DOM/UI):**
- `app.ts` — Heavy DOM mutation, event listeners, game flow
- `octo.ts` — Animation frames, SVG transforms, timing-dependent
- `bubbles.ts` — Canvas rendering, animation loops
- `modals.ts` — Dialog API, focus management
- `theme.ts` — Canvas drawing, classList manipulation
- `colours.ts` — Dynamic icon swapping, CSS custom properties

**Why No Tests Currently:**
Clumeral is a small, stable single-page app. Tests would primarily be integration tests (DOM + state), which are:
1. Expensive to maintain (change HTML → rewrite tests)
2. Slow to run (DOM manipulation)
3. Brittle (timing-dependent animations, event delegation)

For this codebase size and stability, code review gates + manual testing is more pragmatic than a test suite.

## Adding Tests (Future Path)

**If tests needed, prioritize:**

1. **Unit tests for puzzle logic** (highest ROI):
   ```typescript
   import { runFilterLoop, makeRng } from './worker/puzzle.ts';
   
   test('puzzle generated from seed is deterministic', () => {
     const rng1 = makeRng(12345);
     const puzzle1 = runFilterLoop(rng1);
     
     const rng2 = makeRng(12345);
     const puzzle2 = runFilterLoop(rng2);
     
     expect(puzzle1.answer).toBe(puzzle2.answer);
     expect(puzzle1.clues).toEqual(puzzle2.clues);
   });
   ```

2. **Snapshot tests for puzzle clues** (catch regressions):
   ```typescript
   test('puzzle #1 has expected clues', () => {
     const rng = makeRng(dateSeedInt('2026-03-08'));
     const { answer, clues } = runFilterLoop(rng);
     expect(answer).toBe(expectedAnswer);
     expect(clues).toMatchSnapshot();
   });
   ```

3. **Storage layer tests**:
   ```typescript
   test('loadHistory handles corrupted JSON', () => {
     localStorage.setItem('dlng_history', '{invalid}');
     expect(loadHistory()).toEqual([]);
   });
   ```

4. **Crypto tests**:
   ```typescript
   test('token roundtrip preserves seed', async () => {
     const token = await signToken(12345, 'secret');
     const seed = await verifyToken(token, 'secret');
     expect(seed).toBe(12345);
   });
   ```

5. **Skip DOM/animation tests** — not worth the maintenance burden.

## Test Framework Recommendations

**If adding a test suite:**
- **Runner:** Vitest (TypeScript-first, Vite integration, ESM)
- **Assertion Library:** Vitest built-in (`expect()`)
- **DOM Testing:** Skip or use `@testing-library/dom` for critical paths only
- **Config:** Mirror `tsconfig.json` strict settings

Example `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // puzzle.ts and crypto.ts are Node-compatible
  },
});
```

---

*Testing analysis: 2026-04-11*
