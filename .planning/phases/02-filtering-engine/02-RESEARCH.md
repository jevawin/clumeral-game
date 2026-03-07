# Phase 2: Filtering Engine - Research

**Researched:** 2026-03-07
**Domain:** Pure vanilla JS filter loop — array manipulation, random selection, operator dispatch, edge-case termination
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILT-01 | Six named filter ranges matching the Apps Script: SpecialNumbers (cols 4–6), Sums (cols 7–10), AbsoluteDifference (cols 11–13), Products (cols 14–17), Means (cols 18–21), Range (col 22) | Direct inspection of data.csv confirms all 23 columns, 0-indexed; mapping is exact |
| FILT-02 | Filter loop starts with all data rows as candidates | `candidates = [...gameRows]` shallow copy before loop begins |
| FILT-03 | Each iteration picks a random untried range, a random column within that range, and a random value from that column among current candidates | Random index into untried-ranges set, then random column index within that range's bounds, then random row value |
| FILT-04 | Numeric columns use operators: `<=`, `=`, `!=`, `>=` (chosen at random); text columns use `=`, `!=` | SpecialNumbers (cols 4–6) are text strings; all other filterable cols (7–22) are JS numbers after dynamicTyping |
| FILT-05 | A filter is skipped if it would eliminate all remaining candidates | Apply filter to a test copy; if result.length === 0, skip this filter and continue iterating |
| FILT-06 | A filter is skipped if all current candidate values in the chosen column are identical (uniform — filter would be meaningless) | Check with Set: `new Set(candidates.map(r => r[col])).size === 1` |
| FILT-07 | The loop terminates when 1 candidate remains or all 6 ranges have been tried | `while (candidates.length > 1 && triedRanges.size < 6)` |
| FILT-08 | An iteration cap prevents infinite loops on edge-case rows (e.g., repeated-digit numbers like 111, 222) | Global counter incremented each iteration; break when counter exceeds cap (recommended: 100) |
| FILT-09 | Each applied filter records a clue: `{ label, operator, value }` | `label = gameHeaders[colIndex]` — already human-readable from data.csv; push to clues array on each accepted filter |
| FILT-10 | Column 0 (Number) of the surviving row is the answer | `candidates[0]['Number']` or `candidates[0][gameHeaders[0]]` after loop terminates |
</phase_requirements>

---

## Summary

Phase 2 implements `runFilterLoop(rows)` as a pure function added to the existing `app.js` file. It receives the full `gameRows` array (900 row objects from Phase 1) and returns `{ answer, clues }` where `answer` is the Number field of the surviving row (100–999) and `clues` is a non-empty array of `{ label, operator, value }` objects.

The algorithm is a direct port of a proven Google Apps Script. The core loop: maintain a candidates array (starts as all rows), on each iteration pick a random untried range group, a random column within that range, a random operator (numeric or text based on column type), and a random value from the current candidates in that column. Test whether applying that filter leaves at least one candidate AND is not trivially uniform — skip if either safety check fails. If valid, apply the filter and record a clue. Stop when one candidate remains or all six range groups have been exhausted.

The pathological edge case is repeated-digit numbers (111, 222, ..., 999): their AbsoluteDifference columns and Range column are all 0, making those two range groups always uniform when 111-type rows remain. However, the SpecialNumbers, Sums, Products, and Means groups DO differ between these numbers, so convergence is still achievable. An iteration cap of 100 is sufficient to prevent any infinite behavior without blocking legitimate convergence.

**Primary recommendation:** Implement `runFilterLoop` as a standalone function appended directly to `app.js` (same file, same module scope as `gameRows`). Define `RANGE_GROUPS` as a constant object mapping group names to column header arrays. Column type (text vs. numeric) is detected by checking whether `typeof candidates[0][col] === 'string'`. The function must handle the escape case: if the cap is hit before convergence, return `{ answer: candidates[0]['Number'], clues }` with whatever clues were accumulated — never throw.

---

## Data Profile (Direct Inspection — Resolves the STATE.md Research Flag)

> STATE.md flagged: "Phase 2 planning will require inspecting data.csv directly to map RANGE_GROUPS column metadata before writing the filter engine." This section resolves that flag.

### Column Index Map (0-indexed)

