# Clumeral — Claude Instructions

## What This Is

**Clumeral** (clumeral.com) is a daily browser word puzzle game. A seeded random algorithm filters numbers 100–999 down to one answer using column-based clues. The player reads the clues and guesses the hidden number. New puzzle every day, same answer for everyone.

Tagline: *Work out the number from 100–999. New puzzle every day.*

## Project Structure

```
src/
  worker/index.ts      Cloudflare Worker — intercepts GET /, injects PUZZLE_DATA
  worker/puzzle.ts     Puzzle generation logic (server-only)
  app.ts               Client UI — renders clues/feedback/history/stats, handles guesses
  confetti.ts          Confetti animation on correct answer
  style.css            All visual styling
public/                Static assets copied as-is (icons, images, manifest, sw.js)
index.html             Game shell (Vite entry point)
vite.config.ts         Vite + Cloudflare plugin config
wrangler.jsonc         Cloudflare Worker config
```

## Architecture

**Vite + TypeScript.** ES modules in dev, bundled for production. Cloudflare Worker runs via `@cloudflare/vite-plugin`.

### How it works

1. Worker intercepts `GET /` and `/random`, generates puzzle, injects `window.PUZZLE_DATA` into HTML
2. `index.html` loads `src/app.ts` as `type="module"`
3. `app.ts` reads `window.PUZZLE_DATA` and calls `startDailyPuzzle()`

### puzzle.js structure

```
PROPERTIES — 28 filterable properties (12 boolean specials + 16 numeric)
PROPERTY_GROUPS — 6 groups (Specials, Sums, Differences, Products, Means, Range)
applyFilter(candidates, propKey, operator, value)
runFilterLoop(rng) — returns { answer, clues }
makeRng(seed) — mulberry32 seeded RNG
todayLocal / dateSeedInt / puzzleNumber — date utilities
```

### Key algorithm facts

- `candidates` starts as integers `[100..999]` — no pre-built data structure
- Each property has a `compute(n)` function that derives the value on-the-fly from digits
- `getDigits(n)` → `[Math.floor(n/100), Math.floor((n%100)/10), n%10]`
- One filter is drawn per `PROPERTY_GROUPS` entry per main loop iteration
- After the main loop, a **tiebreaker** sweeps all properties with `=` (exact match on `candidates[0]`) until `candidates.length === 1`

### PROPERTY_GROUPS

```js
Specials:    12 boolean properties (3 digits × prime/square/cube/triangular)
Sums:        ['sumFS', 'sumFT', 'sumST', 'sumAll']
Differences: ['diffFS', 'diffFT', 'diffST']
Products:    ['prodFS', 'prodFT', 'prodST', 'prodAll']
Means:       ['meanFS', 'meanFT', 'meanST', 'meanAll']
Range:       ['range']
```

### Property types

- `type: 'text'` — boolean value (`true`/`false`); operators: `=` `!=`
- `type: 'numeric'` — number value; operators: `<=` `=` `!=` `>=`

### Daily puzzle seeding

- Seed = today's local date as integer (YYYYMMDD)
- RNG = mulberry32 (`makeRng` in `puzzle.js`)
- `runFilterLoop(rng)` — same seed always produces same puzzle
- Epoch date (`EPOCH_DATE = '2026-03-08'`) = Puzzle #1

### localStorage keys

