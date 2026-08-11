import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PALETTE } from '../src/palette';

// The "best" figures on the completion panel take the NEXT theme's colour, so a
// personal best reads as a different thing from today's number without needing a
// fifth hue nobody picked (redesign brief 31, 60).
//
// It has to be CSS, not JavaScript. Chroma differs per theme AND per mode, and
// the panel renders once — derive the colour at render time and switching theme
// while sitting on /solved would move the current colour and freeze the best one
// (redesign brief 75).
//
// tests/token-parity.spec.ts already compares every --accent-* declaration
// between tailwind.css and the Worker's inline style, so the mirror is guarded
// there. What this file guards is the mapping itself: that "next" really is next,
// and that each best colour borrows its own hue's chroma rather than the wrong
// one — which is what puts Cherry out of gamut in dark mode.

const THEMES = Object.keys(PALETTE.hues) as (keyof typeof PALETTE.hues)[];

const tailwind = readFileSync(
  resolve(__dirname, '..', 'src/tailwind.css'),
  'utf-8'
);

function declarations(css: string, scope: string): Record<string, string> {
  const block = new RegExp(`${scope}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`no "${scope}" block found`);
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  }
  return out;
}

/** The theme after this one, wrapping Grape back round to Lime. */
function nextTheme(theme: (typeof THEMES)[number]): (typeof THEMES)[number] {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

describe('the "best" accent is the next theme along', () => {
  it.each(THEMES)('%s takes the next theme\'s hue', (theme) => {
    const d = declarations(tailwind, `html\\[data-theme="${theme}"\\]`);
    expect(Number.parseFloat(d['--accent-best-h']), `${theme} --accent-best-h`).toBe(
      PALETTE.hues[nextTheme(theme)]
    );
  });

  it.each(THEMES)('%s takes the next theme\'s own chroma', (theme) => {
    // The variable, not a number: --chroma-* is re-declared in html.dark, so
    // naming it is what makes the best colour follow dark mode. Borrowing the
    // current theme's chroma instead would push some pairings out of gamut.
    const d = declarations(tailwind, `html\\[data-theme="${theme}"\\]`);
    expect(d['--accent-best-c'], `${theme} --accent-best-c`).toBe(
      `var(--chroma-${nextTheme(theme).toLowerCase()})`
    );
  });

  it.each(THEMES)('%s best hue differs from its own hue', (theme) => {
    const d = declarations(tailwind, `html\\[data-theme="${theme}"\\]`);
    expect(Number.parseFloat(d['--accent-best-h'])).not.toBe(
      Number.parseFloat(d['--accent-h'])
    );
  });

  it('the @theme defaults are Lime\'s, matching the Lime rule', () => {
    // Only seen before colours.ts sets data-theme, but a wrong default here is a
    // flash of the wrong colour on first paint.
    const base = declarations(tailwind, '@theme');
    expect(Number.parseFloat(base['--accent-best-h'])).toBe(PALETTE.hues[nextTheme('Lime')]);
    expect(base['--accent-best-c']).toBe('var(--chroma-cherry)');
    expect(base['--color-accent-best']).toBe(
      'oklch(var(--accent-l) var(--accent-best-c) var(--accent-best-h))'
    );
  });
});