| Index | Header (trimmed) | Type | Range Group |
|-------|-----------------|------|-------------|
| 0 | Number | numeric (int 100–999) | NOT filterable — answer column |
| 1 | The first digit is | numeric (0–9) | NOT filterable — raw digit value |
| 2 | The second digit is | numeric (0–9) | NOT filterable — raw digit value |
| 3 | The third digit is | numeric (0–9) | NOT filterable — raw digit value |
| 4 | The first digit is | string | SpecialNumbers |
| 5 | The second digit is | string | SpecialNumbers |
| 6 | The third digit is | string | SpecialNumbers |
| 7 | The sum of the first and second digits is | numeric | Sums |
| 8 | The sum of the first and third digits is | numeric | Sums |
| 9 | The sum of the second and third digits is | numeric | Sums |
| 10 | The sum of all three digits is | numeric | Sums |
| 11 | The difference of the first and second digits is | numeric | AbsoluteDifference |
| 12 | The difference of the first and third digits is | numeric | AbsoluteDifference |
| 13 | The difference of the second and third digits is | numeric | AbsoluteDifference |
| 14 | The product of the first and second digits is | numeric | Products |
| 15 | The product of the first and third digits is | numeric | Products |
| 16 | The product of the second and third digits is | numeric | Products |
| 17 | The product of all three digits is | numeric | Products |
| 18 | The mean of the first and second digits is | numeric | Means |
| 19 | The mean of the first and third digits is | numeric | Means |
| 20 | The mean of the second and third digits is | numeric | Means |
| 21 | The mean of all three digits is | numeric | Means |
| 22 | The range of all three digits is | numeric | Range |

**Key findings:**
- Cols 1–3 (raw digit values) are NOT in any named range group and must NOT be selected by the filter loop.
- Cols 4–6 (SpecialNumbers) contain text strings like `"a prime number"`, `"a square number"`, `"a square or a cube number"`, `"a triangular number"`, `"a cube number"`. PapaParse's `dynamicTyping: true` leaves these as strings because they cannot be parsed as numbers.
- All other filterable columns (7–22) are JS numbers after parsing.
- Cols 4, 13, 17, 22 had trailing spaces in the raw CSV — already trimmed by Phase 1's `transformHeader`. The trimmed versions are what appear in `gameHeaders` and must be used as keys.

### Repeated-Digit Edge Case (111, 222, ..., 999)

These 9 rows have all AbsoluteDifference columns = 0 and Range = 0. When the candidate set has narrowed to include one of these rows, those range groups may be uniform (all zero among remaining candidates) and will be skipped by FILT-06. However:
- SpecialNumbers differs between them (111="a square or a cube number", 222="a prime number", etc.)
- Sums differ (111 sum=3, 222 sum=6, etc.)
- Products differ (111 product=1, 222 product=8, etc.)
- Means differ proportionally

Convergence is achievable. The iteration cap protects against the degenerate case where skipping cascades.

### SpecialNumbers Value Set

Five distinct text values in cols 4–6 (confirmed by direct inspection):
- `"a prime number"`
- `"a square number"`
- `"a cube number"`
- `"a square or a cube number"`
- `"a triangular number"`

---

## Standard Stack

### Core

No external libraries needed for the filter engine. Everything is native vanilla JS:

| API | Purpose | Why |
|-----|---------|-----|
| `Array.prototype.filter` | Narrow candidate set | Standard; no library needed |
| `Math.random()` | Random range/column/value/operator selection | Sufficient randomness for a browser puzzle game; no seeded RNG needed in Phase 2 |
| `Set` | Track tried range groups; detect uniform columns | O(1) lookup, built-in |
| `typeof` | Determine column type (string vs. number) for operator selection | One-line type check on first candidate's value |

**No npm install required.** This phase adds only JS code to the existing `app.js`.

---

## Architecture Patterns

### Recommended Project Structure (unchanged from Phase 1)

```
david-larks-lame-number-game/
├── index.html       # Phase 3 will populate #clues list from runFilterLoop output
├── app.js           # Phase 1 loadData() already here; Phase 2 appends runFilterLoop()
├── style.css        # Phase 3 owns this
└── data.csv         # Already in place
```

`runFilterLoop` is appended to the bottom of `app.js` after the Phase 1 `loadData` function. It reads `gameHeaders` (module-scoped) to get column names but receives `rows` as a parameter — making it a pure function that can be called with any row subset.

