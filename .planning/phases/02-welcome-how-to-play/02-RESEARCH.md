# Phase 2: Welcome + How-to-Play — Research

**Researched:** 2026-04-11
**Domain:** Vanilla TypeScript + HTML + Tailwind CSS v4 — welcome screen construction
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Top-weighted vertical stack — logo and octopus pinned near the top, content flows down, play button sits in the bottom third. More breathing room on larger screens.
- **D-02:** Octopus is a larger standalone mascot element (80–120px), scaled up from the existing 53x52px inline SVG. Sits between title and subtitle as the visual centrepiece.
- **D-03:** Logo stays as a styled `<h1>` text element (DM Sans or Inconsolata — Claude's discretion on font choice). No separate logo asset.
- **D-04:** Subtitle text: "A daily number puzzle".
- **D-05:** Puzzle number displayed as "Puzzle #142" format — simple label, no date.
- **D-06:** Footer ("Made with heart by Jamie & Dave. (c) 2026.") appears on the welcome screen, consistent with Phase 1 FTR-01 requirement.
- **D-07:** Condensed 3-step summary displayed inline as numbered plain text in muted colour. No example clue, no cards, no dividers. One line per step.
- **D-08:** First visit (no `dlng_history` in localStorage): how-to-play steps appear ABOVE the play button.
- **D-09:** Return visit (`dlng_history` exists): how-to-play steps appear BELOW the play button, always visible (not collapsed or hidden).
- **D-10:** Use the existing `isNewUser` pattern — check whether `dlng_history` exists in localStorage. No game history = first visit. Matches existing code in `app.ts:25`.
- **D-11:** Filled accent button — solid green (accent token) background, white text, rounded corners.
- **D-12:** Button text: "Play" — single word, no puzzle number.
- **D-13:** Puzzle pre-fetches on page load. Tapping Play calls `showScreen("game")` immediately — no loading state needed.

### Claude's Discretion

- Exact font choice for the logo heading (DM Sans vs Inconsolata)
- Exact octopus size within the 80–120px range
- Spacing and padding values between elements
- Responsive adjustments for mobile vs desktop
- The 3 how-to-play step texts (should match current content spirit: read clues, eliminate digits, guess the number)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WEL-01 | Welcome screen shows logo and octopus mascot | Octopus SVG is in `index.html` lines 148–189. Logo is a plain `<h1>`. Both go inside `[data-screen="welcome"]`. |
| WEL-02 | Welcome screen shows subtitle and puzzle number | `puzzleNumber()` in `app.ts:88` computes the number. Subtitle is static copy. Puzzle number must not render as "Puzzle #undefined" — needs a null guard. |
| WEL-03 | Welcome screen shows play button that transitions to game screen | `showScreen("game")` in `src/screens.ts` is already wired. Button gets `data-play-btn` attribute and an event listener in welcome module init. |
| WEL-04 | Welcome screen shows every visit (like Wordle) | `initScreens()` in `screens.ts` already calls `showScreen("welcome")` on load. No additional detection needed — welcome is the default screen. |
| HTP-01 | How-to-play content displayed inline on the welcome screen (not a modal) | No modal involved. Content is an `<ol>` rendered directly into the welcome section DOM. |
| HTP-02 | How-to-play appears above play button on first visit | Detected via `!localStorage.getItem("dlng_history")` (mirrors `app.ts:25`). DOM order or conditional rendering controls position. |
| HTP-03 | How-to-play appears below play button on return visits | Inverse of HTP-02 condition. Same element, different DOM position. |
| HTP-04 | First-visit detection based on whether any Clumeral localStorage keys exist | CONTEXT.md locks this to `dlng_history` key specifically. Note: `app.ts:25` checks `dlng_history` only — not all Clumeral keys. REQUIREMENTS.md says "any Clumeral localStorage key" but CONTEXT.md D-10 narrows it to `dlng_history`. Follow D-10. |
</phase_requirements>

---

## Summary

Phase 2 adds HTML content and a companion TypeScript module to the empty `[data-screen="welcome"]` shell created in Phase 1. Everything the phase needs already exists in the codebase — the octopus SVG, the `puzzleNumber()` function, the `showScreen()` API, the `isNewUser` detection pattern, and all Tailwind tokens. The work is purely assembly: write the HTML structure inside the welcome section, wire the play button to `showScreen("game")`, and implement the first-vs-return-visit HTP placement logic.

The only architectural question is **where the welcome screen setup code lives**. Two approaches work: (a) add a `src/welcome.ts` module that `app.ts` imports and calls at init, or (b) add the setup directly inside `app.ts` alongside the existing screen init. Option (a) keeps module boundaries clean and matches the project's "minimal public API per module" convention. It's the better choice.

The puzzle number on the welcome screen needs a null guard. `puzzleNumber()` requires a date string — on page load the puzzle data is being fetched but may not have resolved yet. The safest approach is to compute the puzzle number from today's local date directly (using `todayLocal()` from `app.ts`), since `puzzleNumber(todayLocal())` needs no network round-trip.

**Primary recommendation:** Create `src/welcome.ts` with `initWelcome()` as its single public export. Call it from `app.ts` init. Write all welcome HTML into the existing `[data-screen="welcome"]` shell. Use `todayLocal()` to derive the puzzle number without waiting for the API.

---

## Standard Stack

No new libraries. Phase 2 uses only existing project dependencies.

### Core (already installed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Tailwind CSS v4 | 4.x (via vite plugin) | Utility classes for layout, colour, typography | Tokens defined in `src/tailwind.css` |
| TypeScript | 6.0.2 | Module logic, DOM typing | Strict mode, ES2022 target |
| Vite | 8.0.3 | Build and dev server | No config changes needed |

**Installation:** None needed. All dependencies are already present.

---

## Architecture Patterns

### Recommended project structure addition

```
src/
├── welcome.ts       ← NEW: welcome screen init and HTP logic
├── app.ts           ← MODIFIED: import and call initWelcome()
├── screens.ts       ← UNCHANGED: showScreen() already exported
└── ...
```

### Pattern 1: Module per screen

**What:** Each screen gets its own TypeScript module with an `init*()` function as the sole public export.

**When to use:** Whenever a screen has its own DOM setup, event listeners, and state detection. Keeps `app.ts` lean.

**Example (from existing `screens.ts`):**

```typescript
// src/welcome.ts
import { showScreen } from './screens.ts';

// ─── DOM Cache ────────────────────────────────────────────────────────────────

const dom = {
  playBtn: document.querySelector('[data-play-btn]') as HTMLButtonElement | null,
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function initWelcome(): void {
  dom.playBtn?.addEventListener('click', () => showScreen('game'));
}
```

### Pattern 2: Derive puzzle number from local date — no API wait

**What:** Call `puzzleNumber(todayLocal())` at module load time, where both helpers are available in `app.ts`. Pass the result into the welcome HTML as a string.

**Why:** The welcome screen renders synchronously on page load. Waiting for the API fetch to complete before showing the puzzle number creates a content flash or requires deferred rendering. Since the puzzle number is deterministic from the date, the local date is sufficient.

**Null guard:** If for any reason the number resolves to NaN or ≤ 0, omit the puzzle number line entirely rather than displaying "Puzzle #NaN".

### Pattern 3: Inline HTML construction for first-vs-return-visit HTP placement

**What:** Build the welcome screen HTML at init time based on the `dlng_history` check. Two options:

- **Option A — two static orderings in HTML, toggle visibility:** Include both orderings in HTML, show/hide with a class. Simple, but doubles DOM nodes.
- **Option B — build layout at runtime based on detection:** Construct the two possible orderings in JS and insert the correct one. Matches the existing `renderBox()` / `renderClues()` pattern.

**Recommendation:** Option B. The welcome screen HTML is small enough that runtime construction is trivial, and it avoids hidden DOM duplication. Use a `renderWelcome(isNew: boolean)` function that inserts the correct HTML into `[data-screen="welcome"]`.

### Anti-Patterns to Avoid

- **Duplicating `isNewUser` logic:** `app.ts:25` already computes `isNewUser = !localStorage.getItem("dlng_history")`. Export it from `app.ts` or replicate the single-line check in `welcome.ts`. Don't create a third path.
- **Checking `dlng_history` after user interaction:** The check must happen at init time, before the page is visible to the user. The welcome screen renders instantly on load.
- **Hardcoding hex colours:** All colours must use Tailwind semantic classes (`bg-accent`, `text-muted`, etc.). The tokens are already in `src/tailwind.css`.
- **Adding an `<h1>` to other screens:** The welcome screen `<h1>` is the page's primary heading. Game and completion screens must not add a second `<h1>`.
- **Calling `showScreen("game")` before page is ready:** `initScreens()` shows welcome on load. The play button listener just calls `showScreen("game")` — no guards needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screen cross-fade | Custom animation | `showScreen("game")` from `screens.ts` | Already implemented with View Transition API + CSS fallback |
| First-visit detection | Custom key scan | `!localStorage.getItem("dlng_history")` | Established pattern at `app.ts:25`, locked in D-10 |
| Puzzle number calculation | Custom date math | `puzzleNumber(todayLocal())` from `app.ts` | Already handles epoch offset and edge cases |
| Dark mode | Manual class toggling | `dark:` Tailwind variants | Theme already applied to `html.dark` by `theme.ts` — all `dark:` classes just work |

---

## Common Pitfalls

### Pitfall 1: Puzzle number flash or "Puzzle #undefined"

**What goes wrong:** Welcome screen renders before the puzzle API call resolves. If puzzle number is read from `gameState` (which is populated by the API response), it will be undefined on first paint.

**Why it happens:** `loadPuzzle()` is async — the fetch hasn't completed when the welcome screen is shown.

**How to avoid:** Compute `puzzleNumber(todayLocal())` synchronously at welcome init time. This needs no network data. Add a guard: `const num = puzzleNumber(todayLocal()); if (num > 0) { /* render "Puzzle #N" */ }`.

**Warning signs:** "Puzzle #NaN" or "Puzzle #undefined" in the welcome screen.

### Pitfall 2: HTP detection running at the wrong time

**What goes wrong:** If the `dlng_history` check happens after the play button is clicked (not at page load), the first-vs-return-visit placement will be wrong on the very first visit.

**Why it happens:** Lazy init or deferred rendering pattern.

**How to avoid:** Run `!localStorage.getItem("dlng_history")` inside `initWelcome()` which is called at page load, before the user interacts.

### Pitfall 3: SVG eye/mouth attributes broken by copy

**What goes wrong:** The octopus SVG has `data-eye` and `data-mouth` attributes that `octo.ts` queries. If the welcome screen copy of the SVG uses the same `data-octo`, `data-eye`, and `data-mouth` attributes, `octo.ts` may query both SVGs and get unexpected results.

**Why it happens:** `octo.ts` uses `document.querySelector('[data-octo]')` — which matches the first element in DOM order. The welcome SVG may precede the game SVG.

**How to avoid:** The welcome octopus is purely decorative — `aria-hidden="true"`, no `data-octo` attribute, no `data-eye` or `data-mouth` attributes. Strip all animation-related data attributes from the welcome copy. Keep only the visual SVG paths.

**Warning signs:** Octo animations stop working on the game screen after Phase 2 is added.

### Pitfall 4: `[data-screen="welcome"]` already has flex layout from Phase 1

**What goes wrong:** Phase 1 applied `flex items-center justify-center` to the welcome section. Adding another flex container inside it without accounting for this causes double-centering.

**Why it happens:** The shell is `absolute inset-0 flex items-center justify-center`. If the inner content column also uses `flex flex-col items-center`, it will be vertically centred inside an already-centred container — which is correct. But adding `min-h-screen` to the inner column is wrong (it's inside a `absolute inset-0` shell that already fills the screen).

**How to avoid:** Inner content column: `w-full max-w-sm mx-auto flex flex-col items-center gap-6`. Do NOT add `min-h-screen` — the outer shell handles full-screen coverage.

---

## Code Examples

### Welcome section shell (from `index.html` line 440 — already in place)

```html
<section
  data-screen="welcome"
  class="absolute inset-0 flex items-center justify-center bg-bg opacity-0 pointer-events-none transition-opacity duration-[250ms] ease-in-out"
  aria-hidden="true"
>
  <!-- Phase 2 content goes here -->
</section>
```

### Octopus SVG — decorative copy (no animation attributes)

The full SVG is at `index.html` lines 148–189. For the welcome screen, copy it with:
- `width="96" height="96"` (scaled from 53×52, keeps the same `viewBox="0 0 53 52"`)
- `aria-hidden="true"`
- NO `data-octo`, `data-eye`, or `data-mouth` attributes
- NO `title` attribute or click handler

### HTP list structure (from UI-SPEC)

```html
<ol class="text-base text-muted space-y-2 list-none" aria-label="How to play">
  <li class="flex gap-2">
    <span class="font-semibold">1.</span>
    <span>Read the clues — each one narrows down a digit</span>
  </li>
  <li class="flex gap-2">
    <span class="font-semibold">2.</span>
    <span>Tap a digit box to open it, then remove digits that don't fit</span>
  </li>
  <li class="flex gap-2">
    <span class="font-semibold">3.</span>
    <span>When one digit remains in each box, submit your answer</span>
  </li>
</ol>
```

### Play button (from UI-SPEC)

```html
<button
  type="button"
  data-play-btn
  class="w-full min-h-[48px] rounded-lg bg-accent text-white text-base font-semibold"
>
  Play
</button>
```

### Welcome module skeleton

```typescript
// src/welcome.ts
// Welcome screen setup — renders content and wires play button.

import { showScreen } from './screens.ts';

// ─── Helpers (replicated from app.ts — avoids circular import) ─────────────────

const EPOCH_DATE = "2026-03-08";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function puzzleNumber(dateStr: string): number {
  const ms = new Date(dateStr + "T00:00:00Z").getTime() - new Date(EPOCH_DATE + "T00:00:00Z").getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderWelcome(isNew: boolean): void {
  const shell = document.querySelector('[data-screen="welcome"]');
  if (!shell) return;

  const num = puzzleNumber(todayLocal());
  const puzzleLabel = num > 0 ? `<p class="text-base text-muted text-center">Puzzle #${num}</p>` : '';

  const htpBlock = `<ol class="text-base text-muted space-y-2 list-none" aria-label="How to play">...</ol>`;
  const playBtn  = `<button type="button" data-play-btn class="w-full min-h-[48px] rounded-lg bg-accent text-white text-base font-semibold">Play</button>`;

  shell.innerHTML = `
    <div class="w-full max-w-sm mx-auto flex flex-col items-center gap-6 px-6 py-8">
      <h1 class="text-3xl font-bold text-text tracking-tight">Clumeral</h1>
      <!-- octopus SVG here (96×96, aria-hidden, no data-octo) -->
      <div class="text-center space-y-1">
        <p class="text-base text-muted text-center">A daily number puzzle</p>
        ${puzzleLabel}
      </div>
      ${isNew ? htpBlock : ''}
      ${playBtn}
      ${isNew ? '' : htpBlock}
    </div>
  `;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initWelcome(): void {
  const isNew = !localStorage.getItem('dlng_history');
  renderWelcome(isNew);

  const playBtn = document.querySelector('[data-play-btn]') as HTMLButtonElement | null;
  playBtn?.addEventListener('click', () => showScreen('game'));
}
```

**Note on `EPOCH_DATE` duplication:** `app.ts` also defines `EPOCH_DATE`. If a shared constants module exists or is created, use it. If not, the duplication of this one constant is acceptable — it's a stable value with a "DO NOT modify" comment.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is purely frontend code and HTML. No new external tools, services, CLIs, or runtimes required. Existing dev environment (`npm run dev`) is sufficient.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test runner in `package.json` scripts |
| Config file | None |
| Quick run command | n/a |
| Full suite command | n/a |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEL-01 | Logo h1 and octopus SVG present in welcome section DOM | manual-only | — | ❌ No test infra |
| WEL-02 | Subtitle and puzzle number rendered correctly | manual-only | — | ❌ No test infra |
| WEL-03 | Clicking Play calls `showScreen("game")` | manual-only | — | ❌ No test infra |
| WEL-04 | Welcome screen is the default on page load | manual-only | — | ❌ No test infra |
| HTP-01 | HTP content is inline in welcome section, not a modal | manual-only | — | ❌ No test infra |
| HTP-02 | HTP above Play on first visit (no `dlng_history`) | manual-only | — | ❌ No test infra |
| HTP-03 | HTP below Play on return visit (`dlng_history` present) | manual-only | — | ❌ No test infra |
| HTP-04 | Detection checks `dlng_history` key specifically | manual-only | — | ❌ No test infra |

**All tests are manual-only.** The project has no test runner. Verification will be done via browser inspection:
- Clear localStorage, load page → confirm HTP above Play, logo + octopus visible
- Add any value for `dlng_history` in localStorage, reload → confirm HTP below Play
- Click Play → confirm transition to game screen
- Check dark mode → confirm all colour tokens respond correctly

### Wave 0 Gaps

The project has no test infrastructure. Setting it up is out of scope for this phase. Manual browser testing is the verification method.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| Never commit to `main` or `staging` | All work on `192-redesign-three-screens` branch |
| No `wrangler deploy` | Not relevant — frontend-only phase |
| Follow review gates | DA review + self-review before PR if touching more than one file or >30 lines |
| Tailwind CSS, existing Vite + Cloudflare Workers setup | No new build tooling |
| No worker/API changes | `puzzleNumber()` computed locally, no new API calls |
| ES2022 target | TypeScript config unchanged |
| Under 15 semantic colour tokens | Phase 1 defined 6 tokens; Phase 2 adds none |
| GSD workflow enforcement | Changes go through `/gsd:execute-phase` |

---

## Sources

### Primary (HIGH confidence)

- `src/screens.ts` — `showScreen()`, `initScreens()`, screen DOM structure confirmed by direct read
- `src/app.ts` lines 25, 83–91 — `isNewUser` pattern and `puzzleNumber()`/`todayLocal()` confirmed by direct read
- `src/tailwind.css` — All 6 colour tokens confirmed by direct read
- `index.html` lines 440–449 — Welcome section shell confirmed empty with "Phase 2 content" comment
- `index.html` lines 148–189 — Full octopus SVG with `data-octo`, `data-eye`, `data-mouth` attributes confirmed
- `02-CONTEXT.md` — All locked decisions read directly
- `02-UI-SPEC.md` — Full design contract read directly

### Secondary (MEDIUM confidence)

- WCAG 2.5.8 minimum touch target (48px height on Play button) — per UI-SPEC, widely documented standard

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing dependencies read directly
- Architecture: HIGH — integration points confirmed by direct code reading
- Pitfalls: HIGH — identified from direct code analysis (octopus data attributes, async puzzle fetch, DOM shell layout)
- HTP placement logic: HIGH — `dlng_history` key confirmed in `app.ts:25`

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable codebase; no fast-moving dependencies)
