# Concerns

## Known Tech Debt

### localStorage key prefix coupling (dlng_)
The STORAGE_HISTORY and STORAGE_PREFS use hardcoded `dlng_` prefix (app.js:8-9) derived from the original game name "David Lark's Lame Number Game." This cannot be renamed without breaking existing user data. If player migration or data reset is ever needed, this historical coupling becomes a constraint.

### Duplicate date/puzzle logic between app.js and puzzle.js
Both files define EPOCH_DATE, todayLocal(), and puzzleNumber() functions independently. They must remain in sync across both modules (app.js:7-25 and puzzle.js:161-175). A shared utility module would reduce duplication but isn't done to avoid a build step.

### RNG seeding depends on client-side Date
The puzzle seed relies on `new Date()` in the browser (puzzle.js:162). System clock changes or timezone traversal could theoretically cause date mismatches, though in practice this is mitigated by Worker-side injection. Local dev fallback is the only risk vector.

### applyFilter includes unreachable code path
puzzle.js:81 returns `true` as a fallback for unknown operators, which should never occur given the validated set ['=', '!=', '<=', '>=']. This is defensive but suggests missing input validation or type guarantees.

### HTML injection in _worker.js
_worker.js:20-22 uses simple string replacement to inject window.PUZZLE_DATA into HTML (`</head>` → script tag + `</head>`). While safe given puzzleData is JSON-serialized integers, a more robust HTML parser would be safer if the injection point ever changes.

### No test suite
The entire codebase (filter logic, date calculations, RNG seeding) has no automated tests. The algorithm is deterministic and reproducible, but drift in puzzle generation could go undetected until user reports surface.

## Security Considerations

### No input validation on guess submission
app.js:224 relies only on Number.isInteger() and raw.length !== 3 checks. A malicious actor cannot break the game, but no sanitization occurs before storing to localStorage. Compromised localStorage is low-risk since scores are not transmitted.

### localStorage is client-side only
dlng_history and dlng_prefs persist locally without server-side backup or auth. Users clearing browser data lose all history. This is acceptable for a daily puzzle (ephemeral gameplay) but means leaderboards are impossible.

### Worker puzzle data is unencrypted in HTML
_worker.js injects window.PUZZLE_DATA as plaintext JSON in the response (line 22). Any network sniffing reveals the answer before page render, allowing cheating. Mitigated by HTTPS (Cloudflare) but no obfuscation. Not a breaking risk for a casual game but noted for integrity.

### No CSRF or rate-limiting
No action available to exploit, but a future backend could be vulnerable if added without protection.

### GitHub repo is public
All source code is visible (CLAUDE.md mentions sourced on GitHub). No secrets should be stored in repo; .gitignore is not checked in output. Ensure .clancy/.env is gitignored if it contains credentials.

### Integer puzzle space is small (900 numbers)
Brute-force all candidates takes <1ms. Game integrity depends on player honesty, not computational security.

## Performance Bottlenecks

### No caching of computed digit properties
puzzle.js computes digit properties on-the-fly for every candidate in every filter iteration (puzzle.js:105). For 900 candidates and 6 main loop iterations + tiebreaker, this is thousands of Math.floor() calls. With mulberry32 RNG overhead, runFilterLoop() takes ~5-10ms on a modern CPU. On resource-constrained clients (old phones), noticeable lag is possible.

**Mitigation**: Caching is unnecessary for daily use (<50ms acceptable), but a memoized compute function could help if puzzle generation moves to client on slower hardware.

### Candidate array is not pre-sorted or indexed
All filters scan the full candidates array linearly (puzzle.js:75-82). For the final tiebreaker (puzzle.js:131-144), all 28 properties are checked against the remaining candidate set sequentially. With JavaScript's dynamic typing and no optimization hints, this could be slow on low-end devices.

### Single event listener for keydown + click
app.js:265-268 attaches listeners at module load, never detached. For a single-page game this is fine, but if the module ever reloads or is imported multiple times, duplicate handlers could fire. Unlikely in practice but a subtle bug if code structure changes.

### Cloudflare Worker response time unpredictable
_worker.js fetches and transforms HTML on every request (line 18). If Cloudflare's cache is cold or env.ASSETS is slow, response time could spike. No caching header set for the HTML response. Unknown timeout/SLA on ASSETS.fetch().

## Areas to Avoid Changing

### LOCKED DOM IDs (per CLAUDE.md)
Do NOT rename or restructure these elements without updating all references in app.js:
- `#status` — loading message
- `#clues` — clue list
- `#guess` — input field
- `#submit` — submit button
- `#history` — previous guesses
- `#feedback` — correct/incorrect message
- `#history-label` — "Previous guesses:" label

### localStorage key prefix `dlng_`
Must remain unchanged. Renaming breaks existing player history and saved preferences. Any migration requires coordination with deployed Worker.

### puzzle.js / app.js separation
CRITICAL: puzzle.js must contain ONLY logic (properties, filters, RNG, date helpers). app.js must contain ONLY UI (DOM manipulation, event listeners, rendering). Mixing violates the no-framework contract and breaks the local dev fallback (puzzle.js imported standalone).

### Event listeners at module level
app.js:265-272 attach listeners once at load. DO NOT move these inside startDailyPuzzle() or wrap them in conditions. If event handlers are reattached per puzzle, duplicate handlers will fire on subsequent puzzles.

### gameState module scope
gameState is a module-scoped `let` in app.js (line 13), not a window global. Do NOT expose it to window or localStorage. The current game state is ephemeral and should be discarded between page reloads.

### EPOCH_DATE must match Worker and browser
Both puzzle.js:170 and app.js:7 define EPOCH_DATE = '2026-03-08'. If this drifts, puzzle numbers will not match server and client. Keep in sync or unify the constant.

## Deprecated Patterns

### String-based clue rendering with regex split
app.js:79 splits label on " is " to separate subject from predicate. This works for current boolean clues but is fragile:
- Assumes the label always contains " is "
- Fails if a label naturally contains " is " twice (e.g., "The first digit is a prime and is also...")
- String manipulation is harder to debug than a data-driven structure

Future refactor should store clue metadata as objects with explicit fields: `{ subject, predicate, operator, value }` instead of parsing labels.

### Checkbox icon toggle via display: none/""
app.js:163-164 hides/shows SVG icons by toggling `display`. Consider using CSS classes (`.icon-checked.hidden { display: none }`) for cleaner state management.

### Manual DOM element access via getElementById
app.js uses repeated `document.getElementById()` calls (e.g., lines 103-104, 160-164, etc.). For a larger app this becomes unmaintainable. Consider a minimal helper object mapping IDs to elements, or switch to template libraries. Current codebase is small enough that this is acceptable but note the pattern is not scalable.

### Inline animation in CSS (heart bounce)
style.css:406-409 hardcodes animation parameters. If animation duration needs to change globally, it's a manual CSS edit. Consider CSS custom properties for animation values if reusability becomes important.

### No explicit error handling in loadPuzzle()
app.js:248-262 assumes both window.PUZZLE_DATA and the puzzle.js import succeed. If _worker.js fails or puzzle.js has a syntax error, the page shows "Loading..." indefinitely. Add try/catch and fallback UI.

