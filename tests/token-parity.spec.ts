import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// /archive is Worker-rendered and ships its own copy of the tokens, because it
// never loads tailwind.css. #243 shipped a fix to the SPA that missed this copy
// and survived review as a result. This test is the guard.
//
// #200 migrates /archive to a SPA route, at which point the duplication and this
// test both go away.
//
// Covers the base blocks and the per-theme rules. /archive has no swatch UI but
// does honour the saved accent, so both halves have to stay in step.

const TOKENS = [
  '--accent-l',
  '--accent-c',
  '--accent-h',
  '--semantic-l',
  '--color-bg',
  '--color-surface',
  '--color-text',
  '--color-accent',
  '--color-border',
  '--color-success',
  '--color-error',
];

function declarations(css: string, scope: string): Record<string, string> {
  // Grab the body of the given selector block, then pull the token declarations.
  const block = new RegExp(`${scope}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`no "${scope}" block found`);
  const out: Record<string, string> = {};
  for (const token of TOKENS) {
    const m = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(block[1]);
    if (m) out[token] = m[1].trim().replace(/\s+/g, ' ');
  }
  return out;
}

const root = resolve(__dirname, '..');
const tailwind = readFileSync(resolve(root, 'src/tailwind.css'), 'utf-8');
const worker = readFileSync(resolve(root, 'src/worker/puzzles.ts'), 'utf-8');

describe('token parity: tailwind.css vs the Worker inline style', () => {
  it('light-mode tokens agree', () => {
    expect(declarations(worker, ':root')).toEqual(declarations(tailwind, '@theme'));
  });

  it('dark-mode tokens agree', () => {
    expect(declarations(worker, ':root\\.dark')).toEqual(declarations(tailwind, 'html\\.dark'));
  });

  it.each(['Lime', 'Berry', 'Blue', 'Violet'])('%s hue and chroma agree in both modes', (theme) => {
    expect(declarations(worker, `:root\\[data-theme="${theme}"\\]`)).toEqual(
      declarations(tailwind, `html\\[data-theme="${theme}"\\]`)
    );
    expect(declarations(worker, `:root\\.dark\\[data-theme="${theme}"\\]`)).toEqual(
      declarations(tailwind, `html\\.dark\\[data-theme="${theme}"\\]`)
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
