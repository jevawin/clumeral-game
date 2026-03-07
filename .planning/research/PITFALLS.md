# Pitfalls Research

**Domain:** Static vanilla JS browser puzzle game with CSV data and filtering logic
**Researched:** 2026-03-07
**Confidence:** HIGH (core pitfalls drawn from MDN, caniuse.com, GitHub Pages docs, and direct inspection of data.csv)

---

## Critical Pitfalls

### Pitfall 1: fetch() Fails Silently When Opened via file:// Protocol

**What goes wrong:**
The game appears to load but shows nothing, or throws an opaque error in the console. `fetch('data.csv')` works fine on GitHub Pages (HTTP/HTTPS) but fails when the developer opens `index.html` directly from the filesystem (`file://` protocol). Chrome and Firefox treat `file://` as a null origin and block cross-origin requests, which includes loading a sibling file via fetch.

**Why it happens:**
CORS applies at the browser level regardless of whether there is a server involved. When using `file://`, even requests to files on the same machine are considered cross-origin in Chrome's strict model. Developers who have GitHub Pages as their target assume "it works in production" without setting up a local server for development, and then spend time debugging filtering logic when the real problem is data never loaded.

**How to avoid:**
Always run a local HTTP server during development. The simplest options for a no-dependency project:
- `python3 -m http.server 8080` in the project root
- `npx serve .` (one-off, no install)
- VS Code Live Server extension

Add a visible error state in the UI when `fetch()` fails (not just a console.log) so the failure mode is obvious rather than silent. The error handler should display a human-readable message like "Could not load puzzle data — open this page via a local server."

**Warning signs:**
- Game UI renders but puzzle never appears
- Console shows `TypeError: Failed to fetch` or `CORS request not HTTP`
- Works after deploying to GitHub Pages but not locally

**Phase to address:** CSV loading / data layer phase (the first implementation phase)

---

### Pitfall 2: Trailing Spaces in CSV Column Headers Break Lookup

**What goes wrong:**
Column lookups by name silently return `undefined`. The filter logic never matches any columns and the puzzle either hangs or produces zero clues.

**Why it happens:**
The actual `data.csv` header row contains trailing spaces on several column names:
- `"The first digit is "` (col 4, note trailing space)
- `"The difference of the second and third digits is "` (col 12, trailing space)
- `"The product of all three digits is "` (col 17, trailing space)
- `"The range of all three digits is "` (col 22, trailing space)

A naive CSV parser that splits on commas and reads the raw string will produce these keys with trailing spaces. Any code that looks up columns by a clean string like `"The range of all three digits is"` will fail to find the column, because `"The range of all three digits is" !== "The range of all three digits is "`.

**How to avoid:**
Trim every parsed header value when building the column index: `headers = rawHeaders.map(h => h.trim())`. Apply the same trim to any dynamically referenced column name. Verify this during the CSV parse step with a `console.log` of the parsed headers array before any other logic runs.

**Warning signs:**
- Filter logic runs but never matches the SpecialNumbers columns (cols 4–6) or Range column (col 22)
- Puzzle generates with far fewer clue types than expected
- `Object.keys(row)` shows keys with trailing spaces in devtools

**Phase to address:** CSV loading / data layer phase — header normalisation must happen at parse time, not be patched later

---

### Pitfall 3: Infinite Loop When Filter Cannot Converge

**What goes wrong:**
The browser tab freezes. The filtering loop keeps running and never terminates because no combination of remaining columns, operators, and values can reduce the candidate set to exactly one row.

**Why it happens:**
The algorithm picks a random untried filter on each pass and discards filters that would eliminate all candidates. But there are edge cases where the remaining candidate set has no column that differentiates the rows (all remaining rows share the same value for every remaining column). The loop exhausts all valid filters without reaching one candidate, and if no termination guard is in place it spins forever.

