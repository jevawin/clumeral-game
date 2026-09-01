import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PALETTE } from '../src/palette';

// The completion screen shows all four theme colours at once (brief 79): the
// player's own on their solve, then the next three in picker order on Streaks,
// Records and All time. Change theme and all four rotate together.
//
// It has to be CSS, not JavaScript. Chroma differs per theme AND per mode, and
// the panel renders once, so deriving the colours at render time would freeze
// three of them the moment somebody switched theme while sitting on /solved.
//
// tests/token-parity.spec.ts already compares every --accent-* declaration
// between tailwind.css and the Worker's inline style, so the mirror is guarded
// there. What this file guards is the mapping: that the rotation really is a
// rotation, and that each colour borrows its OWN hue's chroma rather than the
// current theme's — which is what would put Cherry out of gamut in dark mode.

const THEMES = Object.keys(PALETTE.hues) as (keyof typeof PALETTE.hues)[];

const tailwind = readFileSync(resolve(__dirname, '..', 'src/tailwind.css'), 'utf-8');
const completion = readFileSync(resolve(__dirname, '..', 'src/completion.ts'), 'utf-8');

function declarations(css: string, scope: string): Record<string, string> {
  const block = new RegExp(`${scope}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`no "${scope}" block found`);
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
    out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  }
  return out;
}

/** The theme n places along, wrapping round. */
function rotate(theme: (typeof THEMES)[number], n: number): (typeof THEMES)[number] {
  return THEMES[(THEMES.indexOf(theme) + n) % THEMES.length];
}

const SLOTS = [2, 3, 4] as const;

describe('the four theme colours rotate together', () => {
  it.each(THEMES)('%s maps its three other slots in picker order', (theme) => {
    const d = declarations(tailwind, `html\\[data-theme="${theme}"\\]`);
    for (const slot of SLOTS) {
      const other = rotate(theme, slot - 1);
      expect(Number.parseFloat(d[`--accent-${slot}-h`]), `${theme} slot ${slot} hue`)
        .toBe(PALETTE.hues[other]);
      // The variable, not a number: --chroma-* is re-declared in html.dark, so
      // naming it is what makes every colour follow dark mode.
      expect(d[`--accent-${slot}-c`], `${theme} slot ${slot} chroma`)
        .toBe(`var(--chroma-${other.toLowerCase()})`);
    }
  });

  it.each(THEMES)('%s shows four different hues at once', (theme) => {
    const d = declarations(tailwind, `html\\[data-theme="${theme}"\\]`);
    const hues = [d['--accent-h'], ...SLOTS.map((n) => d[`--accent-${n}-h`])]
      .map((v) => Number.parseFloat(v));
    expect(new Set(hues).size, `${theme} hues: ${hues.join(', ')}`).toBe(4);
  });

  it("the @theme defaults are Lime's rotation", () => {
    // Only seen before colours.ts sets data-theme, but a wrong default here is a
    // flash of the wrong colours on first paint.
    const base = declarations(tailwind, '@theme');
    for (const slot of SLOTS) {
      expect(Number.parseFloat(base[`--accent-${slot}-h`]))
        .toBe(PALETTE.hues[rotate('Lime', slot - 1)]);
      expect(base[`--color-accent-${slot}`])
        .toBe(`oklch(var(--accent-l) var(--accent-${slot}-c) var(--accent-${slot}-h))`);
    }
  });

  it('gives each section its colour, and colours nothing but icons and numbers', () => {
    // Asserted on the markup now: --section-accent is gone and each element
    // takes its colour class directly. Asserting the WHOLE literal name is also
    // the guard against building one at runtime — Tailwind finds classes by
    // scanning source text, so a name assembled from a stem and a number
    // compiles to no rule at all and the panel would ship grey.
    //
    // Brief 80: colour never lands on a label, a heading or a divider — the
    // things a player has to read stay in the foreground colour.
    const expected: Record<string, string[]> = {
      streak: ['text-accent-2', 'border-accent-2'],
      records: ['text-accent-3', 'border-accent-3'],
      'all-time': ['text-accent-4', 'bg-accent-4'],
    };
    for (const [id, names] of Object.entries(expected)) {
      for (const name of names) {
        expect(completion, `${id} should carry ${name}`).toContain(name);
      }
    }
    // The label stays in the foreground colour: only the icon, the number and
    // the box border take the section's.
    const label = /<[a-z]+ data-stat-label[^>]*>/.exec(completion);
    expect(label, 'no element carries data-stat-label').not.toBeNull();
    expect(label![0]).not.toContain('text-accent');
  });
});
