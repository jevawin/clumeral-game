# Feature Research

**Domain:** Daily number puzzle game — multi-screen UI redesign
**Researched:** 2026-04-11
**Confidence:** MEDIUM (grounded in observed Wordle/NYT patterns; specific animation timings and competitor internals inferred from UX analyses and community documentation)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features players assume exist in a daily puzzle game. Missing any of these makes the product feel broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clear screen-by-screen flow (welcome → game → completion) | Wordle established this as the genre norm; dumping users directly into the puzzle mid-session feels disorienting | MEDIUM | State-driven on a single page — no URL routing needed |
| How-to-play instructions on first visit | All daily puzzle games show rules to new players; skipping this causes abandonment | LOW | Inline on welcome screen beats modal overlays — overlays get dismissed without reading |
| Puzzle number displayed prominently | Players track their streak relative to puzzle number; it anchors the daily ritual | LOW | Show on welcome screen and optionally in game header |
| Core stat display after completion | Games played, win %, current streak, max streak — Wordle made these standard; players expect them | LOW | Four numbers, no chart needed for a simpler game |
| Celebration on correct answer | Every successful daily puzzle game rewards the win visually; absence feels cold | MEDIUM | Should feel satisfying but be brief (~2-3s); skippable for accessibility |
| Light and dark mode | Standard browser/OS expectation; dark mode particularly important for evening play | LOW | Already exists; just needs Tailwind `dark:` wiring |
| Feedback / contact mechanism | Players need a way to report bugs or bad puzzles; without it frustration has nowhere to go | LOW | Modal stays; just restyled |
| The game works — clues, digit elimination, submission, validation | The puzzle itself must function without regression | HIGH | This is the non-negotiable core; all UI must serve it |

### Differentiators (Competitive Advantage)

Features that make Clumeral feel considered rather than generic. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Welcome screen with character (octopus mascot) | Gives the game personality and a visual anchor; Wordle has none — it's just a grid | LOW | Octopus on welcome, then swims up into the celebration — continuity of character |
| Inline how-to-play (not a dismissible popup) | Players actually read it because it's part of the page flow, not an obstacle | LOW | Show above play button on first visit, below on return — the PROJECT.md decision is right |
| Celebration that transitions directly into the completion screen | The win state and stats feel connected, not like two separate things bolted together | MEDIUM | Octopus swims up → completion screen appears underneath; ~3s then auto-display |
| Feedback prompt on the completion screen | Captures sentiment at the moment it's highest; most games hide feedback in menus | LOW | A single line prompt with a button — not a pushy banner |
| Compact contextual menu during game | Everything (dark mode, archive, feedback, how-to-play) accessible without leaving the puzzle | LOW | Hamburger or icon row; keeps the game screen clean |
| Puzzle archive / random mode | Lets players explore past puzzles or get a second daily hit; uncommon in Wordle clones | MEDIUM | Already implemented; surface it clearly in the menu |
| Server-side answer validation (answer never in client) | Players cannot cheat by inspecting source; rare in browser puzzle games | HIGH | Already implemented; maintain this |

### Anti-Features (Commonly Requested, Often Problematic)

