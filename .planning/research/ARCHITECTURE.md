# Architecture Research

**Domain:** State-driven multi-screen SPA, vanilla TypeScript, no framework
**Researched:** 2026-04-11
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Screen Controller                        │
│  (owns current screen, orchestrates transitions, mediates)   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Welcome    │  │     Game     │  │    Completion    │   │
│  │   Screen     │  │    Screen    │  │     Screen       │   │
│  │ (mount/      │  │ (mount/      │  │ (mount/          │   │
│  │  unmount)    │  │  unmount)    │  │  unmount)        │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                       Shared Modules                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ storage  │  │ modals   │  │  octo/   │  │  theme   │    │
│  │  .ts     │  │   .ts    │  │ bubbles  │  │   .ts    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
├─────────────────────────────────────────────────────────────┤
│                       Game State                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  gameState | possibles | activeBox | submitting      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

The Screen Controller is the single source of truth for which screen is visible. Screens mount on entry and unmount on exit — they do not persist silently in the background. Game state lives independently of screens and survives screen transitions.

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `app.ts` (Screen Controller) | Owns current screen, handles transitions, wires initial events | All screens, game state |
| `screens/welcome.ts` | Renders welcome content, emits "play" intent | Screen controller |
| `screens/game.ts` | Renders clues, digit boxes, keypad; handles guess flow | Screen controller, game state, API, modals |
| `screens/completion.ts` | Renders stats, feedback prompt; handles "play again" | Screen controller, storage |
| `modals.ts` | Feedback modal — standalone, called from game and completion | API (Google Apps Script) |
| `octo.ts` / `bubbles.ts` | Celebration animation — called by game screen on victory | DOM only |
| `storage.ts` | localStorage abstraction — pure, no DOM | Called by game, completion |
| `theme.ts` | Dark/light mode — initialised once at startup | DOM (class on `<html>`) |

## Recommended Project Structure

```
src/
├── app.ts              # Entry point: init theme, load puzzle, hand off to ScreenController
├── screen-controller.ts # FSM: current screen, transition(), transitionTo(screen, data)
├── screens/
│   ├── welcome.ts      # WelcomeScreen: mount(), unmount()
│   ├── game.ts         # GameScreen: mount(clues), unmount(), internal event bindings
│   └── completion.ts   # CompletionScreen: mount(result), unmount()
├── modals.ts           # FeedbackModal — no change from current
├── octo.ts             # Celebration animation — no change
├── bubbles.ts          # Bubble effect — no change
├── storage.ts          # localStorage — no change
├── theme.ts            # Theme init — no change
├── types.ts            # Shared types
└── style.css           # (removed once Tailwind replaces it)
```

### Structure Rationale

- **`screen-controller.ts`:** Separating the FSM from `app.ts` keeps the entry point small and makes the transition logic independently testable.
- **`screens/`:** Each screen is a module with `mount()` and `unmount()`. This gives each screen a clear DOM lifecycle — mount sets up listeners, unmount tears them down. Nothing leaks between screens.
- **Shared modules stay flat:** `modals.ts`, `octo.ts`, `storage.ts` are not screen-specific. They don't move.

## Architectural Patterns

### Pattern 1: Flat State Machine with Explicit Transitions

**What:** A plain TypeScript object with a `current` property and a `transitionTo(screen, data)` method. No library. States are string literals (`'welcome' | 'game' | 'completion'`). Each state has `enter(data)` and `exit()` hooks.

**When to use:** 3–5 states with well-defined transitions and no concurrent states. Exactly the case here.

**Trade-offs:** Simple, readable, zero deps. Gets messy above ~8 states or with parallel states — use XState then.

**Example:**
```typescript
type Screen = 'welcome' | 'game' | 'completion';

const screens: Record<Screen, { enter: (data?: any) => void; exit: () => void }> = {
  welcome: { enter: mountWelcome, exit: unmountWelcome },
  game:    { enter: mountGame,    exit: unmountGame    },
  completion: { enter: mountCompletion, exit: unmountCompletion },
};

let current: Screen = 'welcome';

function transitionTo(next: Screen, data?: unknown) {
  screens[current].exit();
  current = next;
  screens[current].enter(data);
}
```

This is the recommended pattern for this project.

### Pattern 2: mount() / unmount() Screen Lifecycle

**What:** Each screen module exports `mount(data)` and `unmount()`. `mount` builds DOM, caches element refs, binds event listeners. `unmount` removes listeners and clears any intervals/timeouts. The screen controller calls these in order: `exit()` → `enter()`.

