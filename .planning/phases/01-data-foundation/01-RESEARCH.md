# Phase 1: Data Foundation - Research

**Researched:** 2026-03-07
**Domain:** CSV loading via fetch(), PapaParse 5.4.1, vanilla JS, HTML shell
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three separate files: `index.html`, `app.js`, `style.css`
- Single `app.js` — no splitting by concern for now (can revisit if it grows)
- PapaParse included via CDN at a pinned version (5.4.1): `<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js">`
- Phase 1 creates the full game structure — placeholder elements for all game components — so Phase 3 only needs to add CSS and wire JS, not restructure HTML
- Minimum element set: `#status`, `#clues`, `#guess` (input), `#submit` (button), `#history`, `#new-puzzle` (button)
- Loading and error states are text only, unstyled in Phase 1 — e.g. "Loading..." and "Error: could not load data.csv"
- Phase 3 adds visual styling to these states
- On successful parse: `console.log` the row count and trimmed header list — no visible on-screen change
- The `#status` element stays in its loading state until Phase 2/3 drive it with real game content

### Claude's Discretion
- Exact console.log format
- Whether `#status` shows "Loading..." or a spinner element (text-only is fine)
- Error message wording

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | App fetches `data.csv` from the project root using a relative path on page load | fetch() relative URL pattern; DOMContentLoaded timing |
| DATA-02 | CSV is parsed with PapaParse using `dynamicTyping: true` so numeric columns are numbers, not strings | PapaParse config confirmed via official docs; CDN version verified |
| DATA-03 | All column headers are trimmed of leading/trailing whitespace before use (4 headers in data.csv have trailing spaces) | Directly inspected data.csv; 4 affected headers confirmed at indices 4, 13, 17, 22; `transformHeader` option enables this cleanly |
| DATA-04 | Row 0 of the CSV is treated as labels; rows 1+ are data rows | PapaParse `header: true` handles this automatically |
| DATA-05 | A loading state is shown while the CSV is fetching | Set `#status` text before fetch; clear/replace on complete |
| DATA-06 | An error state is shown if the CSV fetch fails | fetch `.catch()` + PapaParse `error` callback pattern |
</phase_requirements>

---

## Summary

Phase 1 establishes the runtime data layer for a static vanilla JS game. The sole technical challenge is: fetch a CSV file, parse it correctly with PapaParse, clean whitespace from headers, and expose the resulting row array to the rest of the app — while keeping the browser UI in a visible loading state during the async operation and showing an error if the fetch fails.

The stack decision is already locked: PapaParse 5.4.1 via CDN (confirmed available at the pinned URL), vanilla `fetch()`, and three plain files with no build step. The data.csv has been directly inspected: it has 23 columns, with trailing spaces on exactly 4 headers (indices 4, 13, 17, 22). PapaParse's `transformHeader` option handles trimming cleanly without post-processing loops. `dynamicTyping: true` ensures all numeric columns arrive as JavaScript numbers.

The HTML shell is also a Phase 1 deliverable. The locked element IDs (`#status`, `#clues`, `#guess`, `#submit`, `#history`, `#new-puzzle`) become the stable DOM contract for Phases 2 and 3. Parsed data must be stored in a module-scoped or `window`-scoped variable accessible to Phase 2's filter engine.

**Primary recommendation:** Use `fetch('data.csv')` → `.text()` → `Papa.parse(text, { header: true, dynamicTyping: true, transformHeader: h => h.trim() })`. Store `results.data` and `results.meta.fields` (already trimmed) in module-scoped variables. Set `#status` to "Loading..." before the fetch and update it on error.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PapaParse | 5.4.1 (pinned) | CSV parsing | Industry standard browser CSV parser; handles edge cases (quoted commas, line breaks in fields) that hand-rolled split() misses; `dynamicTyping` and `transformHeader` are exactly the options needed |

### No npm / No Build Step
This project is fully static. PapaParse arrives via CDN script tag. No `npm install` is needed for Phase 1.

