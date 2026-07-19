import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PALETTE } from '../src/palette';

// The palette is declared in three places that cannot import one another:
// src/palette.ts (TypeScript, read by colours.ts and the contrast test),
// src/tailwind.css (the SPA stylesheet) and the Worker's inline <style>
// (src/worker/puzzles.ts, because /archive never loads tailwind.css).
//
// #243 shipped a fix to the SPA that missed the Worker copy and survived review.
// This test is the guard, and it is three-way on purpose: comparing only the two
// stylesheets to each other would let them drift together away from palette.ts,
// which is what the contrast test reads. Edit --accent-l in both CSS files and
// nothing else, and without the PALETTE checks below every test in the repo
// still passes while light mode ships under 4.5:1 (#255 DA review).
//
// #200 migrates /archive to a SPA route, at which point the CSS duplication and
// half of this test go away. The palette.ts half should stay.

const THEMES = Object.keys(PALETTE.hues) as (keyof typeof PALETTE.hues)[];

// Declarations owned by the palette. Deliberately a pattern rather than a fixed
// list: a fixed list cannot see a token added to one file and not the other,
// which is precisely the #243 failure mode. --shadow-* and --font-* live only in
// tailwind.css and are not palette values, so they are outside the pattern.
const PALETTE_TOKEN = /^--(accent|chroma|color)-/;