This is a real risk for numbers where many digit combinations produce identical computed values across all 19 filterable numeric columns — for example, numbers whose digits are all equal (111, 222, … 999) may have perfectly uniform sum, product, mean, and difference columns.

**How to avoid:**
Add a hard iteration cap (e.g., 500 attempts) and a "unsolvable" escape path that picks the nearest single candidate or re-rolls the entire puzzle with a different random seed. Log the iteration count during development. Never rely solely on the `skip if column is uniform` guard — it prevents wasted passes but does not guarantee convergence.

**Warning signs:**
- "New Puzzle" button hangs the tab for several seconds
- Certain numbers (especially repeated-digit numbers) always hang
- No puzzle is displayed after a long wait

**Phase to address:** Filtering algorithm implementation phase — build the iteration cap before running the first end-to-end puzzle test

---

### Pitfall 4: Naive CSV Split on Commas Breaks on Quoted Fields

**What goes wrong:**
Column values are misaligned — numeric columns read text, text columns read numbers. Clue labels and filter values are wrong.

**Why it happens:**
`row.split(',')` does not handle RFC 4180 CSV correctly. If any cell value ever contains a comma (e.g., a text label like `"a prime, or a square"`) and is quoted, the naive split produces extra columns and shifts all subsequent values one column to the right. The current `data.csv` appears to use simple unquoted text values, but this is a fragile assumption.

**How to avoid:**
Inspect the actual `data.csv` values to confirm no quoted commas exist. If confirmed, the naive split is safe for this dataset — but add an assertion at parse time: verify that every parsed row has exactly the expected column count (23 columns). If the count is wrong, throw a clear error rather than silently proceeding with misaligned data. This catches any future changes to `data.csv`.

**Warning signs:**
- Row column count mismatches when logged
- Numeric filter values are strings like `"a prime number,1"` (contains both parts)
- Puzzle answers are wrong or filter produces nonsensical clues

**Phase to address:** CSV loading / data layer phase — add the column count assertion as part of the parse validation step

---

### Pitfall 5: backdrop-filter Requires -webkit- Prefix for Full Safari Support

**What goes wrong:**
The frosted glass card effect shows as a flat, opaque panel in Safari without the `-webkit-` prefix. The design reference (n8n.io aesthetic) relies heavily on this effect, so missing it breaks a core visual requirement.

**Why it happens:**
Safari requires `-webkit-backdrop-filter` alongside the standard `backdrop-filter` property. Developers writing only the standard property check Chrome (which works without prefix), ship, and never test in Safari.

**How to avoid:**
Always write both declarations:
```css
-webkit-backdrop-filter: blur(12px);
backdrop-filter: blur(12px);
```
Also ensure there is a fallback background color with sufficient opacity for any browser that does not support `backdrop-filter` at all. Without a fallback, text becomes unreadable against a dark background without the blur.

**Warning signs:**
- Cards look like flat translucent boxes in Safari
- Devtools shows `backdrop-filter` applied but no visual blur
- The `-webkit-backdrop-filter` property is absent from computed styles

**Phase to address:** UI / CSS implementation phase — apply prefix and fallback at time of initial CSS authoring

---

### Pitfall 6: GitHub Pages Serves From a Subdirectory Path, Breaking Absolute Asset References

**What goes wrong:**
The page loads but `data.csv` (or any other asset) returns 404. Works locally, breaks on GitHub Pages.