**CDN script tag (locked):**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
```

CDN availability confirmed: the file at that URL returns PapaParse v5.4.1, MIT license.

---

## Architecture Patterns

### Recommended Project Structure
```
david-larks-lame-number-game/
├── index.html       # Full game shell, all element IDs established here
├── app.js           # All JS in one file; data loaded and stored here
├── style.css        # Empty or minimal reset in Phase 1
└── data.csv         # Already exists in project root
```

### Pattern 1: fetch-then-parse (string parsing mode)

**What:** `fetch()` retrieves CSV as text, then `Papa.parse()` processes the string synchronously. This avoids PapaParse's `download: true` mode, which uses its own XHR and is harder to intercept for error states.

**When to use:** Always — gives explicit control over fetch error vs. parse error.

**Example:**
```javascript
// Source: papaparse.com/docs + standard fetch API
async function loadData() {
  document.getElementById('status').textContent = 'Loading...';

  let response;
  try {
    response = await fetch('data.csv');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    document.getElementById('status').textContent =
      'Error: could not load data.csv';
    return;
  }

  const text = await response.text();
  const results = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    transformHeader: h => h.trim(),
    skipEmptyLines: true,
  });

  if (results.errors.length) {
    console.warn('Parse warnings:', results.errors);
  }

  // Store for Phase 2 consumption
  window.gameData = {
    rows: results.data,        // array of row objects, numeric values are numbers
    headers: results.meta.fields, // trimmed header strings (transformHeader already applied)
  };

  console.log(`Loaded ${results.data.length} rows. Headers:`, results.meta.fields);
  // #status stays as "Loading..." per locked decision — Phase 2/3 will update it
}

document.addEventListener('DOMContentLoaded', loadData);
```

### Pattern 2: HTML Shell with Placeholder Elements

**What:** All game-relevant element IDs are created in `index.html` now. Later phases populate them but do not restructure the DOM.

**When to use:** Always — this is the locked decision; Phase 3 depends on it.

**Example:**
```html
<!-- Phase 1 establishes these IDs as the stable DOM contract -->
<p id="status">Loading...</p>
<ul id="clues"></ul>
<input id="guess" type="text" inputmode="numeric" maxlength="3" placeholder="Enter number" disabled>
<button id="submit" disabled>Submit</button>
<ul id="history"></ul>
<button id="new-puzzle" disabled>New Puzzle</button>
```

Note: `disabled` on interactive elements in Phase 1 is appropriate since Phase 2 activates them; this prevents premature interaction.

### Anti-Patterns to Avoid

- **Splitting on commas manually:** `line.split(',')` breaks on quoted values and multi-line fields. Use PapaParse.
- **Using `Papa.parse(url, { download: true })`:** Hides the fetch error path — the `error` callback receives PapaParse-level errors, not HTTP errors. Use fetch-then-parse instead for full error control.
- **Post-parse header trimming loop:** `transformHeader: h => h.trim()` handles it during parse. Trimming after the fact risks using untrimmed keys before the loop runs.
- **Storing data on `window` before parse completes:** Assign `window.gameData` only inside the `complete` callback or after `Papa.parse()` returns (synchronous string mode).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | `line.split(',')` or regex | PapaParse `Papa.parse()` | Quoted commas, embedded newlines, encoding edge cases all handled; trimming via `transformHeader` |
| Type coercion | `parseInt(val)` on every column | `dynamicTyping: true` | PapaParse infers types per cell; consistent across all 23 columns with no per-column configuration |

**Key insight:** The CSV has text columns (cols 1–6, category labels like "a square or a cube number") mixed with numeric columns (cols 7–22, sums/products/etc.). `dynamicTyping: true` correctly leaves text values as strings and converts numeric values to numbers — no column-by-column handling needed.

---

## Common Pitfalls

### Pitfall 1: Header Trailing Spaces Silently Break Column Lookups
**What goes wrong:** Code references `row['The first digit is']` but the actual key is `'The first digit is '` (with trailing space). The lookup returns `undefined` silently.
**Why it happens:** PapaParse uses the raw header string as the object key unless `transformHeader` is set.
**How to avoid:** Always include `transformHeader: h => h.trim()` in the parse config. The 4 affected headers are at column indices 4, 13, 17, and 22.
**Warning signs:** Column lookups returning `undefined`; `results.meta.fields` containing strings with trailing spaces.

### Pitfall 2: Fetch Errors Swallowed Without Error State
**What goes wrong:** `fetch('data.csv')` throws a network error (or returns 404 on a server), but no catch handler is present — the page stays blank or stuck on "Loading...".
**Why it happens:** `fetch()` rejects on network failure but does NOT reject on non-2xx HTTP status (404, 500). Both cases must be handled explicitly.
**How to avoid:** Check `response.ok` after `await fetch()` and throw if false. Wrap in try/catch. Update `#status` in the catch block.
**Warning signs:** Blank page when `data.csv` is missing; "Loading..." that never clears.

