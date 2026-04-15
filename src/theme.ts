// Clumeral — theme.ts
// Light/dark theme toggle.

const STORAGE_THEME = "dlng_theme";

const root = document.documentElement;
let togBtn: HTMLElement | null = null;
let togLabel: HTMLElement | null = null;

function applyTheme(dark: boolean): void {
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  if (togLabel) togLabel.textContent = dark ? "Light mode" : "Dark mode";
  if (togBtn) togBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
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
}