### Pattern 1: RANGE_GROUPS as a Constant

**What:** Define the six range groups as a constant object mapping group name to an array of header strings (not column indices). This keeps the mapping readable and prevents off-by-one errors.

**When to use:** Always — this is the only safe way to express the range group → column mapping without hardcoding magic index numbers throughout the loop.

```javascript
// Source: direct inspection of data.csv column layout
// Headers must match gameHeaders exactly (trimmed, as set by Phase 1)
const RANGE_GROUPS = {
  SpecialNumbers:      ['The first digit is', 'The second digit is', 'The third digit is'],
  // Note: indices 4, 5, 6 — NOT the same-named cols 1-3 which are raw digit values
  // The SpecialNumbers headers at index 4-6 were originally trailing-spaced;
  // after trimming they share the same text as cols 1-3. Distinguish by order in gameHeaders.
  Sums:                ['The sum of the first and second digits is',
                        'The sum of the first and third digits is',
                        'The sum of the second and third digits is',
                        'The sum of all three digits is'],
  AbsoluteDifference:  ['The difference of the first and second digits is',
                        'The difference of the first and third digits is',
                        'The difference of the second and third digits is'],
  Products:            ['The product of the first and second digits is',
                        'The product of the first and third digits is',
                        'The product of the second and third digits is',
                        'The product of all three digits is'],
  Means:               ['The mean of the first and second digits is',
                        'The mean of the first and third digits is',
                        'The mean of the second and third digits is',
                        'The mean of all three digits is'],
  Range:               ['The range of all three digits is'],
};
```

**CRITICAL WARNING — Duplicate Header Strings:** Columns 1–3 and columns 4–6 share the same text after trimming: `"The first digit is"`, `"The second digit is"`, `"The third digit is"`. The filter loop must NOT use column header strings as keys into row objects directly for the SpecialNumbers group — or if it does, it must use the 4th/5th/6th occurrence from `gameHeaders`, not the 1st/2nd/3rd. The safest approach: look up column headers from `gameHeaders` by index and confirm they resolve to the correct column.

**Recommended resolution:** Use `gameHeaders.indexOf(header, 4)` to find SpecialNumbers headers starting from index 4, ensuring the second occurrence is found rather than the first. Alternatively, define RANGE_GROUPS using indices instead of strings:

```javascript
// Index-based approach — avoids duplicate-string ambiguity entirely
const RANGE_GROUPS = {
  SpecialNumbers:      [4, 5, 6],
  Sums:                [7, 8, 9, 10],
  AbsoluteDifference:  [11, 12, 13],
  Products:            [14, 15, 16, 17],
  Means:               [18, 19, 20, 21],
  Range:               [22],
};
// Then resolve to header string: gameHeaders[colIndex]
```

This index-based approach eliminates the duplicate-name ambiguity completely and is the recommended implementation.

### Pattern 2: The Filter Loop

**What:** Iterative loop that maintains a `candidates` array and a `triedRanges` Set, applies random valid filters, and records clues.

**When to use:** Always — this is the core algorithm.

```javascript
function runFilterLoop(rows) {
  const ITERATION_CAP = 100;
  let candidates = [...rows]; // shallow copy — never mutate gameRows
  const clues = [];
  const triedRanges = new Set();
  const rangeNames = Object.keys(RANGE_GROUPS);
  let iterations = 0;

  while (candidates.length > 1 && triedRanges.size < rangeNames.length) {
    if (iterations++ >= ITERATION_CAP) break;

    // Pick a random untried range
    const untriedRanges = rangeNames.filter(name => !triedRanges.has(name));
    const rangeName = untriedRanges[Math.floor(Math.random() * untriedRanges.length)];
    const colIndices = RANGE_GROUPS[rangeName];

    // Pick a random column within the range
    const colIndex = colIndices[Math.floor(Math.random() * colIndices.length)];
    const colHeader = gameHeaders[colIndex];
    const isText = typeof candidates[0][colHeader] === 'string';

    // FILT-06: Skip if column is uniform among current candidates
    const values = candidates.map(r => r[colHeader]);
    if (new Set(values).size === 1) {
      triedRanges.add(rangeName); // mark this range as tried
      continue;
    }

    // Pick a random value from current candidates in this column
    const value = values[Math.floor(Math.random() * values.length)];

    // Pick a random operator appropriate to column type
    const operators = isText ? ['=', '!='] : ['<=', '=', '!=', '>='];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    // FILT-05: Test filter — skip if it would eliminate all candidates
    const filtered = applyFilter(candidates, colHeader, operator, value);
    if (filtered.length === 0) continue; // do NOT mark range as tried — try again

    // Apply filter and record clue
    candidates = filtered;
    clues.push({ label: colHeader, operator, value });
    triedRanges.add(rangeName);
  }

  // FILT-10: answer is the Number field of the surviving row
  const answer = candidates[0]['Number'];
  return { answer, clues };
}

function applyFilter(candidates, colHeader, operator, value) {
  return candidates.filter(row => {
    const v = row[colHeader];
    switch (operator) {
      case '=':  return v === value;
      case '!=': return v !== value;
      case '<=': return v <= value;
      case '>=': return v >= value;
      default:   return true;
    }
  });
}
```

