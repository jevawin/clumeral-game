// Clumeral — theme.ts
// Canvas dot-grid background and light/dark theme toggle.

const STORAGE_THEME = "dlng_theme";

const root = document.documentElement;
let togBtn: HTMLElement | null = null;
let togLabel: HTMLElement | null = null;

export function drawCanvas(dark: boolean): void {
  const canvas = document.querySelector('[data-canvas]') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dot = dark ? "rgba(255,253,247,0.07)" : "rgba(38,38,36,0.09)";
  const gap = 24;
  ctx.fillStyle = dot;
  for (let x = gap; x < canvas.width; x += gap) {
    for (let y = gap; y < canvas.height; y += gap) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function applyTheme(dark: boolean): void {
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  if (togLabel) togLabel.textContent = dark ? "Light mode" : "Dark mode";
  if (togBtn) togBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  drawCanvas(dark);
  if (window._swapIcons && window._currentColour) window._swapIcons(window._currentColour);
}

export function toggleTheme(): void {
  const newDark = !root.classList.contains("dark");
  localStorage.setItem(STORAGE_THEME, newDark ? "dark" : "light");
  applyTheme(newDark);
}

export function initTheme(): void {
  togBtn = document.querySelector('[data-theme-toggle]') as HTMLElement | null;
  togLabel = document.querySelector('[data-theme-label]') as HTMLElement | null;
  if (!togBtn) return;

  const saved = localStorage.getItem(STORAGE_THEME);
  const isDark = saved !== null ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(isDark);

  togBtn.addEventListener("click", toggleTheme);
  window.addEventListener("resize", () => drawCanvas(root.classList.contains("dark")));
}
