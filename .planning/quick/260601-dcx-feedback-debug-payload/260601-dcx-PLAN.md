---
phase: quick-260601-dcx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/modals.ts
  - tests/feedback-debug.spec.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Every feedback POST (any category) carries 6 new debug fields plus the original 7"
    - "Corrupt, missing, or blocked localStorage never throws and never blocks the feedback send"
    - "The user-facing meta line tells the player game data is attached, in plain non-technical language"
  artifacts:
    - path: "src/modals.ts"
      provides: "collectDebug() helper + payload merge + meta-line copy"
      contains: "collectDebug"
    - path: "tests/feedback-debug.spec.ts"
      provides: "Unit assertions for the 6 new debug fields and storage safety"
      contains: "collectDebug"
  key_links:
    - from: "src/modals.ts collectDebug()"
      to: "localStorage dlng_history / dlng_prefs / dlng_active"
      via: "safe per-key getter wrapped in try/catch"
      pattern: "dlng_history"
    - from: "src/modals.ts submitFeedback payload"
      to: "collectDebug() return value"
      via: "object spread merge into POST body"
      pattern: "collectDebug"
---

<objective>
Attach browser diagnostic context to every feedback submission so confusing reports
(e.g. streak vs. days-played) can be debugged from the raw client state.

Purpose: Today the feedback POST sends only 7 fields and no game state. Adding
localStorage snapshots + timezone/screen context lets us reproduce reported bugs.
Output: A `collectDebug()` helper in src/modals.ts, 6 new fields merged into the POST
payload on all categories, an honest one-line meta note to the user, and a unit test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/modals.ts
@src/date.ts
@src/storage.ts

<interfaces>
<!-- Contracts the executor needs. Already in the codebase — no exploration required. -->

src/date.ts exports (import todayKey from './date.ts'):
```typescript
export function todayKey(): string;   // local YYYY-MM-DD, single source of truth
```

localStorage key names (verbatim, from src/storage.ts):
```
dlng_history   // game history JSON array
dlng_prefs     // prefs JSON object
dlng_active    // mid-game state JSON object
```

src/modals.ts current POST payload (around line 154-162) — the 7 fields to KEEP unchanged:
```typescript
const payload = {
  category, message, puzzleNumber, date, device, browser, userAgent,
};
```

Wiring (src/app.ts line 914) — do NOT change:
```typescript
initFeedbackModal(todayKey, puzzleNumberFor, formatDate);
```

Meta element (index.html line 93): `<div data-fb-meta ...>` — currently set by renderMeta()
at src/modals.ts line 115-119 to:
`Puzzle #N · 8 March 2026 · Desktop · Chrome 120`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add collectDebug() helper and merge 6 fields into the feedback payload</name>
  <files>src/modals.ts</files>
  <behavior>
    - collectDebug() returns an object with exactly: history, prefs, active, tzOffset, localToday, screen
    - history/prefs/active are the raw localStorage strings (NOT parsed)
    - A missing localStorage key yields "" (empty string), never undefined and never a throw
    - A getItem that throws (blocked/private mode) yields "" and does not propagate
    - tzOffset is a number from new Date().getTimezoneOffset()
    - localToday equals todayKey()
    - screen equals `${window.innerWidth}x${window.innerHeight}`
    - The POST payload still contains all 7 original fields plus the 6 new ones
  </behavior>
  <action>
    Import todayKey from './date.ts' at the top of src/modals.ts (formatDate-style import already used in app.ts; modals.ts does not yet import from date.ts — add the import).

    Add a module-level safe getter and a `collectDebug()` function (exported so the unit test can call it directly). The safe getter wraps a single localStorage.getItem call in its own try/catch and returns "" when the key is missing OR when access throws (private mode, blocked, quota). Use the verbatim key names dlng_history, dlng_prefs, dlng_active. Send history/prefs/active as raw strings — do NOT JSON.parse them.

    collectDebug() returns: history (raw string), prefs (raw string), active (raw string), tzOffset (new Date().getTimezoneOffset(), a number), localToday (todayKey()), screen (`${window.innerWidth}x${window.innerHeight}`).

    In submitFeedback() (around line 154-162), merge collectDebug() into the payload object via spread so all 6 fields attach on EVERY category (general, bug, suggestion, praise) — not bug-only. Keep the existing 7 fields byte-for-byte. Do NOT touch the no-cors fetch, the MAX_RETRIES loop, the backoff, or the success/failure toasts.

    Do not log raw debug to console beyond the existing console.error on exhausted retries (which already logs payload — leave it).
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>src/modals.ts compiles; collectDebug is exported; submitFeedback payload spreads collectDebug() while retaining category, message, puzzleNumber, date, device, browser, userAgent; no changes to fetch/retry logic.</done>
</task>