### Anti-Patterns to Avoid

- **Mutating `gameRows` directly:** Always `[...rows]` at the start. Mutation would corrupt the source data for subsequent `runFilterLoop` calls.
- **Using column header strings as object keys for SpecialNumbers without index disambiguation:** Cols 1–3 and cols 4–6 share the same trimmed header text. Using `row['The first digit is']` is ambiguous — PapaParse's `header: true` with duplicate column names will overwrite earlier values. Verify actual key behavior (see Pitfalls section).
- **Marking a range as tried when FILT-05 fires:** A filter that eliminates all candidates is not the same as a range being exhausted. Only mark a range tried when a filter from that range is actually applied (or when FILT-06 fires — the column is uniform, meaning the range cannot contribute).
- **Infinite loop without cap:** The combination of FILT-05 (no candidates eliminated) and FILT-06 (uniform column) can cause the loop to spin on a range indefinitely if the range is not marked tried. Mark the range as tried on FILT-06 but not on FILT-05.
- **Returning `undefined` answer on cap hit:** The cap is a safety escape, not an error state. Always return `candidates[0]['Number']` — whatever row is first in the remaining candidates is the answer.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array shuffling | Fisher-Yates shuffle function | `array[Math.floor(Math.random() * array.length)]` for random element selection | Phase 2 only needs a random element, not a shuffled array; YAGNI |
| Type detection per column | Column type lookup table | `typeof candidates[0][colHeader] === 'string'` | PapaParse's `dynamicTyping: true` has already typed every value correctly; one `typeof` check is sufficient |
| Seeded RNG | Custom LCG or Xorshift | `Math.random()` | Seeded RNG is only needed for daily-puzzle mode (v2 scope); Phase 2 needs randomness, not reproducibility |
| Operator dispatch | `eval(expression)` | Explicit `switch (operator)` | `eval` is a security risk and slower; four cases are trivially handled |

**Key insight:** The filter engine is pure array processing. Every operation it needs (`filter`, `map`, `Set`, `typeof`, `Math.random`) is native JS. Adding any library would be scope creep with zero benefit.

---

## Common Pitfalls

### Pitfall 1: Duplicate Column Headers After Trimming

**What goes wrong:** `gameHeaders` contains `"The first digit is"` at index 1, 2, 3 AND (after trimming) at index 4, 5, 6. When PapaParse encounters duplicate headers with `header: true`, it appends `_1`, `_2`, etc. to disambiguate. The actual keys in row objects may be `"The first digit is_1"`, `"The second digit is_1"`, `"The third digit is_1"` for the second occurrence.

**Why it happens:** PapaParse detects duplicate header strings and appends a suffix. The behavior is version-dependent — PapaParse 5.x uses `_1`, `_2` suffixes.

**How to avoid:** Before implementing the filter loop, verify the actual keys in `gameRows[0]` by logging them in the browser console. If suffixes are present, `RANGE_GROUPS` must use the suffixed names. Alternatively, use index-based column access (`gameHeaders[colIndex]` as the key) — but only if `gameHeaders` reflects the actual row object keys (which may also be suffixed).

**Warning signs:** `row['The first digit is']` returning the raw digit value (1, 2, ...) instead of the text label ("a prime number", etc.). Or `row[gameHeaders[4]]` returning `undefined`.

**Resolution:** Log `Object.keys(gameRows[0])` in the browser after Phase 1 loads. Confirm whether SpecialNumbers columns have suffix keys. Update `RANGE_GROUPS` accordingly.

