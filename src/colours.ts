import { syncThemeColor } from './theme';

// Colour theme system — accent colour picker, icon swapping, dev helpers.

const STORAGE_COLOUR = 'dlng_colour';

interface ColourTheme {
  name: string;
  light: string;
  dark: string;
}

const THEMES: ColourTheme[] = [
  { name: 'Berry', light: '#de1f46', dark: '#ea6c85' },
  { name: 'Blue', light: '#376ddb', dark: '#6393f2' },
  { name: 'Lime', light: '#0a850a', dark: '#1ead52' },
  { name: 'Violet', light: '#9a44ea', dark: '#b679f0' },
];

function getMode(): string {
  const cl = document.documentElement.classList;
  if (cl.contains('dark')) return 'dark';
  if (cl.contains('light')) return 'light';
  return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
}

function swapIcons(colourName: string): void {
  const mode = getMode();
  const dir = `icons/${colourName.toLowerCase()}/${mode}/`;
  const ati = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (ati) ati.href = dir + 'apple-touch-icon.png';
  const ico = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (ico) { ico.type = 'image/png'; ico.href = dir + 'icon-192.png'; }
}

function applyTheme(theme: ColourTheme): void {
  const r = document.documentElement.style;
  r.setProperty('--acc', `light-dark(${theme.light},${theme.dark})`);
  r.setProperty('--acc-btn', theme.light);
  r.setProperty('--tag-bg', `light-dark(${theme.light}14,${theme.dark}1a)`);
  r.setProperty('--md-lit-bg', `light-dark(${theme.light}1a,${theme.dark}1f)`);
  r.setProperty('--dig-sh-act', `0.1875rem 0.1875rem 0 ${theme.light}4d`);
  window._currentColour = theme.name;
  swapIcons(theme.name);
  syncThemeColor(getMode() === 'dark');
}

function renderSwatches(): void {
  const wrap = document.querySelector('[data-swatches]');
  if (!wrap) return;

  THEMES.forEach((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn';
    btn.setAttribute('aria-label', `Set accent colour to ${t.name}`);
    btn.innerHTML = `<span class="swatch-btn__dot" style="background:light-dark(${t.light},${t.dark})" aria-hidden="true"></span><span class="swatch-btn__label" style="color:light-dark(${t.light},${t.dark})">${t.name}</span>`;
    btn.addEventListener('click', () => {
      applyTheme(t);
      localStorage.setItem(STORAGE_COLOUR, t.name);
    });
    wrap.appendChild(btn);
  });
}

function renderDevLinks(): void {
  const BLOCKED_HOSTS = ['clumeral.com', 'staging-clumeral-game.jevawin.workers.dev'];
  if (BLOCKED_HOSTS.includes(location.hostname)) return;

  const dev = document.querySelector('[data-dev-links]');
  if (!dev) return;
  (dev as HTMLElement).classList.remove('hidden');

  const addBtn = (label: string, fn: () => void): void => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dev-links__btn';
    btn.textContent = label;
    btn.addEventListener('click', fn);
    dev.appendChild(btn);
  };

  addBtn('Reset state', () => { localStorage.clear(); location.reload(); });
  addBtn('Fill answer', () => { if (window._devFillAnswer) window._devFillAnswer(); });
}

export function initColours(): void {
  const saved = localStorage.getItem(STORAGE_COLOUR);
  const active = saved ? THEMES.find((t) => t.name === saved) : THEMES.find((t) => t.name === 'Lime');
  if (active) applyTheme(active);

  renderSwatches();
  renderDevLinks();

  // Expose for theme.ts to call on dark/light toggle
  window._swapIcons = swapIcons;
}
