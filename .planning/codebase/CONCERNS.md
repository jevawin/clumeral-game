# Codebase Concerns

**Analysis Date:** 2026-04-11

## Test Coverage Gaps

**Critical area: No automated tests**
- What's not tested: Entire codebase runs without any unit, integration, or E2E tests
- Files affected: All source files in `src/`
- Risk: Bug regressions go undetected. Puzzle algorithm changes (especially in `src/worker/puzzle.ts`) can silently break determinism.
- Priority: High
- Mitigation: Manual review gates via DA-REVIEW.md and SELF-REVIEW.md. Critical logic verified in code review before merge.

**Puzzle generation determinism**
- What's not tested: `runFilterLoop()` produces same result for same seed across changes
- Files: `src/worker/puzzle.ts`
- Risk: Small refactors to property computation or filter selection could produce different answers for past dates, breaking replay functionality
- Priority: High
- Approach: Add test suite that verifies a sample of historical puzzle seeds produce exact same answers

**Edge case: Filter loop iterations**
- What's not tested: `runFilterLoop` behavior when `candidates.length === 1` before reaching tiebreaker
- Files: `src/worker/puzzle.ts`
- Risk: Candidate set could resolve before all groups are tried; tiebreaker sweep might be unreachable in some edge cases
- Priority: Low
- Coverage impact: Only affects puzzle generation, not gameplay

## Data & Storage Risks

**localStorage quota and history unbounded growth**
- Problem: `dlng_history` can grow indefinitely via `recordGame()` in `src/storage.ts`
- Files: `src/storage.ts`, `src/app.ts` (line 643)
- Current behavior: No truncation; history array only has duplicates filtered by date, never culled by age
- Risk: Very long-playing users will accumulate hundreds of entries. localStorage quota varies (5–50MB depending on browser), but large JSON strings serialized on every save degrades performance
- Mitigation: None currently implemented
- Fix approach: Implement max-size cap (e.g., last 365 days or 60 entries); evict oldest on overflow in `recordGame()`

**Feedback URL hardcoded and external**
- Problem: Google Sheets webhook URL in plaintext in source
- Files: `src/modals.ts` (line 6)
- Risk: If the webhook ID is leaked, attackers can send spam/malicious feedback to the sheet. No validation on receiver.
- Current protection: `mode: "no-cors"` prevents CORS errors, but feedback is sent via POST to external domain
- Mitigation: Google Apps Script provides built-in rate limiting, but relies on obfuscation of URL
- Note: Low priority for this game (low-traffic puzzle), but violates principle of not sending data to uncontrolled external services

**localStorage corruption recovery**
- Problem: JSON parsing errors caught silently; fallback to defaults
- Files: `src/storage.ts` (lines 12, 24), `src/app.ts` (line 24)
- Risk: User loses all history/prefs without notification if localStorage is corrupted (unlikely but possible on browser crash during write)
- Approach: Add telemetry to track parse failures; consider logging corrupted data to console in development

## Performance Concerns

**Octopus animation RAF loop never stops**
- Problem: `trackEyes()` in `src/octo.ts` (lines 44-52) runs continuous `requestAnimationFrame` loop unconditionally
- Files: `src/octo.ts`
- Risk: Wastes CPU/battery when tab is unfocused or user navigates away. No pause mechanism.
- Current behavior: RAF pauses automatically in background tabs (browser optimization), but loop never stops if page remains open
- Fix approach: Detect tab visibility and pause/resume the RAF loop on `visibilitychange` event

**Filter loop iteration limit**
- Problem: `runFilterLoop()` breaks if `iterations > 100` (line 126 in `src/worker/puzzle.ts`)
- Files: `src/worker/puzzle.ts`
- Risk: Loop could terminate early with multiple candidates still remaining if iteration cap hit (very rare but theoretically possible with unlucky RNG)
- Current behavior: Tiebreaker sweep runs after loop, so candidates get narrowed further even if loop breaks early
- Coverage: Would only affect puzzle generation, not gameplay
- Recommendation: Add telemetry to detect if this ever happens; consider increasing cap or implementing better termination logic