### Pitfall 2: FILT-05 vs. FILT-06 Range-Tried Logic

**What goes wrong:** The loop never marks a range as tried after a FILT-05 skip (filter would eliminate all). If the same range is consistently selected and consistently fails FILT-05 (unlikely but possible), the loop spins until the iteration cap. Separately, marking a range tried on FILT-05 means a valid filter in that range might never be tried.

**Why it happens:** FILT-05 and FILT-06 are both "skip" conditions but have different semantics. FILT-06 (uniform column) means the range is informationally exhausted. FILT-05 (eliminates all) means the chosen filter parameters were bad — but another column in the same range might work fine.

**How to avoid:** On FILT-06: mark range as tried (the column provides no information; if all columns in the range are uniform, retrying won't help). On FILT-05: do NOT mark range as tried — retry with a different column/value/operator. The iteration cap is the safety net for FILT-05 cycles.

### Pitfall 3: Random Value Selection Including Non-Candidate Values

**What goes wrong:** The loop picks a random value from all rows (900), not from current candidates. The value "3" might not appear in any current candidate's column, making certain operators trivially useless.

**Why it happens:** Using `gameRows` instead of `candidates` as the value source.

**How to avoid:** Always sample the random value from `candidates.map(r => r[colHeader])`.

### Pitfall 4: Floating-Point Number Comparison

**What goes wrong:** Numbers like `4.00` (from 444's row) and `4` (from other rows) fail `===` equality due to floating-point representation differences.

**Why it happens:** PapaParse's `dynamicTyping` may parse `"4.00"` as `4` (number) and `"4"` as `4` (number) — these compare equal in JS. However, some cells in data.csv use `".00"` format (e.g., 444 and 999's rows). In practice, `4.00 === 4` is `true` in JavaScript, so strict equality works correctly.

**How to avoid:** This is actually a non-issue in JS: `4.00 === 4` is `true`. No special handling needed. But verify in the browser if filter results seem wrong for rows like 444 and 999.

### Pitfall 5: clues Array is Empty If No Filter Was Applied

**What goes wrong:** FILT-01–07 can be satisfied without any clue being recorded if the loop terminates with all ranges tried but no filter ever passed both FILT-05 and FILT-06 tests. `clues` would be an empty array, violating the success criterion ("clues is a non-empty array").

**Why it happens:** Extremely unusual data or a very high FILT-05/FILT-06 skip rate.

**How to avoid:** After the loop, if `clues.length === 0`, the function should attempt a single forced filter: pick the first column with any variance, apply `=` to the first candidate's value, and record that clue. Alternatively, accept that the success criterion requires at least one clue and ensure the loop always makes at least one successful filter application before terminating.

---

## Code Examples

### Full runFilterLoop Implementation Pattern

```javascript
// Source: FILT-01 through FILT-10 requirements + direct data.csv inspection
// Appended to app.js after loadData()

// IMPORTANT: verify actual PapaParse key names for SpecialNumbers cols before shipping
// (see Pitfall 1 — duplicate header disambiguation)
const RANGE_GROUPS = {
  SpecialNumbers:     [4, 5, 6],
  Sums:               [7, 8, 9, 10],
  AbsoluteDifference: [11, 12, 13],
  Products:           [14, 15, 16, 17],
  Means:              [18, 19, 20, 21],
  Range:              [22],
};

const ITERATION_CAP = 100;

function applyFilter(candidates, colHeader, operator, value) {
  return candidates.filter(row => {
    const v = row[colHeader];
    if (operator === '=')  return v === value;
    if (operator === '!=') return v !== value;
    if (operator === '<=') return v <= value;
    if (operator === '>=') return v >= value;
    return true;
  });
}

function runFilterLoop(rows) {
  let candidates = [...rows];            // FILT-02: start with all data rows
  const clues = [];                      // FILT-09: accumulated clues
  const triedRanges = new Set();
  const rangeNames = Object.keys(RANGE_GROUPS);
  let iterations = 0;

  // FILT-07 + FILT-08: terminate on 1 candidate, all ranges tried, or iteration cap
  while (candidates.length > 1 && triedRanges.size < rangeNames.length) {
    if (++iterations > ITERATION_CAP) break;

    // FILT-03a: pick a random untried range
    const untriedRanges = rangeNames.filter(n => !triedRanges.has(n));
    const rangeName = untriedRanges[Math.floor(Math.random() * untriedRanges.length)];
    const colIndices = RANGE_GROUPS[rangeName];

    // FILT-03b: pick a random column within the range
    const colIndex = colIndices[Math.floor(Math.random() * colIndices.length)];
    const colHeader = gameHeaders[colIndex]; // resolved from gameHeaders, which reflects actual row keys

    // FILT-06: skip if column is uniform (all candidates have the same value)
    const values = candidates.map(r => r[colHeader]);
    if (new Set(values).size === 1) {
      triedRanges.add(rangeName); // range is informationally exhausted
      continue;
    }

    // FILT-03c: pick a random value from current candidates
    const value = values[Math.floor(Math.random() * values.length)];

    // FILT-04: pick a random operator appropriate to the column type
    const isText = typeof value === 'string';
    const ops = isText ? ['=', '!='] : ['<=', '=', '!=', '>='];
    const operator = ops[Math.floor(Math.random() * ops.length)];

    // FILT-05: skip if filter would eliminate all candidates
    const filtered = applyFilter(candidates, colHeader, operator, value);
    if (filtered.length === 0) continue; // do NOT mark range as tried

    // Valid filter — apply it and record clue
    candidates = filtered;
    clues.push({ label: colHeader, operator, value }); // FILT-09
    triedRanges.add(rangeName);
  }

  // FILT-10: answer is the Number field of the first surviving row
  return { answer: candidates[0]['Number'], clues };
}
```

### Browser Console Stress Test Pattern

```javascript
// Run in browser console after Phase 2 is implemented to verify success criterion 2
// "Running the filter loop 50 times always terminates and never produces the same answer twice in a row"
const results = [];
for (let i = 0; i < 50; i++) {
  const { answer, clues } = runFilterLoop(gameRows);
  results.push(answer);
}
console.log('Answers:', results);
console.log('All terminated:', results.every(a => typeof a === 'number' && a >= 100 && a <= 999));
console.log('No consecutive duplicates:', results.every((a, i) => i === 0 || a !== results[i-1]));
```

### Verifying PapaParse Key Names for Duplicate Headers

```javascript
// Run in browser console immediately after Phase 1 loads, BEFORE implementing Phase 2
// This resolves Pitfall 1 — confirms actual key names in row objects
console.log('All keys in gameRows[0]:', Object.keys(gameRows[0]));
console.log('Key at index 4 (should be SpecialNumbers col):', gameHeaders[4]);
console.log('Value at gameHeaders[4]:', gameRows[0][gameHeaders[4]]);
// Expected: a string like "a prime number" or "a square or a cube number"
// If it returns a number (1, 0, etc.), gameHeaders[4] is resolving to the wrong column.
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| Apps Script for loop on Google Sheets data | Vanilla JS `Array.filter` on parsed CSV rows | Same logic, browser-native execution |
| Server-side filter computation | Client-side pure function | Static hosting; all computation in the browser |
| Column index arithmetic | Named `RANGE_GROUPS` constant | Readable, maintainable; no magic numbers |

---

## Open Questions

1. **Duplicate column header key disambiguation**
   - What we know: Cols 1–3 and cols 4–6 share the same trimmed header text. PapaParse 5.x uses `_1`, `_2` suffix disambiguation for duplicate headers.
   - What's unclear: Whether Phase 1's `transformHeader` also touches PapaParse's internal deduplication, or whether row object keys will contain `_1` suffixes.
   - Recommendation: This MUST be verified in the browser as a Wave 0 task before implementing `RANGE_GROUPS`. Log `Object.keys(gameRows[0])` and confirm the actual key names. This is a blocking discovery — the RANGE_GROUPS header strings depend on it.

2. **Minimum clue count guarantee**
   - What we know: Success criterion 1 requires "clues is a non-empty array."
   - What's unclear: Can the loop legitimately exit with zero clues in practice? (e.g., if 6 ranges are all uniform for the current candidate set.)
   - Recommendation: This is theoretically possible but extremely unlikely with 900 rows. Add a guard: if `clues.length === 0` after the loop, force-apply one clue using the first non-uniform column found via linear scan. Document this as the escape hatch.

3. **Iteration cap value**
   - What we know: FILT-08 mandates a cap; the value is not specified in requirements.
   - What's unclear: Whether 100 is too conservative (wastes compute on already-stuck loops) or too high (takes too long in degenerate cases).
   - Recommendation: 100 is appropriate. With 19 filterable columns and 6 ranges, a legitimate convergence path uses at most 6 successful filter applications. Any run reaching 100 iterations without convergence is stuck. Cap at 100.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — static browser app; no test runner |
| Config file | None |
| Quick run command | Browser console: `runFilterLoop(gameRows)` — verify output shape |
| Full suite command | Browser console stress test: 50-iteration loop (see Code Examples) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILT-01 | RANGE_GROUPS constant matches required col indices | unit (manual) | `console.log(RANGE_GROUPS)` — confirm 6 groups with correct indices | ❌ Wave 0 |
| FILT-02 | Loop starts with all 900 rows as candidates | smoke | `runFilterLoop(gameRows)` — before filtering, confirm no pre-filtering | ❌ Wave 0 |
| FILT-03 | Random range, column, value selection | smoke | Run 10x — verify different clue columns appear | ❌ Wave 0 |
| FILT-04 | Numeric cols use 4 operators; text cols use 2 | unit (manual) | Inspect clue.operator in returned clues; confirm text cols show `=` or `!=` only | ❌ Wave 0 |
| FILT-05 | Filter skipped if it eliminates all candidates | smoke | No clue should produce a filter that reduces candidates to 0 mid-loop | ❌ Wave 0 |
| FILT-06 | Filter skipped if column is uniform | smoke | Run with a filtered subset where one col is uniform; confirm loop continues | ❌ Wave 0 |
| FILT-07 | Loop terminates when 1 candidate or 6 ranges tried | smoke | 50-iteration stress test — all calls return | ❌ Wave 0 |
| FILT-08 | Iteration cap prevents hang on pathological input | smoke | `runFilterLoop([gameRows.find(r => r.Number === 111)])` — confirm no hang | ❌ Wave 0 |
| FILT-09 | Each clue has `{ label, operator, value }` | unit (manual) | `runFilterLoop(gameRows).clues[0]` — confirm shape | ❌ Wave 0 |
| FILT-10 | answer is Number field of surviving row (100–999) | unit (manual) | `runFilterLoop(gameRows).answer` — confirm `typeof answer === 'number' && answer >= 100` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `runFilterLoop(gameRows)` in browser console — confirm `{ answer, clues }` shape
- **Per wave merge:** 50-iteration stress test + FILT-08 single-row test
- **Phase gate:** All 10 FILT manual checks pass before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Verify actual PapaParse key names for duplicate headers: `Object.keys(gameRows[0])` — BLOCKING
- [ ] Manual test checklist: `.planning/phases/02-filtering-engine/MANUAL-TEST-CHECKLIST.md`
- [ ] 50-iteration stress test script for browser console (copy-paste ready)

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `/data.csv` — column indices, header strings, data types, repeated-digit edge cases confirmed by `head`, `awk`, `grep` commands
- Direct inspection of `/app.js` and `/index.html` — confirms module-scoped `gameRows`/`gameHeaders` pattern from Phase 1
- REQUIREMENTS.md — FILT-01 through FILT-10 requirements are the authoritative spec
- STATE.md — confirms research flag and locked decisions (vanilla JS, no framework, port logic 1:1)

### Secondary (MEDIUM confidence)
- Phase 1 RESEARCH.md — confirmed PapaParse `dynamicTyping: true` behavior; `transformHeader` already applied to `gameHeaders`
- Phase 1 01-02-PLAN.md — confirms `gameRows` and `gameHeaders` are module-scoped `let` variables accessible to Phase 2 code in the same file

### Tertiary (LOW confidence)
- PapaParse duplicate header behavior (suffix `_1`): behavior documented in PapaParse source and GitHub issues; should be verified in-browser for this project specifically before coding against it

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure vanilla JS; no library decisions needed; all APIs are native
- Architecture: HIGH — single-file pattern locked by Phase 1; column mapping confirmed by direct data inspection
- Pitfalls: HIGH — duplicate header issue confirmed by data inspection; other pitfalls derived from algorithm analysis and JS semantics
- Edge cases: HIGH — repeated-digit behavior confirmed by direct CSV row inspection

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (data.csv is static; vanilla JS APIs are stable; no library drift risk)