- `dlng_history` — array of `{ date: "YYYY-MM-DD", tries: N }`, max 60 entries
- `dlng_prefs` — `{ saveScore: boolean }`
- `dlng_theme` — `"light"` or `"dark"` (user's theme preference)
- `cw-htp-seen` — `"1"` if How to Play modal has been shown
- Prefix `dlng_` = original game name "David Lark's Lame Number Game" — do not rename (persisted in existing user browsers)

## Design System

Uses `light-dark()` for automatic theme switching. JS sets `:root.dark` or `:root.light` → `color-scheme` resolves the correct value.

```css
/* ── Accent (theme-aware for WCAG AA contrast) ── */
--acc:        light-dark(#bc3c2c, #ff8070)  /* text accent — 4.7:1 light, 5.6:1 dark */
--acc-btn:    #bc3c2c                       /* button bg — white text 5.5:1 both themes */
--tag-bg:     light-dark(rgba(188,60,44,0.08), rgba(255,128,112,0.1))
--md-lit-bg:  light-dark(rgba(188,60,44,0.10), rgba(255,128,112,0.12))

/* ── Theme-sensitive (light / dark) ── */
--bg:         light-dark(#f5edd8, #262624)       /* page background */
--text:       light-dark(#262624, #f6f0e8)       /* primary text */
--muted:      light-dark(rgba(38,38,36,0.70), rgba(246,240,232,0.6))
--card-bg:    light-dark(#fffdf7, #2e2e2c)       /* card background */
--card-sh:    light-dark(offset shadow light, offset shadow dark)
--surface:    light-dark(#ffffff, #363634)        /* input/key backgrounds */
--border:     light-dark(rgba(38,38,36,0.12), rgba(255,253,247,0.1))
--modal-bg:   light-dark(#ffffff, #1e1e1c)
```

- Font: DM Sans (body) + Inconsolata (monospace labels/digits) via Google Fonts CDN, with system-ui fallback
- Card: offset shadow (`--card-sh`) with solid `--card-bg` background
- Responsive: no fixed breakpoint — fluid layout via `max-width: 30rem`

## Clue Display Rules

- **Boolean clues** (`type: 'text'`): `[subject] [**is [not] predicate**]`
  - Affirmative (`= true` or `!= false`): "The first digit **is a prime number**"
  - Negative (`= false` or `!= true`): "The first digit **is not a prime number**"
- **Numeric clues**: `[label] [operator in coral] [value in bold]`
- Operator symbols: `<=` → `≤`, `>=` → `≥`, `=` → `=`, `!=` → `≠`

## Dev Server

```bash
npm run dev
# Vite dev server with Worker running in Cloudflare Workers runtime
# PUZZLE_DATA is injected by the Worker, same as production
```

## Git Workflow

**`main` is protected — never commit or push to it directly.** Not on GitHub, not locally.

### Branches

| Branch | Purpose | Commits |
|--------|---------|---------|
| `main` | Production | PRs from `staging` only (the user merges in GitHub) |
| `staging` | Pre-production review | Merges from approved work branches only — **protected, never commit directly** |
| `dev/thing` | General work (no GitHub issue) | Direct commits OK |
| `issue/NUM` | Work linked to a GitHub issue | Direct commits OK |

- **Base branch**: create work branches off `staging`
- **Legacy branches**: `dev` and `colours` branches exist but are being retired — leave them as-is

### Harness branch workaround

The Claude Code harness auto-assigns a `claude/*` branch name per session. **Ignore it.** Instead:

1. Create `issue/NUM` or `dev/name` branch off `staging`
2. Do all work on that branch
3. After merging into `staging`, switch back to the work branch — do not stay on `staging`

The orphan `claude/*` branch and any leftover remote work branches can't be deleted by Claude (no permission to push `--delete` or API to delete branches). **The repo owner must prune these** — either via the GitHub UI (repo → branches) or locally with `git push origin --delete <branch>`.

### Workflow

1. **Build** — Claude creates `issue/NUM` or `dev/name` branches off `staging`, commits work, pushes, and provides the Cloudflare preview URL for each branch
2. **Branch review** — the user tests each branch via its preview URL as work progresses
3. **Merge to staging** — Claude waits for the user's explicit approval, then merges approved branches into `staging`, creates a PR from `staging` → `main`, and provides both the staging preview URL and the PR link
4. **Final review** — the user tests staging with all branches combined
5. **Ship** — the user merges the PR to `main` from GitHub

**Key rules:**
- **Never merge to `main`** — the user does this from GitHub. No exceptions unless the user explicitly grants override permission with a stated reason.
- **Never merge to `staging` without approval** — wait for the user to confirm each branch
- After merging to `staging`, switch back to the work branch — never commit directly to `staging`
- **Never run `wrangler deploy` or `npm run deploy`** — deployment is automatic via Cloudflare Git integration on merge to `main`

### Cloudflare preview URLs

Provide these as clickable markdown links after pushing:
- **Feature branches**: `https://{branch}-clumeral-game.jevawin.workers.dev` (e.g. [https://issue-109-clumeral-game.jevawin.workers.dev](https://issue-109-clumeral-game.jevawin.workers.dev))
- **Staging**: [https://staging-clumeral-game.jevawin.workers.dev](https://staging-clumeral-game.jevawin.workers.dev)

No need to link PRs for branch → staging — just the Cloudflare branch URL. When approved and merged, provide the staging URL **and** the `staging` → `main` PR URL.

## Deployment

Push to `main` → GitHub → Cloudflare Pages builds with `npm run build` → auto-deploys from `dist/client`.

- **Production**: [https://clumeral.com](https://clumeral.com)
- **Merge method**: squash only (merge commits disabled on the repo)
- **Build command**: `npm run build`
- **Output directory**: `dist/client`

## Skills

- `/add-to-roadmap` — when the user says "add to roadmap" or similar, invoke this skill to create a structured GitHub issue labelled `roadmap`, assigned to `jevawin`

## Process Directives

### Session management

- **Hand off after 3 PRs** or when context compression is detected (responses get vaguer, repeat themselves, miss things)
- **Handoff summary**: update `PROGRESS.md` with what was completed, what's next, decisions made, blockers, and current branch state
- `PROGRESS.md` is the living document — the next session reads it to pick up where the last left off

### Review gates

For non-trivial changes (new features, changed logic, refactored modules), run the full review gate before creating a PR. Trivial changes (typos, formatting, config tweaks) can skip DA but should still get a self-review pass.

**Review order matters — never skip or reorder:**

1. **DA Review** — spin up a subagent in fresh context to review all changed files. Follow `docs/DA-REVIEW.md` checklist item by item. Medium+ findings must be fixed before proceeding.
2. **Self-Review** — read every changed file (`git diff staging...HEAD`) and run through `docs/SELF-REVIEW.md`. Catches line-level accuracy issues the DA misses.
3. **Create PR** — only after both reviews pass.

### Living checklists

`docs/DA-REVIEW.md` and `docs/SELF-REVIEW.md` are living documents. When a review (or the user) catches something the checklist should have spotted, add the specific check immediately.

### Context management

- Use subagents for exploration and DA reviews (protect main context window)
- DA reviews must run in fresh context — the agent that wrote the code should not be the same context that reviews it

## Testing notes

- **Safari tab navigation**: Safari requires **Option+Tab** to tab through all interactive elements (buttons, links, inputs). If the user reports "tabbing is broken", remind them to check Option+Tab before investigating.

## Keeping CLAUDE.md current

When making important decisions, structural changes, new conventions, or architectural choices during a conversation, add them to this file so future sessions have the full picture.

## Conventions

- **Accessibility**: all changes must meet WCAG 2.1 AA minimum — use semantic HTML, proper ARIA attributes, sufficient colour contrast (4.5:1 normal text, 3:1 large text / UI components), and keyboard navigability
- No framework, no bundler, no TypeScript — plain JS with ES modules
- Icons: use [Lucide](https://lucide.dev/) for any iconography
- Notifications: use toast/snackbar (auto-dismiss ~3s) for transient feedback — not modals
- No PII: never collect, store, or transmit personally identifiable information
- GitHub labels: lowercase for words (`roadmap`, `gameplay`), uppercase for acronyms/codes (`P1`, `P2`, `P3`, `UI/UX`)
- `puzzle.js` is shared; never put UI code in it
- `app.js` is UI only; never put filter/compute logic in it
- DOM IDs are locked: `#cw`, `#cw-canvas`, `#cw-shape`, `#cw-shape2`, `#cw-inner`, `#cw-header`, `#cw-title`, `#cw-sub`, `#cw-card`, `#cw-plabel`, `#cw-digits`, `#d0`, `#d1`, `#d2`, `#cw-hint`, `#cw-keypad-wrap`, `#cw-keypad`, `#cw-submit-wrap`, `#cw-submit`, `#cw-save`, `#cw-ck`, `#cw-feedback`, `#cw-history`, `#cw-history-list`, `#cw-stats`, `#cw-next`, `#cw-next-number`, `#cw-again`, `#cw-foot-links`, `#cw-tog`, `#cw-htp-btn`, `#cw-foot`, `#cw-modal`, `#cw-modal-box`, `#cw-modal-close`, `#cw-modal-gotit`, `#octo-wrap`, `#octo`
- Event listeners attached at module level in `app.js` — never inside `startDailyPuzzle`
- `gameState` is module-scoped `let` in `app.js` — not a `window` global
