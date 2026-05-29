---
status: partial
phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
source: [05-VERIFICATION.md]
started: 2026-05-30T00:30:00Z
updated: 2026-05-30T00:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. saveScore=off still writes {date,tries} on daily solve (WR-02 semantic change)
expected: With saveScore off, solve a daily puzzle. localStorage `dlng_history` has a `{date, tries}` entry with no `answer` field. Reload shows "already solved today", not a fresh puzzle. Product owner accepts that "don't save my score" now means "save date+tries, omit answer" — or decides the preference should suppress even the minimal entry (would need a separate solved-marker key).
result: [pending]

### 2. Archive replay does not leak into daily resume (D-08 partial)
expected: Start an archive replay, eliminate digits, reload. The daily puzzle starts fresh (not restored to the archive board). `dlng_active` is absent or holds a past-dated entry that `loadActive` discards on the next daily load. Confirm no edge case where an archive entry dated "today" interferes with the daily restore.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