### Pitfall 3: DOMContentLoaded Timing
**What goes wrong:** `app.js` runs before the DOM exists, causing `document.getElementById('status')` to return `null`.
**Why it happens:** Script tag placed in `<head>` without `defer`, or code runs at top-level without waiting for DOM.
**How to avoid:** Either place `<script>` tag at the end of `<body>` before `</body>`, or use `document.addEventListener('DOMContentLoaded', loadData)`. Both work; the event listener approach is more explicit.
**Warning signs:** `Cannot set properties of null` errors in the console on page load.

### Pitfall 4: File-Protocol CORS Block
**What goes wrong:** Opening `index.html` directly via `file://` URL causes `fetch()` to fail with a CORS error.
**Why it happens:** Browsers block fetch() requests from `file://` origins to relative file paths.
**How to avoid:** Always test via a local HTTP server (`python3 -m http.server 8080` or VS Code Live Server). Document this in the project. This is expected — the app is designed for GitHub Pages (HTTP).
**Warning signs:** `Blocked by CORS policy` in the browser console when opening via double-click.

### Pitfall 5: skipEmptyLines Not Set
**What goes wrong:** A trailing newline in the CSV produces an empty row object at the end of `results.data`.
**Why it happens:** PapaParse includes empty lines in output by default.
**How to avoid:** Add `skipEmptyLines: true` to the parse config.
**Warning signs:** `results.data` length is one more than expected; last row is `{}` or has `undefined` values.

---

## Code Examples

Verified patterns from official sources:

### Full loadData() Function (Recommended Implementation)
```javascript
// Source: papaparse.com/docs (transformHeader, dynamicTyping, header options)
// Source: MDN fetch API (response.ok check pattern)

let gameRows = [];    // array of row objects; keys are trimmed header strings
let gameHeaders = []; // trimmed header strings in CSV order

async function loadData() {
  document.getElementById('status').textContent = 'Loading...';

  let text;
  try {
    const response = await fetch('data.csv');
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    text = await response.text();
  } catch (err) {
    document.getElementById('status').textContent =
      'Error: could not load data.csv';
    console.error('Fetch failed:', err);
    return;
  }

  const results = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    transformHeader: h => h.trim(),
    skipEmptyLines: true,
  });

  if (results.errors.length > 0) {
    console.warn('PapaParse encountered warnings:', results.errors);
  }

  gameRows = results.data;
  gameHeaders = results.meta.fields; // already trimmed by transformHeader

  console.log(
    `data.csv loaded: ${gameRows.length} rows, ${gameHeaders.length} headers`,
    gameHeaders
  );
  // #status intentionally left as "Loading..." per Phase 1 scope
}

document.addEventListener('DOMContentLoaded', loadData);
```

### HTML Shell Skeleton
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>David Lark's Lame Number Game</title>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
</head>
<body>
  <p id="status">Loading...</p>
  <ul id="clues"></ul>
  <input id="guess" type="text" inputmode="numeric" maxlength="3"
         placeholder="Enter a 3-digit number" disabled>
  <button id="submit" disabled>Submit</button>
  <ul id="history"></ul>
  <button id="new-puzzle" disabled>New Puzzle</button>

  <script src="app.js"></script>
