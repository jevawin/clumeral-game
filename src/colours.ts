// Clumeral — colours.ts
// Accent colour picker. 4 themes, persists in localStorage, swaps favicon per mode.

const STORAGE_COLOUR = 'dlng_colour';

interface ColourTheme {
  name: string;
  light: string;
  dark: string;
}

const THEMES: ColourTheme[] = [
  { name: 'Lime', light: '#0a850a', dark: '#1ead52' },
  { name: 'Berry', light: '#de1f46', dark: '#ea6c85' },
  { name: 'Blue', light: '#376ddb', dark: '#6393f2' },
  { name: 'Violet', light: '#9a44ea', dark: '#b679f0' },
];

const root = document.documentElement;
let active: ColourTheme = THEMES[0];

function isDark(): boolean {
  if (root.classList.contains('dark')) return true;
  if (root.classList.contains('light')) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function swapIcons(name: string): void {
  const mode = isDark() ? 'dark' : 'light';
  const dir = `/icons/${name.toLowerCase()}/${mode}/`;
  const ico = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (ico) ico.href = dir + 'icon-192.png';
  const ati = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (ati) ati.href = dir + 'apple-touch-icon.png';
}

function applyColour(theme: ColourTheme): void {
  active = theme;
  const colour = isDark() ? theme.dark : theme.light;
  root.style.setProperty('--color-accent', colour);
  swapIcons(theme.name);
  window._currentColour = theme.name;
  refreshSwatchState();
}

function refreshSwatchState(): void {
  const wrap = document.querySelector('[data-swatches]');
  if (!wrap) return;
  wrap.querySelectorAll<HTMLButtonElement>('.swatch-btn').forEach((btn) => {
    const isActive = btn.dataset.colour === active.name;
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    btn.tabIndex = isActive ? 0 : -1;
  });
}

function renderSwatches(): void {
  const wrap = document.querySelector('[data-swatches]');
  if (!wrap) return;
  wrap.setAttribute('role', 'radiogroup');
  wrap.setAttribute('aria-label', 'Accent colour');

  THEMES.forEach((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn';
    btn.dataset.colour = t.name;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', t.name);
    btn.setAttribute('aria-checked', 'false');
    btn.style.setProperty('--swatch-light', t.light);
    btn.style.setProperty('--swatch-dark', t.dark);
    btn.addEventListener('click', () => {
      applyColour(t);
      localStorage.setItem(STORAGE_COLOUR, t.name);
    });
    wrap.appendChild(btn);
  });

  refreshSwatchState();
}

export function initColours(): void {
  const saved = localStorage.getItem(STORAGE_COLOUR);
  const found = saved ? THEMES.find((t) => t.name === saved) : null;
  active = found ?? THEMES.find((t) => t.name === 'Lime')!;

  renderSwatches();
  applyColour(active);

  // theme.ts calls this after dark/light flip so accent picks the right variant.
  window._refreshAccent = () => applyColour(active);
}