**Why it happens:**
GitHub Pages serves project sites from `https://username.github.io/repo-name/` — not from the root `/`. Any asset path that starts with `/data.csv` resolves to `https://username.github.io/data.csv` (the account root, which doesn't exist) instead of `https://username.github.io/repo-name/data.csv`. This only manifests after deployment; local development via `file://` or a local server at `localhost:8080` always uses the correct relative path.

**How to avoid:**
Use relative asset paths exclusively — `fetch('data.csv')` not `fetch('/data.csv')`. Since this is a single `index.html` in the repository root, relative paths work correctly both locally and on GitHub Pages. Never use root-relative paths (`/`) for assets in a project that will be hosted on GitHub Pages under a repo subdirectory.

**Warning signs:**
- Game works on localhost but puzzle never loads after deployment
- Browser network tab shows `404` for `data.csv` with URL `https://username.github.io/data.csv`
- Console shows `Failed to fetch` after deploy

**Phase to address:** Deployment / GitHub Pages setup phase — validate relative paths before first deploy

---

### Pitfall 7: Uniform-Column Detection Doesn't Account for Numeric Type Coercion

**What goes wrong:**
The filter incorrectly skips columns that are not actually uniform, or incorrectly includes columns that are uniform, because numeric CSV values are parsed as strings and compared with `===` against numbers.

**Why it happens:**
`fetch()` + `text()` + CSV split gives string values. The number `1` from the CSV is the string `"1"`. A comparison like `candidateValue === pickedValue` where one side is a number from the operator evaluation and the other is a string from the CSV will always be false (strict equality). Similarly, `<=` and `>=` operators using `>` on strings compare lexicographically: `"9" > "10"` is true in JS string comparison, which is wrong for numeric columns.

**How to avoid:**
Parse all numeric column values to numbers at CSV load time (not at filter time). Identify which columns are numeric vs text during the header parse step — columns 0 and 3 through 22 are numeric; columns 1–3 (raw digit labels) and 4–6 (SpecialNumbers text) are text. Coerce once at load, rely on typed values everywhere else.

**Warning signs:**
- Numeric filters using `<=` or `>=` produce wrong candidate sets
- Puzzles with correct-looking logic still yield wrong answers
- `"9" > "19"` evaluates as true in the filter — a diagnostic log of comparisons reveals string ordering

**Phase to address:** CSV loading / data layer phase and filtering algorithm phase — type coercion must be established during data load, verified during filter logic implementation

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Naive `row.split(',')` for CSV parsing | Simpler code | Breaks if data.csv ever gains quoted commas; silent misalignment | Only if a column-count assertion guards against misalignment |
| Hardcoded column index numbers (e.g., `cols[4]` through `cols[22]`) | Avoids header lookup complexity | Breaks silently if data.csv column order ever changes | Never — use named header lookup instead |
| No error UI for fetch failure | Less code to write | User sees blank page with no indication of what went wrong | Never — always surface fetch errors visibly |
| Skipping `-webkit-backdrop-filter` prefix | Cleaner CSS | Frosted glass broken in Safari | Never for this project's required visual design |
| No iteration cap on filter loop | Simpler algorithm | Tab freeze on pathological inputs | Never — a cap with escape path is 3 lines of code |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Pages | Using root-relative paths (`/data.csv`) | Use relative paths (`data.csv`) — repo served from subdirectory |
| GitHub Pages | Forgetting that deployment takes 1–3 minutes | Wait for the Pages build action to complete before testing |
| GitHub Pages | Testing only on main, not verifying the Pages source branch setting | Confirm in repo Settings → Pages that source is set to the correct branch and root |
| Local development server | Opening `index.html` directly in browser | Always use `python3 -m http.server` or equivalent |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-parsing `data.csv` on every "New Puzzle" click | Slight delay before each puzzle | Parse once on page load, store the rows array in module scope | Barely noticeable at 900 rows, but wasteful |
| Running the filter loop synchronously on the main thread | Long filter runs block UI, spinner never shows | For this dataset size (900 rows, ~19 columns), synchronous is fine; add a spinner before calling the filter fn | Not a real issue at this scale — note for future if dataset grows |
| Re-creating the entire DOM on each "New Puzzle" | Flash of content / layout shift | Clear and repopulate only the clue list and answer elements, not the entire page | Not a real issue at this scale |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state while CSV fetches | Page appears broken until data loads | Show a spinner or "Loading puzzle..." message immediately on page load |
| Showing all clues at once without explanation | User doesn't understand the goal | Display a short "Guess the number" heading and explain that all clues apply simultaneously |
| Accepting non-numeric input silently | User types letters and gets no feedback | Validate input to 3 digits immediately; disable or visually reject non-numeric entries |
| "New Puzzle" with no confirmation of reset | User mid-guess loses their work without knowing | Either show a brief "New puzzle loaded" confirmation, or only enable "New Puzzle" after a correct or incorrect guess |
| Puzzle that requires many clues to solve | User overwhelmed by a long clue list | Cap displayed clues at a reasonable number (e.g., 6–8) — the filtering loop already produces the minimum needed |

---

## "Looks Done But Isn't" Checklist

- [ ] **CSV loading:** Verify parsed header array in console — confirm no trailing spaces, confirm column count is 23
- [ ] **Numeric coercion:** Confirm that filter comparisons use numbers not strings — log `typeof` of candidate values after parse
- [ ] **Filter convergence:** Test against repeated-digit numbers (111, 222, 333 … 999) — confirm they resolve or gracefully escape
- [ ] **frosted glass:** Open in Safari — confirm `backdrop-filter` blur renders identically to Chrome
- [ ] **GitHub Pages deploy:** Fetch `data.csv` from the deployed URL in browser network tab — confirm 200 not 404
- [ ] **Iteration cap:** Add a `console.log` of iteration count per puzzle — confirm no puzzle exceeds a reasonable threshold
- [ ] **Error state:** Disconnect from the internet or rename `data.csv`, reload — confirm a human-readable error message appears (not a blank page)
- [ ] **"New Puzzle" state reset:** Click New Puzzle mid-answer — confirm previous guess input is cleared and clues are replaced, not appended

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| fetch() / file:// discovered late | LOW | Add local server to dev workflow; 5-minute fix |
| Trailing spaces in headers discovered in filter testing | LOW | Add `.trim()` to header parse; 1-line fix |
| Infinite loop discovered after shipping | MEDIUM | Add iteration cap + escape path; requires testing all numbers |
| Wrong numeric types discovered in filter | MEDIUM | Add coercion to parse step; retest all operator types |
| GitHub Pages 404 on data.csv | LOW | Change `/data.csv` to `data.csv`; redeploy |
| Safari backdrop-filter broken discovered post-ship | LOW | Add `-webkit-` prefix; redeploy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| fetch() fails on file:// | CSV / data loading phase | Confirm fetch works via local server before writing filter logic |
| Trailing spaces in headers | CSV / data loading phase | Log parsed headers array and assert 23 columns with trimmed names |
| Infinite filter loop | Filtering algorithm phase | Add iteration cap; test all repeated-digit numbers (111–999 step 111) |
| Naive CSV split misalignment | CSV / data loading phase | Assert row column count === 23 at parse time |
| backdrop-filter Safari prefix | UI / CSS phase | Visual QA in Safari before marking UI complete |
| GitHub Pages subdirectory 404 | Deployment phase | Check network tab for data.csv on live Pages URL |
| Numeric type coercion | CSV / data loading phase + filtering phase | Log `typeof` of parsed values; test `<=` and `>=` operators explicitly |

---

## Sources

- [MDN: CORS request not HTTP (file:// protocol explanation)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors/CORSRequestNotHttp)
- [MDN: backdrop-filter CSS property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)
- [caniuse.com: backdrop-filter support table](https://caniuse.com/css-backdrop-filter)
- [GitHub Pages: Troubleshooting 404 errors](https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites)
- [GitHub community: GitHub Pages subdirectory path issues](https://github.com/orgs/community/discussions/36908)
- [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [CSV RFC 4180 quoted field pitfalls (community summary)](https://greywyvern.com/258)
- Direct inspection of `data.csv` header row — trailing spaces on cols 4, 12, 17, 22 confirmed

---

*Pitfalls research for: static vanilla JS browser puzzle game with CSV data and filtering logic*
*Researched: 2026-03-07*
