# Phase 1 — Manual Test Checklist

**How to run:** Serve the project via local HTTP server before any test.
```
python3 -m http.server 8080
```
Then open http://localhost:8080 in Chrome or Firefox.

**Do NOT open index.html via double-click** — fetch() is blocked on file:// URLs.

---

## Pre-flight

- [ ] Local HTTP server is running (port 8080 or Live Server)
- [ ] Browser devtools are open (F12), Console and Network tabs visible
- [ ] data.csv is present in the project root

---

## DATA-01: CSV fetched on page load

1. Open http://localhost:8080
2. Open the Network tab in devtools
3. Reload the page
4. **PASS** if: `data.csv` appears in the Network tab with status 200
5. **FAIL** if: data.csv is absent or shows an error status

---

## DATA-02: Numeric columns are JavaScript numbers

1. Load http://localhost:8080
2. Wait for the console to show the "data.csv loaded" message
3. In the devtools Console, run: `typeof gameRows[0]['Number']`
4. **PASS** if: output is `"number"`
5. **FAIL** if: output is `"string"` or `undefined`

Also run: `typeof gameRows[0]['Attendance']`
**PASS** if: output is `"number"`

---

## DATA-03: All 23 headers have no trailing whitespace

1. Load http://localhost:8080
2. In the Console, run: `gameHeaders`
3. **PASS** if: no header string ends with a space character (inspect all 23)
4. **FAIL** if: any header has trailing/leading whitespace

Quick check — run: `gameHeaders.some(h => h !== h.trim())`
**PASS** if: output is `false`

Known affected headers (must be trimmed): indices 4, 13, 17, 22

---

## DATA-04: Row 0 of results is a data row, not a header string

1. Load http://localhost:8080
2. In the Console, run: `gameRows[0]`
3. **PASS** if: output is an object like `{ Number: 100, ... }` (numeric keys, object values)
4. **FAIL** if: output is a string like `"Number"` or a row with string-only values

Also run: `typeof gameRows[0]['Number']`
**PASS** if: `"number"`

---

## DATA-05: Loading indicator visible before data arrives

1. Open devtools → Network tab → set throttle to "Slow 3G"
2. Reload http://localhost:8080
3. **PASS** if: "Loading..." is visible in the page while the network request is in progress
4. **FAIL** if: the page is blank or shows an error before data.csv loads

Reset throttle to "No throttling" after this test.

---

## DATA-06: Error message shown when fetch fails

1. Rename `data.csv` to `data.csv.bak` in the project root
2. Reload http://localhost:8080
3. **PASS** if: the page shows an error message (e.g., "Error: could not load data.csv") — NOT a blank page, NOT "Loading..."
4. **FAIL** if: page is blank or stuck on "Loading..."

Restore after test: rename `data.csv.bak` back to `data.csv`

---

## Sign-Off

- [ ] DATA-01 PASS
- [ ] DATA-02 PASS
- [ ] DATA-03 PASS
- [ ] DATA-04 PASS
- [ ] DATA-05 PASS
- [ ] DATA-06 PASS

All 6 checks pass → Phase 1 complete. Proceed to `/gsd:verify-work`.
