// Clumeral — screens.ts
// Screen state machine. Three screens — welcome, game, completion — render in
// natural document flow; only the active screen is displayed. Sequential fade:
// outgoing fades to 0 → display:none → incoming display:flex + opacity-0 → fade in.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScreenId = "welcome" | "game" | "completion";


// ─── DOM Cache ────────────────────────────────────────────────────────────────

const dom = {
  welcome: document.querySelector('[data-screen="welcome"]') as HTMLElement,
  game: document.querySelector('[data-screen="game"]') as HTMLElement,
  completion: document.querySelector('[data-screen="completion"]') as HTMLElement,
};

const appHeader = document.querySelector('[data-app-header]') as HTMLElement | null;


// ─── Module State ─────────────────────────────────────────────────────────────

// Initial value is null so the first showScreen() call always applies — even when
// it targets 'welcome' — preventing a pre-router welcome flash on cold load.
let currentScreen: ScreenId | null = null;


// ─── Internal ─────────────────────────────────────────────────────────────────

function showHeader(visible: boolean): void {
  if (!appHeader) return;
  appHeader.style.display = visible ? "" : "none";
}

function emitEnter(next: ScreenId): void {
  // Lets app.ts re-render screen-specific content (e.g. stats) when this screen
  // becomes active — without leaking screen state into shared modules.
  document.dispatchEvent(new CustomEvent("screens:enter", { detail: { screen: next } }));
}

function paintScreen(next: ScreenId): void {
  (["welcome", "game", "completion"] as ScreenId[]).forEach((id) => {
    const el = dom[id];
    const active = id === next;
    if (active) {
      el.style.display = "flex";
      el.classList.remove("opacity-0");
      el.classList.add("opacity-100");
      el.setAttribute("aria-hidden", "false");
    } else {
      el.style.display = "none";
      el.classList.remove("opacity-100");
      el.classList.add("opacity-0");
      el.setAttribute("aria-hidden", "true");
    }
  });

  // App header: hidden on welcome (welcome is self-contained); shown elsewhere.
  showHeader(next !== "welcome");

  // First showScreen call dismisses the cold-load overlay (300ms fade).
  if (currentScreen === null) {
    const loader = document.querySelector('[data-app-loading]');
    if (loader) {
      requestAnimationFrame(() => {
        loader.classList.replace("opacity-100", "opacity-0");
        setTimeout(() => loader.remove(), 350);
      });
    }
  }

  currentScreen = next;
  emitEnter(next);
}


// ─── Public API ───────────────────────────────────────────────────────────────

// Sequential fade: outgoing screen fades to 0, then is hidden, then the incoming
// screen is displayed and fades in. No cross-fade bleed.
const FADE_OUT_MS = 200;

// Tracks an in-flight transition so a rapid showScreen() can cancel it cleanly.
// Without this, a back→forward inside one fade-out window leaves the header /
// display state from the cancelled transition still pending, then it fires after
// the new transition completes and stomps the correct state.
let pendingTransition: { timer: ReturnType<typeof setTimeout>; target: ScreenId } | null = null;

export function showScreen(next: ScreenId): void {
  // If a transition is in flight to this same target, no-op.
  if (pendingTransition && pendingTransition.target === next) return;
  if (!pendingTransition && next === currentScreen) return;

  // Cancel any in-flight transition before starting a new one.
  if (pendingTransition) {
    clearTimeout(pendingTransition.timer);
    pendingTransition = null;
  }

  // First call (cold load) — paint immediately, no prior screen to fade out.
  if (currentScreen === null) {
    paintScreen(next);
    return;
  }

  const prevEl = dom[currentScreen];
  // Fade the outgoing screen.
  prevEl.classList.replace("opacity-100", "opacity-0");
  prevEl.setAttribute("aria-hidden", "true");

  const timer = setTimeout(() => {
    pendingTransition = null;
    // Hide outgoing, show incoming starting at opacity-0, then transition to opacity-100
    // on the next frame so the CSS transition fires.
    prevEl.style.display = "none";
    const nextEl = dom[next];
    nextEl.style.display = "flex";
    nextEl.classList.add("opacity-0");
    nextEl.classList.remove("opacity-100");
    nextEl.setAttribute("aria-hidden", "false");
    showHeader(next !== "welcome");
    requestAnimationFrame(() => {
      nextEl.classList.replace("opacity-0", "opacity-100");
    });
    currentScreen = next;
    emitEnter(next);
  }, FADE_OUT_MS);

  pendingTransition = { timer, target: next };
}