</body>
</html>
```

### PapaParse Result Object Structure
```javascript
// Source: papaparse.com/docs
{
  data: [
    { Number: 100, 'The first digit is': 1, ... },  // numeric values are JS numbers
    // ... one object per data row
  ],
  errors: [],    // parse warnings/errors (not fetch errors)
  meta: {
    delimiter: ',',
    linebreak: '\r\n',
    aborted: false,
    fields: ['Number', 'The first digit is', ...],  // trimmed by transformHeader
    truncated: false
  }
}
```

---

## Data Profile (Direct Inspection of data.csv)

This section is based on direct inspection of the actual file — not assumptions.

| Property | Value |
|----------|-------|
| Total columns | 23 |
| Headers with trailing spaces | 4 (indices 4, 13, 17, 22) |
| Affected headers | `'The first digit is '`, `'The difference of the second and third digits is '`, `'The product of all three digits is '`, `'The range of all three digits is '` |
| Mixed column types | Yes — cols 1–6 are text labels ("a prime number", etc.); cols 7–22 are numeric |
| First row | Header row (row 0 in raw CSV = labels, consistent with DATA-04) |

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| Hand-rolled CSV split | PapaParse with options | `dynamicTyping` + `transformHeader` eliminate post-processing |
| `Papa.parse(url, { download: true })` | `fetch()` + `Papa.parse(text, ...)` | Better error separation: fetch errors vs. parse errors handled independently |
| Inline `<script>` | External `app.js` with `DOMContentLoaded` | Follows locked decision; cleaner separation |

---

## Open Questions

1. **`window.gameData` vs. module-scoped variables**
   - What we know: Phase 2 needs to read the parsed rows. CONTEXT.md says "module-scoped variable or `window` property".
   - What's unclear: The planner will choose. Either `let gameRows` at top of `app.js` (accessible within the file) or `window.gameData = { rows, headers }` (accessible cross-file, though there's only one JS file).
   - Recommendation: Since the locked decision is a single `app.js`, module-scoped `let gameRows` and `let gameHeaders` at the top of the file are cleaner. Phase 2 code in the same file accesses them directly. `window` attachment is unnecessary.

2. **`#status` text during load**
   - What we know: CONTEXT.md explicitly permits "Loading..." as the text.
   - What's unclear: Nothing — this is at Claude's discretion. Use "Loading...".

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — greenfield project |
| Config file | None — Wave 0 must create |
| Quick run command | `open index.html via local server + browser devtools` (manual) |
| Full suite command | Same — manual browser verification |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | `data.csv` fetched on page load | smoke | Manual: load page, check Network tab | ❌ Wave 0 |
| DATA-02 | Numeric columns are JS numbers after parse | unit | `node -e "const r=require('./verify-data.js'); r.checkTypes()"` — or manual devtools | ❌ Wave 0 |
| DATA-03 | All 23 headers have no trailing/leading whitespace | unit | Manual: `console.log(gameHeaders)` output check | ❌ Wave 0 |
| DATA-04 | Row 0 is headers; data starts at row 1 | smoke | Manual: check `gameRows[0]` is row 100 not header string | ❌ Wave 0 |
| DATA-05 | "Loading..." visible before fetch completes | smoke | Manual: throttle network in devtools to Slow 3G, observe status | ❌ Wave 0 |
| DATA-06 | Error message shown when fetch fails | smoke | Manual: rename data.csv, reload page, observe status | ❌ Wave 0 |

> Note: This is a fully static browser app with no Node.js runtime or test runner. All validation is manual browser verification. Wave 0 should document the manual test procedures as a checklist. Automated unit tests are not feasible without adding a build step, which contradicts the locked no-build-step decision.

### Sampling Rate
- **Per task commit:** Manually open page in browser via local HTTP server, check browser console
- **Per wave merge:** Full manual checklist (all 6 DATA requirements)
- **Phase gate:** All 6 DATA checks pass in browser before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No test files exist — greenfield project. Verification is manual browser inspection.
- [ ] Local server must be used (not `file://` direct open) — document this in a dev note or comment in `index.html`
- [ ] Manual test checklist recommended: create `.planning/phases/01-data-foundation/MANUAL-TEST-CHECKLIST.md` as Wave 0 artifact

---

## Sources

### Primary (HIGH confidence)
- `https://www.papaparse.com/docs` — `Papa.parse()` API, `header`, `dynamicTyping`, `transformHeader`, `skipEmptyLines`, result object structure, `meta.fields`
- `https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js` — CDN availability confirmed; version 5.4.1, MIT license
- Direct inspection of `/data.csv` — 23 columns, 4 headers with trailing spaces at indices 4, 13, 17, 22

### Secondary (MEDIUM confidence)
- MDN fetch API (standard browser API — response.ok pattern, try/catch on network errors)
- `https://betterstack.com/community/guides/scaling-nodejs/parsing-csv-files-with-papa-parse/` — fetch-then-parse pattern confirmation

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — CDN URL confirmed working, PapaParse 5.4.1 verified, options documented from official source
- Architecture: HIGH — Direct data inspection confirms the header problem; PapaParse API is authoritative; patterns are standard
- Pitfalls: HIGH — Pitfalls 1–3 are directly confirmed by data inspection and API docs; Pitfall 4 (file:// CORS) is a known browser behavior

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (PapaParse 5.x is stable; CDN URL is pinned — no drift risk)
