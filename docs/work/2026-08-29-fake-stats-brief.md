# Brief — a dev-only link to the stats page with fake stats

Date: 2026-08-29 · Branch: `dev/edit-mode-roundtrip` · Asked for by: Jamie

Short form: proposed sections 1, 2, 3, 5, 6, 11 — awaiting Jamie's approval.

---

## 1. What it is
Settled: pending · Ack: pending

1. **The problem.** The stats on `/solved` are worked out from the player's own
   history in `localStorage`. On a fresh phone the panel is nearly empty, and
   most of it is gated off until a few games are played (`REVEAL_AFTER_GAMES`).
   So designing that screen means playing dozens of games first, which is why it
   has never really been designed. (assumed — Jamie's words, 2026-08-29)
2. **Who it is for.** Jamie, on a phone, with edit mode open. (assumed)
3. **Dave gets it too.** It is just a URL on the dev server, and his view is
   read-only, so nothing needs doing to include him. (assumed — no cost)
4. **Why now.** Edit mode was built for this screen. Without fake stats the tool
   cannot be pointed at the thing it was made for. (assumed — Jamie, 2026-08-29)

## 2. Out of scope
Settled: pending · Ack: pending

## 3. How it works
Settled: pending · Ack: pending

## 4. Maths
n/a — no puzzle generation or filtering. Fake rows are made up, not generated.

## 5. State and persistence
Settled: pending · Ack: pending

## 6. How it fits
Settled: pending · Ack: pending

## 7. How it looks
n/a — proposed. The whole point is that the page looks exactly as it does for a
real player; nothing new is drawn.

## 8. Copy and wording
n/a — proposed. No new copy.

## 9. Accessibility
n/a — proposed. Dev-only, never reaches a player, and adds no new controls.

## 10. Analytics
n/a — proposed. Dev-only; must NOT emit events, or fake play pollutes production
numbers.

## 11. Done / test plan
Settled: pending · Ack: pending