<task type="auto">
  <name>Task 2: Update the meta line and add a unit test for the new fields</name>
  <files>src/modals.ts, tests/feedback-debug.spec.ts</files>
  <action>
    In renderMeta() (src/modals.ts around line 115-119), append a short, honest, non-technical note that game data is attached. Keep the existing meta string intact and add the sentence after it, e.g. set textContent to the current string plus " · Game data attached to help debug." Do NOT dump raw JSON or field values into the user-facing element — only the plain note.

    Create tests/feedback-debug.spec.ts using vitest (match the style of tests/storage-active.spec.ts: setup.ts clears localStorage before each test). Import collectDebug from '../src/modals.ts'. Assert:
    - With dlng_history/dlng_prefs/dlng_active set in localStorage, collectDebug() returns those exact raw strings (unparsed) on history/prefs/active.
    - With keys absent, history/prefs/active are "" (empty string), and the call does not throw.
    - tzOffset is a number; localToday matches todayKey() (import from '../src/date.ts'); screen is a non-empty `WxH` string.
    Stub window.innerWidth/innerHeight if jsdom defaults are 0 — assert the string format `\d+x\d+` rather than exact pixels so the test is environment-stable.
  </action>
  <verify>
    <automated>npm test -- feedback-debug</automated>
  </verify>
  <done>Meta line shows the original info plus a short plain-English "game data attached" note; tests/feedback-debug.spec.ts passes; assertions cover raw-string passthrough, missing-key safety, and tzOffset/localToday/screen shape.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| localStorage → feedback payload | Attacker-controllable strings (dlng_*) are read and forwarded to the webhook |
| client → Google Apps Script webhook | Untrusted client data crosses to the sheet writer (out of repo scope) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-dcx-01 | Denial of Service | collectDebug() reading localStorage | mitigate | Each getItem wrapped in its own try/catch returning "" — blocked/private/quota errors never throw or block the send |
| T-dcx-02 | Information Disclosure | raw dlng_* strings sent to webhook | accept | Game state is non-PII (digits, dates, prefs); deliberately attached for debugging per task goal; webhook is operator-owned |
| T-dcx-03 | Information Disclosure | user-facing meta line | mitigate | Show only a plain note; never render raw JSON/field values to the player |
| T-dcx-04 | Tampering | forged dlng_active payload | accept | Sent as raw string for diagnostics only; never parsed or trusted by this code path; existing loadActive validation unchanged |
</threat_model>

<verification>
- `npm run build` succeeds (production build catches build-only TS/bundle errors per CLAUDE.md QA note).
- `npm test -- feedback-debug` passes.
- Manual spot-check (optional, light QA): the 7 original payload keys are unchanged; the 6 new keys are present.
</verification>

<success_criteria>
- collectDebug() exists and is exported from src/modals.ts.
- Feedback POST payload contains the original 7 fields + history, prefs, active, tzOffset, localToday, screen on all categories.
- Missing/blocked localStorage yields "" and never breaks the send.
- Meta line carries a short, honest, non-technical "game data attached" note with no raw JSON.
- todayKey imported from './date.ts'; no-cors POST + retry logic unchanged; no backend changes.
</success_criteria>

<output>
Create `.planning/quick/260601-dcx-feedback-debug-payload/260601-dcx-SUMMARY.md` when done
</output>