Features that look good on a roadmap but cause problems in practice.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Share results button (emoji grid) | Wordle made this iconic; players ask for it | Requires per-puzzle result format design, clipboard API handling, and accessibility work (emoji grids are screen reader hostile); adds scope to this milestone | Build it separately as its own roadmap item; completion screen has a feedback prompt instead |
| Guess distribution chart | Wordle shows a bar chart of guess counts; feels analytical | Clumeral is a single-guess game (you either get it or you don't) — a distribution chart doesn't map cleanly and adds complexity for no insight | Show games played, win %, streaks — that's enough |
| Toast notification system | Feels modern; used for "invalid guess" feedback in Wordle | How-to-play is now inline; toasts add a whole notification layer for minimal benefit | Use inline error states near the input, or shake animations on the number pad |
| Colour theme picker | Players like personalisation | Already removed deliberately; adds ~20 tokens back to the palette and complicates dark mode; doesn't reflect a real player need | Green accent + dark/light mode is enough |
| Leaderboard / social comparison | Makes games feel competitive | Requires auth, backend, and privacy handling — entirely out of scope; daily puzzle games that add this often feel less calm | Daily streak is the competition — against yourself |
| "Continue where I left off" cross-device sync | Power users ask for it | Requires accounts or backend storage; conflicts with the server-side validation approach; big scope | localStorage is fine for a single-device daily game; document the limitation honestly |
| Multiple puzzle difficulties | More content = more value on paper | Clumeral's clues already vary in difficulty by design; two tracks would halve the daily playerbase and double puzzle authoring work | Let the puzzle difficulty speak for itself |

---

## Feature Dependencies

```
Welcome screen (logo, octopus, puzzle number, how-to-play, play button)
    └──triggers──> Game screen
                       └──on correct answer──> Celebration animation
                                                   └──completes into──> Completion screen
                                                                            └──contains──> Stats display
                                                                            └──contains──> Feedback prompt

How-to-play placement logic
    └──requires──> First-visit detection (localStorage flag)

Stats display
    └──requires──> Game history in localStorage (already exists)

Dark mode
    └──requires──> Tailwind dark: variants wired to a root class toggle (existing theme.ts)

Compact game menu
    └──contains──> Dark mode toggle
    └──contains──> How-to-play (same content as welcome screen)
    └──contains──> Feedback modal trigger
    └──contains──> Archive link
```

### Dependency Notes

- **Celebration requires game screen:** The animation is the bridge between game and completion — it cannot exist standalone.
- **Completion screen requires stats:** Showing the screen without stats would feel empty and incomplete. Stats read from existing localStorage history.
- **How-to-play placement requires first-visit detection:** The same content moves position based on a `localStorage` flag. Simple to implement but must be set reliably on first successful page load.
- **Game menu enhances game screen:** Menu items (dark mode, feedback, archive) are all already functional — the menu is just a new entry point for them.

---

## MVP Definition

This is a redesign milestone, not a new product. MVP here means: all three screens working, no regressions, existing features accessible.

### Launch With (v1 — this milestone)

- [ ] Welcome screen — logo, octopus, puzzle number, how-to-play (position varies by visit), play button
- [ ] Game screen — clues on background (no card), digit boxes, number pad, submit, compact menu
- [ ] Celebration animation — octopus swims up (~3s), skippable, respects `prefers-reduced-motion`
- [ ] Completion screen — games played, win %, current streak, max streak, feedback prompt
- [ ] Feedback modal — restyled in Tailwind, accessible from completion screen and game menu
- [ ] Dark mode — wired through Tailwind `dark:` variants, toggle in game menu
- [ ] First-visit vs returning-visit how-to-play placement
- [ ] Simplified footer on all screens

### Add After Validation (v1.x)

- [ ] Share results button — when the format is designed and the clipboard/accessibility story is resolved
- [ ] Countdown to next puzzle — only worth adding if user research shows "when's the next one?" is a real question

### Future Consideration (v2+)

- [ ] Archive surfaced more prominently in the UI (currently just a menu link)
- [ ] WordleBot-style post-game analysis ("you solved it in the top X%")
- [ ] Cross-device sync — only if accounts become viable

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Welcome screen | HIGH | LOW | P1 |
| Game screen (no regression) | HIGH | HIGH | P1 |
| Celebration animation | HIGH | MEDIUM | P1 |
| Completion screen with stats | HIGH | LOW | P1 |
| Dark mode (Tailwind wiring) | HIGH | LOW | P1 |
| Feedback modal (restyled) | MEDIUM | LOW | P1 |
| How-to-play first-visit logic | MEDIUM | LOW | P1 |
| Compact game menu | MEDIUM | LOW | P1 |
| Share button | MEDIUM | MEDIUM | P3 (separate milestone) |
| Countdown timer | LOW | LOW | P2 (post-launch) |
| Guess distribution chart | LOW | MEDIUM | — (anti-feature for this game) |

---

## Competitor Feature Analysis

| Feature | Wordle (NYT) | Connections (NYT) | Clumeral approach |
|---------|--------------|-------------------|-------------------|
| Welcome / splash screen | None — drops directly into the board | None — grid appears immediately | Full welcome screen with mascot and how-to-play |
| First-visit tutorial | Modal overlay (85 words) — often dismissed | Modal overlay with example | Inline on welcome screen — harder to skip |
| Completion screen | Stats modal + share button + countdown timer | Results grid + share | Stats + feedback prompt; share deferred |
| Stats displayed | Games played, win %, current streak, max streak, guess distribution | Games played, win %, current streak, max streak | Same four headline stats; no distribution (irrelevant for single-guess game) |
| Celebration animation | Tiles do a small jump; confetti on win | Coloured rows cascade off screen | Octopus swims up from bottom (~3s), then completion screen appears |
| Dark mode | Yes, toggle in header | Yes, respects OS preference | Yes, toggle in compact game menu |
| Share results | Emoji grid to clipboard | Colour-coded emoji grid | Deferred — separate milestone |
| How-to-play post-first-visit | Help icon in header opens modal | Help icon | In compact game menu |
| Countdown to next puzzle | Yes, shown on completion screen | Yes, shown on completion screen | Not in v1 — low priority for this game's pace |
| Mascot / character | None | None | Octopus — differentiator |

---

## Sources

- Wordle UX analysis: [Why Wordle Works — Design Bootcamp (Medium)](https://medium.com/design-bootcamp/why-wordle-works-a-ux-breakdown-485b1dbba30b)
- Wordle UX analysis: [Wordle: How a Simple UX Design Just Feels Right — Ikangai](https://www.ikangai.com/wordle-how-a-simple-ux-design-just-feels-right/)
- Wordle stats system: [How Wordle Scoring Works — Wordle0](https://wordle0.com/how-wordle-scoring-works-streaks-stats-2026/)
- Wordle accessibility and features: [Wordle — Wikipedia](https://en.wikipedia.org/wiki/Wordle)
- Emoji sharing accessibility concern: multiple community sources noting screen reader incompatibility
- Celebration skip / reduced motion: [WCAG C39 — prefers-reduced-motion](https://www.w3.org/WAI/WCAG21/Techniques/css/C39), [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/offer-a-means-to-bypass-gameplay-elements-that-arent-part-of-the-core-mechanic-via-settings-or-in-game-skip-option/)
- PROJECT.md: Clumeral project requirements and decisions (local)

---

*Feature research for: Clumeral daily number puzzle — multi-screen UI redesign*
*Researched: 2026-04-11*