**When to use:** Always — this is the standard for no-framework DOM lifecycle management.

**Trade-offs:** Requires discipline to pair every `addEventListener` with a `removeEventListener` in `unmount`. Missing cleanup causes ghost listeners that fire after the screen is gone.

**Example:**
```typescript
// screens/welcome.ts
let _playBtn: HTMLButtonElement | null = null;

function onPlayClick() {
  transitionTo('game');
}

export function mount(data: { isFirstVisit: boolean }) {
  const el = document.getElementById('screen-welcome')!;
  el.removeAttribute('hidden');
  el.removeAttribute('aria-hidden');

  _playBtn = el.querySelector('[data-play]');
  _playBtn?.addEventListener('click', onPlayClick);

  // first visit: show how-to-play above play button
  // return visit: show it below
}

export function unmount() {
  _playBtn?.removeEventListener('click', onPlayClick);
  _playBtn = null;

  const el = document.getElementById('screen-welcome')!;
  el.setAttribute('hidden', '');
  el.setAttribute('aria-hidden', 'true');
}
```

### Pattern 3: HTML Screens Always in DOM, Toggled by hidden Attribute

**What:** All three screens exist in `index.html` at startup. Visibility is controlled by the `hidden` attribute (not `display: none` via class). The active screen removes `hidden`; inactive screens have it set.

**When to use:** Preferred over createElement/appendChild for screen-level switching. Screens are complex, static HTML — inline Tailwind works best when the HTML is authored, not generated.

**Trade-offs:** Initial HTML is slightly larger. But avoids innerHTML for complex structures and keeps Tailwind classes where they belong — in HTML, not JS strings.

