// Clumeral — screens.ts
// Screen state machine. Three screens — welcome, game, completion —
// toggled via opacity with View Transition API cross-fade (CSS fallback).

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScreenId = "welcome" | "game" | "completion";


// ─── DOM Cache ────────────────────────────────────────────────────────────────

const dom = {
  welcome: document.querySelector('[data-screen="welcome"]') as HTMLElement,
  game: document.querySelector('[data-screen="game"]') as HTMLElement,
  completion: document.querySelector('[data-screen="completion"]') as HTMLElement,
};


// ─── Module State ─────────────────────────────────────────────────────────────

// Initial value is null so the first showScreen() call always applies — even when
// it targets 'welcome' — preventing a pre-router welcome flash on cold load.
let currentScreen: ScreenId | null = null;


// ─── Internal ─────────────────────────────────────────────────────────────────

function updateScreenDOM(next: ScreenId): void {
  (["welcome", "game", "completion"] as ScreenId[]).forEach((id) => {
    const el = dom[id];
    const active = id === next;
    el.classList.toggle("opacity-0", !active);
    el.classList.toggle("opacity-100", active);
    el.classList.toggle("pointer-events-none", !active);
    el.classList.toggle("pointer-events-auto", active);
    el.setAttribute("aria-hidden", active ? "false" : "true");
  });

  // First showScreen call dismisses the cold-load overlay. The 300ms fade hides
  // any pre-paint flash from initial HTML/loadPuzzle DOM writes.
  if (currentScreen === null) {
    const loader = document.querySelector('[data-app-loading]');
    if (loader) {
      // Defer one frame so the screen swap paints before the loader fades out —
      // otherwise on slow paints the loader fades to a still-empty screen.
      requestAnimationFrame(() => {
        loader.classList.replace("opacity-100", "opacity-0");
        // Remove from DOM after fade completes so it can never trap clicks again.
        setTimeout(() => loader.remove(), 350);
      });
    }
  }

  currentScreen = next;
}


// ─── Public API ───────────────────────────────────────────────────────────────

export function showScreen(next: ScreenId): void {
  if (next === currentScreen) return;

  if (!document.startViewTransition) {
    updateScreenDOM(next);
    return;
  }

  document.startViewTransition(() => updateScreenDOM(next));
}

export function getCurrentScreen(): ScreenId | null {
  return currentScreen;
}

export function initScreens(initial: ScreenId = "welcome"): void {
  updateScreenDOM(initial);
}
