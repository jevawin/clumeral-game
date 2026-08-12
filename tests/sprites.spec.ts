import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A <use href="#icon-missing"> renders as nothing at all — no error, no gap in
// the layout worth noticing, and no other test would catch it. So the three
// icons the completion panel depends on are pinned here by id (redesign brief
// 33, 79).

const sheet = readFileSync(resolve(__dirname, '..', 'public/sprites.svg'), 'utf-8');

const PANEL_ICONS = ['icon-stopwatch', 'icon-gamepad', 'icon-calculator-check', 'icon-flame'];

function symbol(id: string): string {
  const m = new RegExp(`<symbol id="${id}"[\\s\\S]*?</symbol>`).exec(sheet);
  if (!m) throw new Error(`no <symbol id="${id}"> in public/sprites.svg`);
  return m[0];
}

describe('the completion panel icons', () => {
  it.each(PANEL_ICONS)('%s exists', (id) => {
    expect(() => symbol(id)).not.toThrow();
  });

  it.each(PANEL_ICONS)('%s carries a viewBox', (id) => {
    // Without one the symbol does not scale, and the icon renders at whatever
    // size its coordinates happen to be.
    expect(symbol(id)).toContain('viewBox="0 0 24 24"');
  });

  it.each(PANEL_ICONS)('%s draws in currentColor, never a literal', (id) => {
    // The icons inherit the surrounding colour, which is what makes them follow
    // the theme and dark mode without a rule of their own.
    const svg = symbol(id);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).not.toMatch(/(stroke|fill)="#/);
  });
});