**Contrast with:** Dynamically creating screen HTML in JS (bad for Tailwind — you'd be building class strings in JS, fighting against the Tailwind workflow).

### Pattern 4: View Transition API for Animated Screen Changes

**What:** `document.startViewTransition(() => { showNextScreen(); })` wraps a DOM update in a browser-native cross-fade or slide. No CSS keyframes needed for basic transitions.

**When to use:** For the welcome→game and game→completion transitions where a visual handoff improves feel. Optional — degrade gracefully.

**Browser support:** 90.94% global coverage as of 2026. Chrome 111+, Safari 18+, Firefox 144+. Safe to use with a feature check.

**Trade-offs:** Adds polish for free. The celebration animation (octo + bubbles) runs *before* the transition to completion — so the transition wraps the DOM swap after the animation ends, not the animation itself.

**Example:**
```typescript
function transitionTo(next: Screen, data?: unknown) {
  screens[current].exit();
  current = next;
  if ('startViewTransition' in document) {
    document.startViewTransition(() => screens[current].enter(data));
  } else {
    screens[current].enter(data);
  }
}
```

## Data Flow

### Screen Transition Flow

```
User taps "Play"
    ↓
WelcomeScreen emits intent (calls transitionTo directly or via callback)
    ↓
ScreenController: exit WelcomeScreen → enter GameScreen(clues)
    ↓
GameScreen mounts: renders clues, binds keypad/submit handlers
    ↓
Player submits guess → GameScreen POSTs to /api/guess
    ↓
Correct: GameScreen runs celebration animation (~3s)
    ↓
Animation ends → transitionTo('completion', result)
    ↓
CompletionScreen mounts: reads history from storage, renders stats
```

### State Ownership

```
gameState / possibles / activeBox / submitting
    → Owned by game.ts (screen-local during gameplay)
    → Persisted to storage on game end
    → Cleared on remount for new puzzle

localStorage (via storage.ts)
    → Read by completion.ts to compute stats
    → Read by welcome.ts to detect first visit
    → Written by game.ts on correct answer

theme preference
    → Read/written by theme.ts at startup and on toggle
    → Survives all screen transitions (applied to <html>)
```

### Key Data Flows

1. **First visit detection:** `welcome.ts` calls `loadHistory()`. Empty → show how-to-play above play button. Has entries → show below.
2. **Puzzle data into game screen:** `app.ts` fetches `/api/puzzle` on load, passes clues to `GameScreen.mount(clues)`.
3. **Stats into completion screen:** `CompletionScreen.mount(result)` reads `loadHistory()` directly. Computes streak and win % locally.
4. **Feedback modal:** Both `game.ts` and `completion.ts` call `initFeedbackModal()` / `openFeedbackModal()`. Modal lives outside the screen DOM hierarchy.

## Component Boundaries

| Boundary | Communication pattern | Notes |
|----------|-----------------------|-------|
| ScreenController ↔ Screen | Direct function calls (`mount`, `unmount`) | Screens don't call each other |
| GameScreen → ScreenController | Callback passed into `mount(clues, { onComplete })` | Avoids circular imports |
| Screens → storage.ts | Direct import, read/write | storage has no DOM deps, safe anywhere |
| Screens → modals.ts | Direct import | Modal manages its own DOM |
| GameScreen → octo/bubbles | Direct import, called on victory | Animation completion triggers transition |
| GameScreen → API | fetch('/api/guess') — no abstraction layer needed | Only one consumer |

## Build Order (Phase Dependencies)

This is the recommended build sequence. Each step unblocks the next.

1. **Tailwind config + design tokens** — Semantic colour tokens in `tailwind.config.ts`. Nothing else can be styled until this exists.
2. **HTML scaffold** — Three `<section>` screen containers in `index.html`, hidden by default. The ScreenController needs these to exist.
3. **ScreenController** — The FSM. Just transitions, no screen content yet. Test manually by logging transitions.
4. **WelcomeScreen** — Simplest screen (no API, no game logic). First screen the user sees. Mount/unmount + play button.
5. **GameScreen** — Most complex. Port existing clue rendering, digit boxes, keypad, submit flow. Wire into ScreenController.
6. **CompletionScreen** — Stats rendering (reads storage). Wire "play again" if needed.
7. **Celebration animation timing** — Integrate octo/bubbles into GameScreen → CompletionScreen transition.
8. **Old CSS removal** — Only safe once all three screens render correctly in Tailwind.

## Anti-Patterns

### Anti-Pattern 1: Shared Mutable Module-Level State in app.ts

**What people do:** Keep `gameState`, `possibles`, `dom`, and all render functions in one 800-line `app.ts`. This is the current shape of the codebase.

**Why it's wrong for this milestone:** Adding screen switching to a monolithic module means all screens share one DOM cache object and one chunk of state. Testing game state without mounting a screen becomes impossible. Refactoring later costs more than restructuring now.

**Do this instead:** Move each screen's DOM cache and local state inside that screen's module. `gameState` moves into `game.ts`. The screen controller holds nothing except `current`.

### Anti-Pattern 2: Generating Screen HTML in JavaScript Strings

**What people do:** `screenEl.innerHTML = '<div class="...">'` with Tailwind classes embedded in JS template literals.

**Why it's wrong:** Tailwind's class scanner works on HTML/JS files but complex conditional class strings become hard to read and Tailwind's purging can miss dynamically assembled class names.

**Do this instead:** Author all three screens in `index.html`. Toggle `hidden`. Use JS only for dynamic content (clue text, stats numbers), not structural HTML.

### Anti-Pattern 3: Skipping unmount() Cleanup

**What people do:** `mount()` adds event listeners. Transition happens. Next `mount()` adds them again. After a few transitions, multiple listeners fire on the same event.

**Why it's wrong:** Ghost listeners cause double-submissions, double API calls, and hard-to-trace bugs.

**Do this instead:** Every `addEventListener` in `mount()` has a matching `removeEventListener` in `unmount()`. Use named function references (not inline arrows) so removal works.

### Anti-Pattern 4: Animating Transitions with CSS Classes on a Timer

**What people do:** Add `fade-out` class, `setTimeout(500, () => { swap screen; add fade-in class })`. 

**Why it's wrong:** Timing is fragile. If the timeout fires before the CSS transition completes (or after), you get flashes or missed transitions. Hard to cancel.

**Do this instead:** Use the View Transition API with a graceful fallback. The browser handles timing natively.

## Sources

- Game Programming Patterns — State chapter: https://gameprogrammingpatterns.com/state.html (HIGH confidence — canonical reference)
- View Transition API browser support: https://caniuse.com/view-transitions (HIGH confidence — 90.94% global coverage, Chrome 111+, Safari 18+, Firefox 144+)
- MDN View Transition API same-document transitions: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API (HIGH confidence — official spec docs)
- Chrome for Developers — same-document view transitions guide: https://developer.chrome.com/docs/web-platform/view-transitions/same-document (HIGH confidence)
- Current codebase analysis: `src/app.ts` (815 lines), `.planning/codebase/ARCHITECTURE.md` (HIGH confidence — direct inspection)

---
*Architecture research for: Clumeral multi-screen UI redesign (vanilla TypeScript, no framework)*
*Researched: 2026-04-11*
