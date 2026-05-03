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

// Sequential fade: outgoing screen fades to 0, then the incoming screen fades in.
// Avoids the cross-fade bleed where both screens are visible together (which made
// stale destination DOM — e.g. last completion result — flash during back/forward).
const FADE_OUT_MS = 200;

export function showScreen(next: ScreenId): void {
  if (next === currentScreen) return;

  // First call (cold load) — paint immediately, no fade-out from a prior screen.
  if (currentScreen === null) {
    updateScreenDOM(next);
    return;
  }

  const prev = currentScreen;
  const prevEl = dom[prev];
  // Fade the outgoing screen out first.
  prevEl.classList.add("opacity-0");
  prevEl.classList.remove("opacity-100", "pointer-events-auto");
  prevEl.classList.add("pointer-events-none");
  prevEl.setAttribute("aria-hidden", "true");

  setTimeout(() => updateScreenDOM(next), FADE_OUT_MS);
}

export function getCurrentScreen(): ScreenId | null {
  return currentScreen;
}

export function initScreens(initial: ScreenId = "welcome"): void {
  updateScreenDOM(initial);
}
