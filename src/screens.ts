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

let currentScreen: ScreenId = "welcome";


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

export function getCurrentScreen(): ScreenId {
  return currentScreen;
}

export function initScreens(initial: ScreenId = "welcome"): void {
  updateScreenDOM(initial);
}