function declarations(css: string, scope: string): Record<string, string> {
  const block = new RegExp(`${scope}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`no "${scope}" block found`);
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (PALETTE_TOKEN.test(m[1])) out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  }
  return out;
}

/** Declared numbers are formatted for humans — 0.50, 0.140 — so compare by
 *  value, not by string. A chroma truncated to 3dp must still equal palette.ts. */
function num(value: string, label: string): number {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) throw new Error(`${label} is not a number: ${value}`);
  return n;
}

const root = resolve(__dirname, '..');
const tailwind = readFileSync(resolve(root, 'src/tailwind.css'), 'utf-8');
const worker = readFileSync(resolve(root, 'src/worker/puzzles.ts'), 'utf-8');
const colours = readFileSync(resolve(root, 'src/colours.ts'), 'utf-8');

const BASE_BLOCK = {
  light: { tailwind: '@theme', worker: ':root' },
  dark: { tailwind: 'html\\.dark', worker: ':root\\.dark' },
} as const;

const MODES = ['light', 'dark'] as const;

describe('token parity: tailwind.css vs the Worker inline style', () => {
  it.each(MODES)('%s-mode tokens agree', (mode) => {
    expect(declarations(worker, BASE_BLOCK[mode].worker)).toEqual(
      declarations(tailwind, BASE_BLOCK[mode].tailwind)
    );
  });

  // One rule per theme, covering both modes: --accent-c points at --chroma-*,
  // which is re-declared in the dark base block. The dark-mode test above
  // compares those, so there are no dark per-theme rules to check here.
  // Derived from PALETTE.hues, so a fifth theme is checked without editing this.
  it.each(THEMES)('%s hue and chroma agree', (theme) => {
    expect(declarations(worker, `:root\\[data-theme="${theme}"\\]`)).toEqual(
      declarations(tailwind, `html\\[data-theme="${theme}"\\]`)
    );
  });

  // The rename migration is duplicated the same way the tokens are: colours.ts
  // for the SPA, the Worker's inline script for /archive. Drift means the two
  // render different accents for the same returning player.
  it('the legacy theme-name map agrees between colours.ts and the Worker', () => {
    const pairs = (src: string, block: RegExp): Record<string, string> => {
      const m = block.exec(src);
      if (!m) throw new Error('no legacy-name map found');
      return Object.fromEntries(
        [...m[1].matchAll(/(\w+)\s*:\s*['"](\w+)['"]/g)].map((p) => [p[1], p[2]])
      );
    };
    expect(pairs(worker, /var LEGACY = \{([^}]*)\}/)).toEqual(
      pairs(colours, /const LEGACY_NAMES: Record<string, ThemeName> = \{([^}]*)\}/)
    );
  });

  // The Worker's inline <script> runs before the stylesheet applies and writes
  // to documentElement.style, which outranks every rule in the <style> block.
  // It used to set --color-accent to a hardcoded hex, which would have pinned
  // /archive to the old palette while every parity check above still passed.
  // Setting a data-theme attribute is the only correct move here (#255).
  it('the inline script sets data-theme, never an accent custom property inline', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(worker);
    expect(script, 'no inline <script> found').not.toBeNull();
    expect(script![1]).toContain('dataset.theme');
    expect(script![1]).not.toMatch(/setProperty\(\s*["']--/);
  });
});

// The half that makes palette.ts load-bearing. Without these, palette.ts is a
// document that happens to agree with the CSS rather than the thing the CSS is
// answerable to — and tests/palette-contrast.spec.ts would be asserting AA over
// numbers nothing renders.
describe('token parity: the stylesheets vs src/palette.ts', () => {
  // Both stylesheets, keyed so each knows its own selector for a given mode.
  const SOURCES = [
    { label: 'tailwind.css', css: tailwind, key: 'tailwind' },
    { label: 'worker', css: worker, key: 'worker' },
  ] as const;

  const baseDecls = (src: (typeof SOURCES)[number], mode: (typeof MODES)[number]) =>
    declarations(src.css, BASE_BLOCK[mode][src.key]);

  it.each(MODES)('%s neutrals match palette.ts', (mode) => {
    for (const src of SOURCES) {
      const d = baseDecls(src, mode);
      expect(d['--color-bg']?.toUpperCase(), `${src.label} ${mode} bg`).toBe(PALETTE[mode].bg);
      expect(d['--color-surface']?.toUpperCase(), `${src.label} ${mode} surface`).toBe(
        PALETTE[mode].surface
      );
      expect(d['--color-text']?.toUpperCase(), `${src.label} ${mode} text`).toBe(
        PALETTE[mode].text
      );
    }
  });

  // The single parameter the whole AA guarantee rests on.
  it.each(MODES)('%s accent lightness matches palette.ts', (mode) => {
    for (const src of SOURCES) {
      const d = baseDecls(src, mode);
      expect(num(d['--accent-l'], `${src.label} ${mode} --accent-l`)).toBe(PALETTE[mode].accentL);
    }
  });

  it.each(MODES)('%s chroma values match palette.ts', (mode) => {
    for (const src of SOURCES) {
      const d = baseDecls(src, mode);
      for (const theme of THEMES) {
        const token = `--chroma-${theme.toLowerCase()}`;
        expect(num(d[token], `${src.label} ${mode} ${token}`)).toBe(PALETTE[mode].accentC[theme]);
      }
    }
  });

  it.each(THEMES)('%s hue angle matches palette.ts', (theme) => {
    const blocks = [
      ['tailwind.css', tailwind, `html\\[data-theme="${theme}"\\]`],
      ['worker', worker, `:root\\[data-theme="${theme}"\\]`],
    ] as const;
    for (const [label, css, scope] of blocks) {
      const d = declarations(css, scope);
      expect(num(d['--accent-h'], `${label} ${theme} --accent-h`)).toBe(PALETTE.hues[theme]);
    }
  });

  // success and error alias two themes rather than carrying values of their own
  // (#255). Asserted against the stylesheet text, because the failure mode is
  // someone hand-editing a literal back in — which would ship a colour that has
  // never been contrast-checked while every computed test still passed. The
  // expected string is built from PALETTE.semantics, so re-pointing the alias
  // there updates both stylesheets' expectations at once.
  it.each(Object.entries(PALETTE.semantics))('--color-%s aliases the %s theme', (name, theme) => {
    const t = theme as keyof typeof PALETTE.hues;
    const expected = `oklch(var(--accent-l) var(--chroma-${t.toLowerCase()}) ${PALETTE.hues[t]})`;
    for (const [label, css] of [
      ['tailwind.css', tailwind],
      ['worker', worker],
    ] as const) {
      const m = new RegExp(`--color-${name}\\s*:\\s*([^;]+);`).exec(css);
      expect(m, `--color-${name} not found in ${label}`).not.toBeNull();
      expect(m![1].trim().replace(/\s+/g, ' '), `--color-${name} in ${label}`).toBe(expected);
    }
  });
});