**stats.ts API calls run serially**
- Problem: Promise.all() still serializes due to awaiting each query sequentially
- Files: `src/worker/stats.ts` (lines 40-66)
- Risk: Dashboard loads slowly on slow connections or during high CPU load on worker
- Mitigation: Queries are already parallel via Promise.all(); this is efficient as-is
- Note: Not a concern; flagging as reviewed

## Fragile Areas

**Clue rendering depends on exact property key naming**
- Files: `src/app.ts` (lines 121-143: `getClueTag()` and `digitPositions()`)
- Why fragile: Logic uses string suffix matching and exact key comparisons on property names from `src/worker/puzzle.ts`
- Example: `propKey.endsWith("FS")` checks for "first and second" — any property name change breaks this
- Safe modification: Properties in `src/worker/puzzle.ts` must match expected patterns. Document naming convention: `{operation}{digits}` where digits are one of: `FS`, `FT`, `ST`, `All`, or `first`/`second`/`third`
- Test coverage: Manual via code review; verify UI renders correctly for all 28 properties

**Game state module coupling**
- Files: `src/app.ts`
- Why fragile: Module state variables (`gameState`, `possibles`, `activeBox`, `submitting`) are tightly coupled
- Risk: Changing one state flag without updating others can cause race conditions (e.g., setting `submitting = false` at wrong time during API call could allow double-submit)
- Guard: `submitting` flag prevents double-submit on handleGuess (line 612); still need discipline with async code
- Safe modification: Use state guard constants (const guards like `submitting`) for any critical async operations; always set/unset in matched pairs

**Service worker cache busting**
- Files: `public/sw.js`
- Why fragile: Cache name uses `__BUILD_HASH__` placeholder; if build hash not injected properly, old caches won't be cleared
- Risk: Users could see stale puzzle data or assets after deploy
- Mitigation: Vite plugin should inject hash at build time; no explicit test that this happens
- Safe modification: Verify hash injection in build logs; monitor cache hits in production

**Old history entries missing answers**
- Files: `src/app.ts` (lines 563-575: `startReplayPuzzle()`)
- Why fragile: History records saved before answer-logging feature (answer field is optional in `HistoryEntry`)
- Risk: Replay of old puzzles shows "solved" state but doesn't display answer digits; must fetch from `/api/puzzle/:num/solution`
- Fallback: If fetch fails, answer stays null and UI doesn't show digits (inconsistent UX)
- Safe modification: Always check if answer is null; fetch solution if missing; handle fetch errors gracefully

## Security Considerations

**Answer never reaches client — architecture verified**
- Status: ✓ Secure
- Implementation: API validates all guesses server-side; only returns `{ correct: true/false }`
- Files: `src/worker/index.ts` (lines 85-107 for guess validation)
- No client-side answer verification or hints that reveal it

**Random puzzle tokens use AES-GCM**
- Status: ✓ Secure
- Implementation: `src/worker/crypto.ts` uses Web Crypto API to encrypt seeds
- Risk: HMAC_SECRET must be strong; no rotation mechanism
- Current protection: Cloudflare manages secret; token is opaque to client
- Monitoring: No audit trail of token generation; consider adding rate limiting if random puzzle abuse detected

**Analytics UID is deterministic (same user = same UUID)**
- Status: ⚠ Design choice
- Implementation: `src/app.ts` (line 14-21) generates UUID once and stores in localStorage with key `dlng_uid`
- Impact: Users are trackable across sessions (by design for analytics)
- Privacy: Not PII, but allows per-user behavior tracking
- Note: Documented in ARCHITECTURE.md; acceptable for a public game

**Console.error left in production**
- Issue: `src/modals.ts` line 232 logs error when feedback submission fails
- Files: `src/modals.ts`
- Risk: Low; console is not visible to end users, only developers
- Approach: This is acceptable for error reporting during feedback failure. Alternative: remove entirely or gate behind dev check
- Recommendation: Keep; useful for debugging user issues

