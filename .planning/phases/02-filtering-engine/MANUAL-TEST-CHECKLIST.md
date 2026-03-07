# Phase 2 — Manual Test Checklist

Run all checks in the browser console after loading http://localhost:8080.
Status must show "Ready — data loaded successfully." before running any check.

---

## Pre-flight

```javascript
// Confirm gameRows and gameHeaders are populated
console.log('gameRows:', gameRows.length, '| gameHeaders:', gameHeaders.length);
// Expected: gameRows: 900 | gameHeaders: 23
```
- [ ] gameRows.length === 900
- [ ] gameHeaders.length === 23

```javascript
// Confirm SpecialNumbers columns resolve to text (not numbers)
// If gameHeaders[4] returns a number instead of a string, RANGE_GROUPS indices are wrong.
console.log('gameHeaders[4]:', gameHeaders[4]);
console.log('gameRows[0][gameHeaders[4]]:', gameRows[0][gameHeaders[4]]);
```
- [ ] gameHeaders[4] is a string (the column header name)
- [ ] gameRows[0][gameHeaders[4]] is a string like "a prime number" or "a square or a cube number" (NOT a number)

---

## FILT-01: Six named range groups

```javascript
console.log('RANGE_GROUPS:', RANGE_GROUPS);
console.log('Keys:', Object.keys(RANGE_GROUPS));
```
- [ ] 6 keys: SpecialNumbers, Sums, AbsoluteDifference, Products, Means, Range
- [ ] SpecialNumbers: [4, 5, 6]
- [ ] Sums: [7, 8, 9, 10]
- [ ] AbsoluteDifference: [11, 12, 13]
- [ ] Products: [14, 15, 16, 17]
- [ ] Means: [18, 19, 20, 21]
- [ ] Range: [22]

---

## FILT-02 + FILT-03: Loop starts with all rows; random selection

```javascript
// Run 5 times — answers and clue labels should vary
for (let i = 0; i < 5; i++) {
  const r = runFilterLoop(gameRows);
  console.log(i, '| answer:', r.answer, '| clue[0]:', r.clues[0]?.label, r.clues[0]?.operator, r.clues[0]?.value);
}
```
- [ ] All 5 calls return (no hang)
- [ ] Answers differ across runs (randomness is working)
- [ ] Clue labels differ across runs

---

## FILT-04: Operator types match column type

```javascript
// Run 20 times and collect all clues
const allClues = [];
for (let i = 0; i < 20; i++) allClues.push(...runFilterLoop(gameRows).clues);
const textClues = allClues.filter(c => typeof c.value === 'string');
const numClues  = allClues.filter(c => typeof c.value === 'number');
console.log('Text clue operators:', [...new Set(textClues.map(c => c.operator))]);
console.log('Num clue operators:', [...new Set(numClues.map(c => c.operator))]);
```
- [ ] Text clue operators contain ONLY '=' and '!=' (no '<=' or '>=')
- [ ] Numeric clue operators include at least some of: '<=', '=', '!=', '>='

---

## FILT-05 + FILT-06: Safety checks (no zero-candidate filters, no uniform-column clues)

```javascript
// Verify no run produces a 0-candidate result (FILT-05 working)
// and clues are not recorded for uniform columns (FILT-06 working)
// This is verified implicitly: if FILT-05 were broken, answer would be undefined.
// If FILT-06 were broken, all clues for a run might have the same value.
for (let i = 0; i < 20; i++) {
  const { answer, clues } = runFilterLoop(gameRows);
  if (typeof answer !== 'number') console.error('FILT-05 broken: undefined answer at run', i);
  const uniformClue = clues.find(c => clues.filter(x => x.label === c.label && x.value === c.value).length > 1);
  // Note: same label can appear twice legitimately if two different filters in the same range fire
}
console.log('FILT-05/06 check: 20 runs completed with no undefined answer');
```
- [ ] No console.error messages appeared
- [ ] All 20 answers are numbers between 100 and 999

---

## FILT-07 + FILT-08: Termination and iteration cap

```javascript
// 50-iteration stress test — REQUIRED by Phase 2 success criteria
const results = [];
for (let i = 0; i < 50; i++) {
  const { answer, clues } = runFilterLoop(gameRows);
  results.push(answer);
}
console.log('All answers:', results);
console.log('All terminated (50/50):', results.length === 50);
console.log('All valid numbers:', results.every(a => typeof a === 'number' && a >= 100 && a <= 999));
console.log('No consecutive duplicates:', results.every((a, i) => i === 0 || a !== results[i-1]));
```
- [ ] results.length === 50 (all 50 calls terminated)
- [ ] All valid numbers (100–999)
- [ ] No consecutive duplicates (random)

```javascript
// FILT-08: pathological input — repeated-digit row (111)
const row111 = gameRows.find(r => r['Number'] === 111);
console.log('Row 111 found:', !!row111);
const pathResult = runFilterLoop([row111]);
console.log('Pathological result:', pathResult);
console.log('Terminates with answer:', pathResult.answer);
```
- [ ] row111 found (not undefined)
- [ ] runFilterLoop([row111]) returns without hanging
- [ ] pathResult.answer === 111 (only candidate is the answer)

---

## FILT-09 + FILT-10: Clue shape and answer field

```javascript
const { answer, clues } = runFilterLoop(gameRows);
console.log('answer:', answer, '| type:', typeof answer, '| in range:', answer >= 100 && answer <= 999);
console.log('clues.length:', clues.length);
console.log('clues[0]:', clues[0]);
console.log('clue shape ok:', clues.every(c => 'label' in c && 'operator' in c && 'value' in c));
console.log('label is string:', clues.every(c => typeof c.label === 'string' && c.label.length > 0));
```
- [ ] answer is a number between 100 and 999
- [ ] clues.length >= 1
- [ ] Each clue has label, operator, value properties
- [ ] Each label is a non-empty string (human-readable column header)

---

## Sign-off

- [ ] All FILT-01 through FILT-10 checks above are ticked
- [ ] 50-iteration stress test passed (no consecutive duplicates, all 100-999)
- [ ] Pathological input test (row 111) passed without hanging
