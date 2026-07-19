// Clumeral — colours.ts
// Accent colour picker. 4 themes, persists in localStorage. The app icon is
// fixed (green octopus on black) and does not follow the accent or theme.

import { PALETTE } from './palette';

const STORAGE_COLOUR = 'dlng_colour';

type ThemeName = keyof typeof PALETTE.hues;

interface ColourTheme {
  name: ThemeName;
  hue: number;
  chromaLight: number;
  chromaDark: number;
  icon: string;
}

// A fruit per theme, shown inside the swatch dot. Presentation only — it lives
// here rather than in palette.ts, which holds colour values and nothing else.
const ICONS: Record<ThemeName, string> = {
  Lime: 'citrus',
  Cherry: 'cherry',
  Blueberry: 'blueberry',
  Grape: 'grape',
};

// Themes were renamed to fruit in #255. The stored preference is the theme name
// itself, so without this every player not on Lime would silently reset to Lime
// on their next visit. Reads are migrated and rewritten, so this can be dropped
// once enough time has passed for stored values to have turned over.
const LEGACY_NAMES: Record<string, ThemeName> = {
  Berry: 'Cherry',
  Blue: 'Blueberry',
  Violet: 'Grape',
};

// Hue plus a chroma per mode. Lightness is shared and lives in tailwind.css,
// which is what makes every theme AA-safe by construction — chroma is
// contrast-inert and free to vary per theme (#255).
const THEMES: ColourTheme[] = (Object.keys(PALETTE.hues) as ThemeName[]).map((name) => ({
  name,
  hue: PALETTE.hues[name],
  chromaLight: PALETTE.light.accentC[name],
  chromaDark: PALETTE.dark.accentC[name],
  icon: ICONS[name],
}));

const root = document.documentElement;
let active: ColourTheme = THEMES[0];

// Chroma varies by theme and by mode, so pushing it from here would need a
// light/dark branch. Setting an attribute instead lets the tailwind.css rules
// resolve hue and both chromas, keeping the mode half of the mapping in the
// cascade next to html.dark.
function applyColour(theme: ColourTheme): void {
  active = theme;
  root.dataset.theme = theme.name;
  window._currentColour = theme.name;
  refreshSwatchState();
}

function refreshSwatchState(): void {
  // The menu section heading names the active theme in its own colour.
  const nameEl = document.querySelector('[data-theme-name]');
  if (nameEl) nameEl.textContent = active.name;

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
    // A dot cannot use --accent-c: that is whichever theme is active, not the
    // one this dot represents. So each carries its own hue and both chromas.
    btn.style.setProperty('--swatch-h', String(t.hue));
    btn.style.setProperty('--swatch-cl', String(t.chromaLight));
    btn.style.setProperty('--swatch-cd', String(t.chromaDark));
    // aria-hidden on both: the button already carries the theme name as its
    // aria-label and its checked state as aria-checked, so neither the fruit nor
    // the arrow should be announced. The arrow marks the selected theme and is
    // always in the DOM — CSS shows it only on the checked swatch, so the row
    // does not reflow when the selection moves.
    btn.innerHTML =
      `<svg class="swatch-fruit" aria-hidden="true" focusable="false"><use href="/sprites.svg#icon-${t.icon}"/></svg>` +
      `<svg class="swatch-arrow" aria-hidden="true" focusable="false"><use href="/sprites.svg#icon-arrow-up"/></svg>`;
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
  // hasOwn, not a plain lookup: a stored '__proto__' or 'constructor' would
  // otherwise resolve to an inherited member of the object literal, take the
  // migrated branch, and clobber the stored value.
  const migrated = saved ? (Object.hasOwn(LEGACY_NAMES, saved) ? LEGACY_NAMES[saved] : saved) : null;
  const found = migrated ? THEMES.find((t) => t.name === migrated) : null;
  active = found ?? THEMES.find((t) => t.name === 'Lime')!;

  // Write the new name back so the migration only has to happen once.
  if (saved && migrated !== saved) {
    try {
      localStorage.setItem(STORAGE_COLOUR, active.name);
    } catch { /* private mode — the migration just repeats next visit */ }
  }

  renderSwatches();
  applyColour(active);

  // theme.ts calls this after a dark/light flip. The accent now re-resolves on
  // its own — --accent-l and the per-theme chroma rules both key off html.dark —
  // so this is a no-op for colour. Kept because it still refreshes swatch state
  // and the _currentColour global that the e2e specs read (#255).
  window._refreshAccent = () => applyColour(active);
}