**No input validation on guess** 
- Status: ✓ Validated
- Implementation: `src/worker/index.ts` (lines 81-82) validates guess is integer between 100–999
- Files: `src/worker/index.ts`
- Defense: Server-side validation only; client prevents invalid guesses via UI (possibles set management)

## Known Limitations

**Only three-digit puzzles**
- Design constraint: Game is hardcoded for 100–999 range
- Files: `src/worker/puzzle.ts` (line 119)
- Impact: Cannot easily extend to other number ranges without rewriting filter logic
- Approach: Would require new property compute functions and property groups

**No async state persistence during gameplay**
- Problem: If user's browser crashes mid-game, active game state (guesses, possibles) is lost
- Files: `src/app.ts` (module state variables)
- Note: Acceptable for casual game; recovery is to refresh page and start over
- Approach: Could add periodic save of `possibles` to localStorage, but adds complexity

**Analytics Engine SQL injection risk (low)**
- Problem: `whereClause()` in `src/worker/stats.ts` (line 34) interpolates `hostname` directly into SQL
- Files: `src/worker/stats.ts`
- Risk: If hostname comes from untrusted source, could inject SQL
- Current protection: `url.hostname` comes from Request object, which is controlled; not user-provided
- Recommendation: Safe as-is; document that hostname must be validated before use if API is exposed

## Scaling Limits

**Puzzle KV storage unbounded**
- Current: Each daily puzzle stored in KV with date as key
- Capacity: Cloudflare KV supports unlimited keys; 1MB value limit (puzzles are ~2KB)
- Limit: No hard limit; KV auto-scales
- Scaling path: No action needed; KV designed for this use case

**Analytics Engine query performance**
- Current: `/stats` endpoint runs 5 parallel queries on analytics data
- Bottleneck: Cloudflare Analytics Engine SQL performance depends on dataset size (rows of events)
- Scaling: At 100K+ daily events, queries could slow down
- Scaling path: Add time-series caching (cache yesterday's stats); implement query pagination/sampling

**Service worker cache size**
- Current: Caches static assets + navigation requests only
- Limit: Browser cache storage quota (varies; typically 50MB for Chrome, unlimited in private windows)
- Scaling: Not a concern for current asset size (~50KB gzipped)
- Monitoring: No telemetry; could add cache size logging if needed

## Missing Critical Features

**No offline puzzle play**
- Current: Page requires API call to fetch puzzle
- Impact: No play during network outages (service worker caches HTML shell only, not puzzle data)
- Approach: Could prefetch today's puzzle on install; not yet implemented
- Priority: Low (daily game, not casual)

**No puzzle hint system**
- Current: Only clues visible; no progressive hints or "reveal digit" feature
- Design: Intentional; game is meant to be solved from clues alone
- Note: Not a missing feature; confirmed by design

## Maintenance Debt

**EPOCH_DATE hardcoded in two places**
- Files: `src/app.ts` (line 36), `src/worker/puzzle.ts` (line 193)
- Risk: If changed in one place but not the other, puzzle numbers diverge between client and server
- Approach: Extract to shared constant; import into both modules
- Priority: Low (unlikely to change; if changed, both must be updated together)

**localStorage key prefixes inconsistent**
- Prefixes used: `dlng_` (legacy), `cw-htp-seen` (history table), `dlng_theme`, `dlng_uid`, etc.
- Files: Multiple across `src/app.ts`, `src/storage.ts`, `src/theme.ts`, `src/colours.ts`, `src/modals.ts`
- Risk: Low; keys are stable and never renamed (would break user data)
- Note: `dlng_` is the original prefix; `cw-htp-seen` predates standardization. Don't rename.

**Property label strings used as identifiers**
- Problem: Clue labels in `PROPERTIES` are free-form strings used for deduplication and display
- Files: `src/worker/puzzle.ts` (lines 23-63), `src/app.ts` (line 155: TAG_TIPS lookup)
- Risk: Changing a label string breaks existing clues and tooltips
- Approach: Labels should be stable; if changed, update TAG_TIPS mapping

---

*Concerns audit: 2026-04-11*
